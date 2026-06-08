/**
 * Tests the Liquid branch of the MCP `transfer_native` tool (native L-BTC on-chain send).
 *
 * This mirrors the UI native L-BTC send (mobile `send/send-amount-liquid.tsx` → `send/send-confirm.tsx`,
 * ext `SendLiquid.tsx`) and the `transfer_token` Liquid branch: L-BTC is just the default Liquid
 * *asset* (`LBTC_ASSET_IDS`), sent via Breez `prepareSendPayment` with `{ type: 'asset', toAsset:
 * <L-BTC asset id>, receiverAmount }` (a human/decimal amount) → `sendPayment`. The MCP `amount_base_units`
 * is in sats, so the handler converts to the decimal `receiverAmount` (amount / 10^8).
 *
 * These tests pin: the asset-style prepare→send native L-BTC path, base-unit→decimal conversion,
 * the L-BTC asset id + L-BTC fee reported back, address validation, trimming, the MCP pocket account
 * number, the `BreezWallet` instance guard, and that SDK errors (incl. insufficient funds) surface
 * as MCP errors (not throws). Balance is enforced by the Breez SDK, so there is no pre-flight check.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MCP_BALANCE_ACCOUNT_NUMBER } from '../../hooks/AccountNumberContext';
import { registerWalletMcpCalls } from '../../features/mcp/modules/mcp-calls';
import type { McpCallDeps } from '../../features/mcp/modules/mcp-deps';
import { BreezWallet } from '../../class/wallets/breez-wallet';
import { NETWORK_LIQUID } from '../../types/networks';

// Heavy module graph pulled in at import time by mcp-calls.ts — stub it so the surface stays
// cheap and deterministic (mirrors mcp-calls-transfer-token-liquid.test.ts).
vi.mock('@flashnet/sdk', () => ({ FlashnetClient: vi.fn(), isFlashnetError: vi.fn().mockReturnValue(false) }));
vi.mock('@buildonspark/spark-sdk', () => ({ isValidSparkAddress: vi.fn().mockReturnValue(true) }));
vi.mock('../../hooks/useTransferService', () => ({ useTransferService: vi.fn(), getTransferServiceManager: vi.fn(), setFlashnetAccountNumber: vi.fn() }));
vi.mock('../../hooks/useExchangeRate', () => ({ exchangeRateFetcher: vi.fn() }));
vi.mock('../../hooks/useTokenBalance', () => ({ tokenBalanceFetcher: vi.fn() }));
vi.mock('../../features/mcp/modules/mcp-activity-log', () => ({ pushMcpActivityLog: vi.fn() }));
vi.mock('../../hooks/useBalance', () => ({ balanceFetcher: vi.fn() }));

// Real mainnet L-BTC asset id — the UI's default Liquid asset. The mock re-exports it so the
// handler and the test agree on the exact value passed to prepareSendPayment.
const LBTC_MAINNET = '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d';

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
  return { BreezWallet, LBTC_ASSET_IDS: { mainnet: '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d', testnet: '144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49' } };
});

type ToolHandler = (input: any) => Promise<{ content: { text: string }[]; isError?: boolean }>;

function parseToolJson(result: { content: { text: string }[] }): any {
  return JSON.parse(result.content[0].text);
}

// lazyInitWallet must return an instance of the (mocked) BreezWallet so the handler's
// `instanceof BreezWallet` narrowing passes.
const lazyInitWallet = vi.fn(async () => new BreezWallet('mnemonic' as any, 'mainnet' as any));

function makeFakeDeps(): McpCallDeps {
  return {
    storage: {} as any,
    backgroundCaller: { lazyInitWallet } as any,
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

const LIQUID_RECIPIENT = 'lq1qrecipientexampleaddress0000000000000';

describe('MCP transfer_native (Liquid branch — native L-BTC)', () => {
  let handlers: Map<string, ToolHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBreezIsAddressValid.mockReturnValue(true);
    mockPrepareSendPayment.mockResolvedValue({ feesSat: 26, _prepared: true });
    mockSendPayment.mockResolvedValue({ payment: { txId: 'liquidnativetxid123' } });
    handlers = buildHandlers(makeFakeDeps());
  });

  it('sends native L-BTC the UI way: prepareSendPayment (asset, base units → decimal) → sendPayment', async () => {
    const deps = makeFakeDeps();
    handlers = buildHandlers(deps);

    const result = await handlers.get('transfer_native')!({
      network: NETWORK_LIQUID,
      amount_base_units: '50000', // 0.0005 L-BTC (8 decimals)
      receiver_address: `  ${LIQUID_RECIPIENT}  `,
    });

    expect(result.isError).toBeUndefined();
    const body = parseToolJson(result);
    expect(body.success).toBe(true);
    expect(body.network).toBe(NETWORK_LIQUID);
    expect(body.transfer_id).toBe('liquidnativetxid123');
    expect(body.amount_base_units).toBe('50000');
    expect(body.receiver_address).toBe(LIQUID_RECIPIENT); // trimmed
    expect(body.fee_base_units).toBe('26');
    expect(body.fee_ticker).toBe('L-BTC');

    // Always resolved against the dedicated MCP pocket.
    expect(lazyInitWallet).toHaveBeenCalledWith(NETWORK_LIQUID, MCP_BALANCE_ACCOUNT_NUMBER);
    // Same shape the UI uses: L-BTC asset id + decimal receiverAmount (sats / 10^8).
    expect(mockPrepareSendPayment).toHaveBeenCalledWith({
      destination: LIQUID_RECIPIENT,
      amount: { type: 'asset', toAsset: LBTC_MAINNET, receiverAmount: 0.0005 },
    });
    // One-step: sends the prepared payment immediately.
    expect(mockSendPayment).toHaveBeenCalledWith({ prepareResponse: { feesSat: 26, _prepared: true } });
    // Success side-effects fire.
    expect(deps.trackToolCall).toHaveBeenCalledWith('transfer_native');
    expect(deps.showSuccessToast).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid Liquid receiver address without preparing or sending', async () => {
    mockBreezIsAddressValid.mockReturnValue(false);

    const result = await handlers.get('transfer_native')!({
      network: NETWORK_LIQUID,
      amount_base_units: '50000',
      receiver_address: 'not-a-liquid-address',
    });

    expect(result.isError).toBe(true);
    expect(parseToolJson(result).error).toMatch(/invalid liquid receiver address/i);
    expect(mockPrepareSendPayment).not.toHaveBeenCalled();
    expect(mockSendPayment).not.toHaveBeenCalled();
  });

  it('rejects a wallet that is not a Breez wallet (instance guard)', async () => {
    lazyInitWallet.mockResolvedValueOnce({ foo: 'not a breez wallet' } as any);

    const result = await handlers.get('transfer_native')!({
      network: NETWORK_LIQUID,
      amount_base_units: '50000',
      receiver_address: LIQUID_RECIPIENT,
    });

    expect(result.isError).toBe(true);
    expect(parseToolJson(result).error).toMatch(/does not support native transfers/i);
    expect(mockPrepareSendPayment).not.toHaveBeenCalled();
    expect(mockSendPayment).not.toHaveBeenCalled();
  });

  it('surfaces an SDK send failure (incl. insufficient funds) as an MCP error, not a throw', async () => {
    mockSendPayment.mockRejectedValueOnce(new Error('InsufficientFunds: balance too low'));

    const result = await handlers.get('transfer_native')!({
      network: NETWORK_LIQUID,
      amount_base_units: '50000',
      receiver_address: LIQUID_RECIPIENT,
    });

    expect(result.isError).toBe(true);
    const body = parseToolJson(result);
    expect(body.error).toBe('InsufficientFunds: balance too low');
    expect(body.network).toBe(NETWORK_LIQUID);
  });
});
