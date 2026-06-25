/**
 * Tests the three native-Bitcoin send MCP tools: `get_bitcoin_fee_rates`, `get_bitcoin_send_quote`,
 * and `execute_bitcoin_send`.
 *
 * On-chain BTC is UTXO-based and irreversible, so it uses a quote→execute flow (like the swap tools)
 * rather than `transfer_native`. The tools are thin adapters over the WatchOnlyWallet's
 * `InterfaceSendQuotable` (`getSendQuote` / `executeSendQuote`) — the same engine the UI Bitcoin send
 * screens drive — so we mock `backgroundCaller.lazyInitWallet` to return a fake quotable wallet, plus
 * `BlueElectrum.estimateFees`, `getMasterSeed`, and `validateAddress`.
 *
 * These tests pin:
 *  - fee-rates: estimateFees() {fast,medium,slow} mapped to {high,medium,low} sat/vByte; estimate failure → error.
 *  - quote: happy path stages a quote and returns quote_id + fee_base_units + total_base_units; invalid
 *    address rejected before any wallet call; insufficient-funds (getSendQuote throws) surfaced as an MCP
 *    error (not a throw); a fee exceeding 30% of the amount rejected without staging.
 *  - execute: happy path signs+broadcasts via executeSendQuote (with the staged quote + mnemonic) and
 *    returns the txid; unknown quote_id errors; a consumed quote_id (single-use) errors on re-execute; a
 *    broadcast failure surfaces as an MCP error and the quote is retained for re-execution.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MCP_BALANCE_ACCOUNT_NUMBER } from '../../hooks/AccountNumberContext';
import { registerWalletMcpCalls } from '../../features/mcp/modules/mcp-calls';
import type { McpCallDeps } from '../../features/mcp/modules/mcp-deps';
import { NETWORK_BITCOIN } from '../../types/networks';

// Heavy module graph pulled in at import time by mcp-calls.ts — stub it so the surface stays cheap and
// deterministic (mirrors the other mcp-calls unit tests).
vi.mock('@flashnet/sdk', () => ({ FlashnetClient: vi.fn(), isFlashnetError: vi.fn().mockReturnValue(false) }));
vi.mock('@buildonspark/spark-sdk', () => ({ isValidSparkAddress: vi.fn().mockReturnValue(true) }));
vi.mock('../../hooks/useTransferService', () => ({ useTransferService: vi.fn(), getTransferServiceManager: vi.fn(), setFlashnetAccountNumber: vi.fn() }));
vi.mock('../../hooks/useExchangeRate', () => ({ exchangeRateFetcher: vi.fn() }));
vi.mock('../../hooks/useBalance', () => ({ balanceFetcher: vi.fn() }));
vi.mock('../../hooks/useTokenBalance', () => ({ tokenBalanceFetcher: vi.fn() }));
vi.mock('../../features/mcp/modules/mcp-activity-log', () => ({ pushMcpActivityLog: vi.fn() }));

// Address validation + Electrum fee estimation are the only "external" things the BTC tools touch
// besides the wallet (getSendQuote/executeSendQuote, mocked via lazyInitWallet).
const { mockValidateAddress, mockEstimateFees, mockConnectMain } = vi.hoisted(() => ({
  mockValidateAddress: vi.fn(),
  mockEstimateFees: vi.fn(),
  mockConnectMain: vi.fn(),
}));
vi.mock('../../modules/wallet-utils', () => ({ validateAddress: mockValidateAddress }));
vi.mock('../../blue_modules/BlueElectrum', () => ({
  estimateFees: mockEstimateFees,
  connectMain: mockConnectMain,
  mainConnected: false,
}));

type ToolHandler = (input: any) => Promise<{ content: { text: string }[]; isError?: boolean }>;

function parseToolJson(result: { content: { text: string }[] }): any {
  return JSON.parse(result.content[0].text);
}

const RECEIVER = 'bc1qexamplereceiveraddress0000000000000000';

// What WatchOnlyWallet.getSendQuote returns: it echoes the request (address/amount/feeRate) and the
// fee, and carries the unsigned PSBT in `_prepared` (opaque to the MCP layer — passed verbatim into
// executeSendQuote). execute_bitcoin_send reads its echo back, so `request` mirrors the staged input.
const FAKE_QUOTE = { request: { toAddress: RECEIVER, amount: '100000', feeRate: 5 }, fee: '500', feeTicker: 'BTC', _prepared: { psbt: { __psbt: true } } };

const mockGetSendQuote = vi.fn();
const mockExecuteSendQuote = vi.fn();
const mockLazyInitWallet = vi.fn();
const mockGetMasterSeed = vi.fn();
const fakeWallet = { getSendQuote: mockGetSendQuote, executeSendQuote: mockExecuteSendQuote };

function makeFakeDeps(): McpCallDeps {
  return {
    storage: {} as any,
    backgroundCaller: { lazyInitWallet: mockLazyInitWallet, getMasterSeed: mockGetMasterSeed, getAddress: vi.fn() } as any,
    showSuccessToast: vi.fn(),
    trackToolCall: vi.fn(),
  };
}

function buildHandlers(deps: McpCallDeps): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();
  const fakeServer = {
    registerTool: vi.fn((name: string, _config: unknown, handler: ToolHandler) => {
      handlers.set(name, handler);
    }),
  };
  registerWalletMcpCalls(fakeServer as any, deps);
  return handlers;
}

async function stageQuote(handlers: Map<string, ToolHandler>, opts: { amount?: string; fee_rate?: number } = {}): Promise<string> {
  const result = await handlers.get('get_bitcoin_send_quote')!({
    receiver_address: RECEIVER,
    amount_base_units: opts.amount ?? '100000',
    fee_rate: opts.fee_rate ?? 5,
  });
  const body = parseToolJson(result);
  expect(result.isError).toBeUndefined();
  return body.quote_id;
}

let deps: McpCallDeps;
let handlers: Map<string, ToolHandler>;

beforeEach(() => {
  vi.clearAllMocks();
  mockValidateAddress.mockReturnValue(true);
  mockEstimateFees.mockResolvedValue({ fast: 30, medium: 12, slow: 3 });
  mockConnectMain.mockResolvedValue(undefined);
  mockGetSendQuote.mockResolvedValue(FAKE_QUOTE);
  mockExecuteSendQuote.mockResolvedValue('txid_deadbeef');
  mockGetMasterSeed.mockResolvedValue('correct horse battery staple');
  mockLazyInitWallet.mockResolvedValue(fakeWallet);
  deps = makeFakeDeps();
  handlers = buildHandlers(deps);
});

describe('MCP get_bitcoin_fee_rates', () => {
  it('maps estimateFees() {fast,medium,slow} to {high,medium,low} sat/vByte', async () => {
    const result = await handlers.get('get_bitcoin_fee_rates')!({});

    expect(result.isError).toBeUndefined();
    const body = parseToolJson(result);
    expect(body).toMatchObject({ low: 3, medium: 12, high: 30, unit: 'sat/vByte' });
    expect(mockEstimateFees).toHaveBeenCalledTimes(1);
    expect(deps.trackToolCall).toHaveBeenCalledWith('get_bitcoin_fee_rates');
    expect(deps.showSuccessToast).toHaveBeenCalledTimes(1);
  });

  it('surfaces an estimateFees failure as an MCP error (not a throw)', async () => {
    mockEstimateFees.mockRejectedValueOnce(new Error('electrum down'));

    const result = await handlers.get('get_bitcoin_fee_rates')!({});

    expect(result.isError).toBe(true);
    expect(parseToolJson(result).error).toMatch(/electrum down/i);
  });
});

describe('MCP get_bitcoin_send_quote', () => {
  it('stages a quote and returns quote_id, fee_base_units, and total_base_units (amount + fee)', async () => {
    const result = await handlers.get('get_bitcoin_send_quote')!({ receiver_address: `  ${RECEIVER} `, amount_base_units: '100000', fee_rate: 5 });

    expect(result.isError).toBeUndefined();
    const body = parseToolJson(result);
    expect(typeof body.quote_id).toBe('string');
    expect(body.network).toBe(NETWORK_BITCOIN);
    expect(body.receiver_address).toBe(RECEIVER); // trimmed
    expect(body.amount_base_units).toBe('100000');
    expect(body.amount_human_readable).toBe('0.001'); // 100000 sats / 10^8
    expect(body.fee_base_units).toBe('500');
    expect(body.fee_human_readable).toBe('0.000005'); // 500 sats / 10^8
    expect(body.fee_rate).toBe(5);
    expect(body.fee_ticker).toBe('BTC');
    expect(body.total_base_units).toBe('100500');
    expect(body.total_human_readable).toBe('0.001005'); // 100500 sats / 10^8

    expect(mockLazyInitWallet).toHaveBeenCalledWith(NETWORK_BITCOIN, MCP_BALANCE_ACCOUNT_NUMBER);
    expect(mockGetSendQuote).toHaveBeenCalledWith({ toAddress: RECEIVER, amount: '100000', feeRate: 5 });
    expect(deps.trackToolCall).toHaveBeenCalledWith('get_bitcoin_send_quote');
    expect(deps.showSuccessToast).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid Bitcoin address before any wallet call', async () => {
    mockValidateAddress.mockReturnValueOnce(false);

    const result = await handlers.get('get_bitcoin_send_quote')!({ receiver_address: 'not-an-address', amount_base_units: '100000', fee_rate: 5 });

    expect(result.isError).toBe(true);
    expect(parseToolJson(result).error).toMatch(/invalid bitcoin/i);
    expect(mockLazyInitWallet).not.toHaveBeenCalled();
    expect(mockGetSendQuote).not.toHaveBeenCalled();
  });

  it('surfaces insufficient funds (getSendQuote throws) as an MCP error, not a throw', async () => {
    mockGetSendQuote.mockRejectedValueOnce(new Error('Not enough balance to construct transaction'));

    const result = await handlers.get('get_bitcoin_send_quote')!({ receiver_address: RECEIVER, amount_base_units: '100000', fee_rate: 5 });

    expect(result.isError).toBe(true);
    expect(parseToolJson(result).error).toMatch(/not enough balance/i);
    expect(deps.showSuccessToast).not.toHaveBeenCalled();
  });

  it('rejects a quote whose fee exceeds 30% of the amount, without staging it', async () => {
    // amount 1000 sats, fee 500 sats → 50% > 30% → rejected.
    mockGetSendQuote.mockResolvedValueOnce({ ...FAKE_QUOTE, fee: '500' });

    const result = await handlers.get('get_bitcoin_send_quote')!({ receiver_address: RECEIVER, amount_base_units: '1000', fee_rate: 5 });

    expect(result.isError).toBe(true);
    const body = parseToolJson(result);
    expect(body.error).toMatch(/exceeds 30%/i);
    expect(body.quote_id).toBeUndefined();
    expect(deps.showSuccessToast).not.toHaveBeenCalled();
  });

  it('allows a fee equal to exactly 30% of the amount (boundary is inclusive)', async () => {
    // amount 1000 sats, fee 300 sats → exactly 30% → allowed.
    mockGetSendQuote.mockResolvedValueOnce({ ...FAKE_QUOTE, fee: '300' });

    const result = await handlers.get('get_bitcoin_send_quote')!({ receiver_address: RECEIVER, amount_base_units: '1000', fee_rate: 5 });

    expect(result.isError).toBeUndefined();
    expect(parseToolJson(result).total_base_units).toBe('1300');
  });
});

describe('MCP execute_bitcoin_send', () => {
  it('signs + broadcasts the staged quote with the master seed and returns the txid', async () => {
    const quoteId = await stageQuote(handlers);

    const result = await handlers.get('execute_bitcoin_send')!({ quote_id: ` ${quoteId} ` });

    expect(result.isError).toBeUndefined();
    const body = parseToolJson(result);
    expect(body.success).toBe(true);
    expect(body.network).toBe(NETWORK_BITCOIN);
    expect(body.transfer_id).toBe('txid_deadbeef');
    expect(body.receiver_address).toBe(RECEIVER);
    expect(body.amount_base_units).toBe('100000');
    expect(body.amount_human_readable).toBe('0.001'); // 100000 sats / 10^8
    expect(body.fee_base_units).toBe('500');
    expect(body.fee_human_readable).toBe('0.000005'); // 500 sats / 10^8
    expect(body.fee_rate).toBe(5);

    expect(mockExecuteSendQuote).toHaveBeenCalledWith(FAKE_QUOTE, 'correct horse battery staple', MCP_BALANCE_ACCOUNT_NUMBER);
    expect(deps.trackToolCall).toHaveBeenCalledWith('execute_bitcoin_send');
  });

  it('errors on an unknown quote_id without touching the wallet', async () => {
    const result = await handlers.get('execute_bitcoin_send')!({ quote_id: 'does-not-exist' });

    expect(result.isError).toBe(true);
    expect(parseToolJson(result).error).toMatch(/unknown or already-used/i);
    expect(mockExecuteSendQuote).not.toHaveBeenCalled();
  });

  it('is single-use: a second execute of the same quote_id errors (quote consumed on success)', async () => {
    const quoteId = await stageQuote(handlers);

    const first = await handlers.get('execute_bitcoin_send')!({ quote_id: quoteId });
    expect(first.isError).toBeUndefined();

    const second = await handlers.get('execute_bitcoin_send')!({ quote_id: quoteId });
    expect(second.isError).toBe(true);
    expect(parseToolJson(second).error).toMatch(/unknown or already-used/i);
    expect(mockExecuteSendQuote).toHaveBeenCalledTimes(1);
  });

  it('surfaces a broadcast failure as an MCP error and keeps the quote for re-execution', async () => {
    const quoteId = await stageQuote(handlers);
    mockExecuteSendQuote.mockRejectedValueOnce(new Error('bad-txns-inputs-missingorspent'));

    const failed = await handlers.get('execute_bitcoin_send')!({ quote_id: quoteId });
    expect(failed.isError).toBe(true);
    expect(parseToolJson(failed).error).toMatch(/missingorspent/i);

    // Quote was NOT consumed (failure path keeps it) → a retry reaches executeSendQuote again.
    const retry = await handlers.get('execute_bitcoin_send')!({ quote_id: quoteId });
    expect(retry.isError).toBeUndefined();
    expect(parseToolJson(retry).transfer_id).toBe('txid_deadbeef');
    expect(mockExecuteSendQuote).toHaveBeenCalledTimes(2);
  });
});
