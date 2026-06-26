/**
 * Tests the Liquid branch of the MCP `transfer_token` tool.
 *
 * Liquid (Breez) wallets don't implement `InterfaceCanHaveTokens`. The handler mirrors the app's
 * Liquid token-send screen (mobile `send/send-amount-usdt.tsx` → `send/send-confirm.tsx`): the
 * Breez SDK `prepareSendPayment` (with an asset amount) → `sendPayment` path. The Breez SDK takes
 * a human (decimal) receiver amount, so the handler converts the MCP base-unit integer string
 * (`amount_base_units / 10^decimals`).
 *
 * These tests pin: the Liquid path is one-step (no confirmation), converts base units to the
 * SDK's decimal `receiverAmount`, broadcasts via `sendPayment`, blocks on insufficient balance /
 * invalid address, surfaces SDK errors as MCP errors (not throws), and reports the L-BTC fee.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MCP_BALANCE_ACCOUNT_NUMBER } from '../../hooks/AccountNumberContext';
import { registerWalletMcpCalls } from '../../features/mcp/modules/mcp-calls';
import type { McpCallDeps } from '../../features/mcp/modules/mcp-deps';
import { BreezWallet } from '../../class/wallets/breez-wallet';
import { NETWORK_LIQUID } from '../../types/networks';

// Heavy module graph pulled in at import time by mcp-calls.ts — stub it so the surface stays
// cheap and deterministic (mirrors mcp-calls-receive-address.test.ts).
vi.mock('@flashnet/sdk', () => ({ FlashnetClient: vi.fn(), isFlashnetError: vi.fn().mockReturnValue(false) }));
vi.mock('@buildonspark/spark-sdk', () => ({ isValidSparkAddress: vi.fn().mockReturnValue(true) }));
vi.mock('../../hooks/useTransferService', () => ({ useTransferService: vi.fn(), getTransferServiceManager: vi.fn(), setFlashnetAccountNumber: vi.fn() }));
vi.mock('../../hooks/useExchangeRate', () => ({ exchangeRateFetcher: vi.fn() }));
vi.mock('../../hooks/useBalance', () => ({ balanceFetcher: vi.fn() }));
vi.mock('../../features/mcp/modules/mcp-activity-log', () => ({ pushMcpActivityLog: vi.fn() }));

// Hoisted spies so the (pre-body) vi.mock factories can reference them.
const { mockTokenBalanceFetcher } = vi.hoisted(() => ({ mockTokenBalanceFetcher: vi.fn() }));
vi.mock('../../hooks/useTokenBalance', () => ({ tokenBalanceFetcher: mockTokenBalanceFetcher }));

const { mockPrepareSendPayment, mockSendPayment, mockBreezIsAddressValid } = vi.hoisted(() => ({
  mockPrepareSendPayment: vi.fn(),
  mockSendPayment: vi.fn(),
  mockBreezIsAddressValid: vi.fn(),
}));
vi.mock('../../class/wallets/breez-wallet', () => {
  class BreezWallet {
    prepareSendPayment = mockPrepareSendPayment;
    sendPayment = mockSendPayment;
    static isAddressValid = mockBreezIsAddressValid;
  }
  return { BreezWallet };
});

type ToolHandler = (input: any) => Promise<{ content: { text: string }[]; isError?: boolean }>;

function parseToolJson(result: { content: { text: string }[] }): any {
  return JSON.parse(result.content[0].text);
}

const getAddress = vi.fn(async () => 'lq1qfromaddressformcppocket0000000000000');
const getMasterSeed = vi.fn(async () => 'test test test test test test test test test test test junk');
// lazyInitWallet must return an instance of the (mocked) BreezWallet so the handler's
// `instanceof BreezWallet` narrowing passes.
const lazyInitWallet = vi.fn(async () => new BreezWallet('mnemonic' as any, 'mainnet' as any));

function makeFakeDeps(): McpCallDeps {
  return {
    storage: {} as any,
    backgroundCaller: { getAddress, getMasterSeed, lazyInitWallet } as any,
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

// Real curated Liquid token (USDT, 8 decimals) so getTokenInfo resolves without mocking token-list.
const USDT_ASSET = 'ce091c998b83c78bb71a632313ba3760f1763d9cfcffae02258ffa9865a37bd2';
const LIQUID_RECIPIENT = 'lq1qrecipientexampleaddress0000000000000';

describe('MCP transfer_token (Liquid branch)', () => {
  let handlers: Map<string, ToolHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBreezIsAddressValid.mockReturnValue(true);
    mockTokenBalanceFetcher.mockResolvedValue('1000000000000'); // plenty (10000 USDT in base units)
    mockPrepareSendPayment.mockResolvedValue({ feesSat: 26, _prepared: true });
    mockSendPayment.mockResolvedValue({ payment: { txId: 'liquidtxid123' } });
    handlers = buildHandlers(makeFakeDeps());
  });

  it('sends a Liquid token in one step: prepares an asset amount (base units → decimal) then sends', async () => {
    const result = await handlers.get('transfer_token')!({
      network: NETWORK_LIQUID,
      token_id: `  ${USDT_ASSET}  `,
      amount_base_units: '100000000', // 8 decimals → 1.0
      receiver_address: `  ${LIQUID_RECIPIENT}  `,
    });

    expect(result.isError).toBeUndefined();
    const body = parseToolJson(result);
    expect(body.success).toBe(true);
    expect(body.network).toBe(NETWORK_LIQUID);
    expect(body.transfer_id).toBe('liquidtxid123');
    expect(body.token_id).toBe(USDT_ASSET); // trimmed
    expect(body.amount_human_readable).toBe('1'); // 100000000 / 10^8 (USDT, 8 decimals)
    expect(typeof body.amount_ticker).toBe('string'); // token symbol
    expect(body.receiver_address).toBe(LIQUID_RECIPIENT); // trimmed
    expect(body.fee_base_units).toBe('26');
    expect(body.fee_human_readable).toBe('0.00000026'); // 26 sats / 10^8 (L-BTC fee)
    expect(body.fee_ticker).toBe('L-BTC');

    // Always resolved against the dedicated MCP pocket.
    expect(lazyInitWallet).toHaveBeenCalledWith(NETWORK_LIQUID, MCP_BALANCE_ACCOUNT_NUMBER);
    // Base units converted to the SDK's human (decimal) receiver amount; asset id passed verbatim.
    expect(mockPrepareSendPayment).toHaveBeenCalledWith({
      destination: LIQUID_RECIPIENT,
      amount: { type: 'asset', toAsset: USDT_ASSET, receiverAmount: 1 },
    });
    // One-step: sends the prepared payment immediately.
    expect(mockSendPayment).toHaveBeenCalledWith({ prepareResponse: { feesSat: 26, _prepared: true } });
  });

  it('rejects an invalid Liquid receiver address without preparing or sending', async () => {
    mockBreezIsAddressValid.mockReturnValue(false);

    const result = await handlers.get('transfer_token')!({
      network: NETWORK_LIQUID,
      token_id: USDT_ASSET,
      amount_base_units: '100000000',
      receiver_address: 'not-a-liquid-address',
    });

    expect(result.isError).toBe(true);
    expect(parseToolJson(result).error).toMatch(/invalid liquid receiver address/i);
    expect(mockPrepareSendPayment).not.toHaveBeenCalled();
    expect(mockSendPayment).not.toHaveBeenCalled();
  });

  it('blocks a transfer that exceeds the token balance (no send)', async () => {
    mockTokenBalanceFetcher.mockResolvedValueOnce('5');

    const result = await handlers.get('transfer_token')!({
      network: NETWORK_LIQUID,
      token_id: USDT_ASSET,
      amount_base_units: '100000000',
      receiver_address: LIQUID_RECIPIENT,
    });

    expect(result.isError).toBe(true);
    const body = parseToolJson(result);
    expect(body.error).toMatch(/insufficient token balance/i);
    expect(body.balance_base_units).toBe('5');
    expect(mockPrepareSendPayment).not.toHaveBeenCalled();
    expect(mockSendPayment).not.toHaveBeenCalled();
  });

  it('surfaces an SDK send failure as an MCP error, not a throw', async () => {
    mockSendPayment.mockRejectedValueOnce(new Error('Breez sendPayment failed'));

    const result = await handlers.get('transfer_token')!({
      network: NETWORK_LIQUID,
      token_id: USDT_ASSET,
      amount_base_units: '100000000',
      receiver_address: LIQUID_RECIPIENT,
    });

    expect(result.isError).toBe(true);
    const body = parseToolJson(result);
    expect(body.error).toBe('Breez sendPayment failed');
    expect(body.network).toBe(NETWORK_LIQUID);
  });

  it('rejects an unlisted token_id (not in the curated Liquid list) without sending', async () => {
    const result = await handlers.get('transfer_token')!({
      network: NETWORK_LIQUID,
      token_id: 'deadbeefnotarealasset',
      amount_base_units: '100000000',
      receiver_address: LIQUID_RECIPIENT,
    });

    expect(result.isError).toBe(true);
    expect(parseToolJson(result).error).toMatch(/token not found/i);
    expect(mockSendPayment).not.toHaveBeenCalled();
  });
});
