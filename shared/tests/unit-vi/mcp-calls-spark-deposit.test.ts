/**
 * Tests the two on-chain BTC → Spark MCP tools: `get_spark_deposit_address` and `claim_spark_deposit`.
 *
 * Moving native (L1) BTC into the Spark balance is a deposit-address flow, not an instant swap, so it
 * composes the existing Bitcoin send tools: get_spark_deposit_address → get_bitcoin_send_quote →
 * execute_bitcoin_send → (3 confirmations) → claim_spark_deposit. These tools are thin adapters over
 * the SparkWallet's `getOnchainDepositAddress` / `getCommonSwaps` / `getDepositQuote` /
 * `claimDepositSpark`, so we mock `backgroundCaller.lazyInitWallet` to return a fake Spark wallet.
 *
 * These tests pin:
 *  - address: happy path returns the static deposit address + confirmations_required; a non-SparkWallet
 *    is rejected (instanceof guard).
 *  - claim: claims every claimable (>=3 conf) deposit and returns transfer_id + credited sats; a `txid`
 *    arg claims only that one; nothing-claimable returns the pending list with confirmation progress; a
 *    per-deposit claim failure is collected (partial success) while all-failed surfaces as an MCP error.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MCP_BALANCE_ACCOUNT_NUMBER } from '../../hooks/AccountNumberContext';
import { registerWalletMcpCalls } from '../../features/mcp/modules/mcp-calls';
import type { McpCallDeps } from '../../features/mcp/modules/mcp-deps';
import { NETWORK_SPARK } from '../../types/networks';

// Heavy module graph pulled in at import time by mcp-calls.ts — stub it so the surface stays cheap and
// deterministic (mirrors the other mcp-calls unit tests).
vi.mock('@flashnet/sdk', () => ({ FlashnetClient: vi.fn(), isFlashnetError: vi.fn().mockReturnValue(false) }));
vi.mock('@buildonspark/spark-sdk', () => ({ isValidSparkAddress: vi.fn().mockReturnValue(true) }));
vi.mock('../../hooks/useTransferService', () => ({ useTransferService: vi.fn(), getTransferServiceManager: vi.fn(), setFlashnetAccountNumber: vi.fn() }));
vi.mock('../../hooks/useExchangeRate', () => ({ exchangeRateFetcher: vi.fn() }));
vi.mock('../../hooks/useBalance', () => ({ balanceFetcher: vi.fn() }));
vi.mock('../../hooks/useTokenBalance', () => ({ tokenBalanceFetcher: vi.fn() }));
vi.mock('../../features/mcp/modules/mcp-activity-log', () => ({ pushMcpActivityLog: vi.fn() }));
vi.mock('../../modules/wallet-utils', () => ({ validateAddress: vi.fn().mockReturnValue(true) }));
vi.mock('../../blue_modules/BlueElectrum', () => ({ estimateFees: vi.fn(), connectMain: vi.fn(), mainConnected: false }));

// mcp-calls narrows the Spark wallet via `instanceof SparkWallet`, so the fake wallet must be a real
// instance of the (mocked) class. The deposit/claim methods delegate to hoisted spies we drive per-test.
const { mockGetOnchainDepositAddress, mockGetCommonSwaps, mockGetDepositQuote, mockClaimDepositSpark, FakeSparkWallet } = vi.hoisted(() => {
  const mockGetOnchainDepositAddress = vi.fn();
  const mockGetCommonSwaps = vi.fn();
  const mockGetDepositQuote = vi.fn();
  const mockClaimDepositSpark = vi.fn();
  class FakeSparkWallet {
    getOnchainDepositAddress = mockGetOnchainDepositAddress;
    getCommonSwaps = mockGetCommonSwaps;
    getDepositQuote = mockGetDepositQuote;
    claimDepositSpark = mockClaimDepositSpark;
  }
  return { mockGetOnchainDepositAddress, mockGetCommonSwaps, mockGetDepositQuote, mockClaimDepositSpark, FakeSparkWallet };
});
vi.mock('../../class/wallets/spark-wallet', () => ({ SparkWallet: FakeSparkWallet, SPARK_STATIC_DEPOSIT_CONFIRMATIONS: 3 }));

type ToolHandler = (input: any) => Promise<{ content: { text: string }[]; isError?: boolean }>;

function parseToolJson(result: { content: { text: string }[] }): any {
  return JSON.parse(result.content[0].text);
}

const DEPOSIT_ADDRESS = 'bc1qsparkdepositaddress000000000000000000';

const mockLazyInitWallet = vi.fn();
const fakeSparkWallet = new FakeSparkWallet();

function makeFakeDeps(): McpCallDeps {
  return {
    storage: {} as any,
    backgroundCaller: { lazyInitWallet: mockLazyInitWallet, getMasterSeed: vi.fn(), getAddress: vi.fn() } as any,
    showSuccessToast: vi.fn(),
    trackToolCall: vi.fn(),
    trackSwapCompleted: vi.fn(),
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

let deps: McpCallDeps;
let handlers: Map<string, ToolHandler>;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOnchainDepositAddress.mockResolvedValue(DEPOSIT_ADDRESS);
  mockGetCommonSwaps.mockResolvedValue([]);
  mockGetDepositQuote.mockImplementation(async (txid: string) => ({ transactionId: txid, creditAmountSats: 50000, signature: 'sig' }));
  mockClaimDepositSpark.mockResolvedValue('spark_transfer_1');
  mockLazyInitWallet.mockResolvedValue(fakeSparkWallet);
  deps = makeFakeDeps();
  handlers = buildHandlers(deps);
});

describe('MCP get_spark_deposit_address', () => {
  it('returns the static on-chain deposit address + confirmations_required', async () => {
    const result = await handlers.get('get_spark_deposit_address')!({});

    expect(result.isError).toBeUndefined();
    const body = parseToolJson(result);
    expect(body.network).toBe(NETWORK_SPARK);
    expect(body.deposit_address).toBe(DEPOSIT_ADDRESS);
    expect(body.deposit_chain).toBe('bitcoin');
    expect(body.confirmations_required).toBe(3);

    expect(mockLazyInitWallet).toHaveBeenCalledWith(NETWORK_SPARK, MCP_BALANCE_ACCOUNT_NUMBER);
    expect(mockGetOnchainDepositAddress).toHaveBeenCalledTimes(1);
    expect(deps.trackToolCall).toHaveBeenCalledWith('get_spark_deposit_address');
    expect(deps.showSuccessToast).toHaveBeenCalledTimes(1);
  });

  it('rejects a wallet that is not a SparkWallet (instanceof guard)', async () => {
    mockLazyInitWallet.mockResolvedValueOnce({ getOnchainDepositAddress: vi.fn() }); // not a SparkWallet instance

    const result = await handlers.get('get_spark_deposit_address')!({});

    expect(result.isError).toBe(true);
    expect(parseToolJson(result).error).toMatch(/does not support on-chain spark deposits/i);
    expect(mockGetOnchainDepositAddress).not.toHaveBeenCalled();
  });

  it('surfaces a getOnchainDepositAddress failure as an MCP error (not a throw)', async () => {
    mockGetOnchainDepositAddress.mockRejectedValueOnce(new Error('spark sdk not ready'));

    const result = await handlers.get('get_spark_deposit_address')!({});

    expect(result.isError).toBe(true);
    expect(parseToolJson(result).error).toMatch(/spark sdk not ready/i);
    expect(deps.showSuccessToast).not.toHaveBeenCalled();
  });
});

describe('MCP claim_spark_deposit', () => {
  it('claims every claimable (>=3 conf) deposit and returns transfer_id + credited sats', async () => {
    mockGetCommonSwaps.mockResolvedValueOnce([
      { network: NETWORK_SPARK, id: 'txa', status: 'claimable', amount: 50000, direction: 'receive' },
      { network: NETWORK_SPARK, id: 'txb', status: 'claimable', amount: 70000, direction: 'receive' },
      { network: NETWORK_SPARK, id: 'txc', status: 'pending', amount: 90000, confirmations: 1, targetConfirmations: 3, direction: 'receive' },
    ]);
    mockGetDepositQuote
      .mockResolvedValueOnce({ transactionId: 'txa', creditAmountSats: 50000, signature: 's' })
      .mockResolvedValueOnce({ transactionId: 'txb', creditAmountSats: 70000, signature: 's' });
    mockClaimDepositSpark.mockResolvedValueOnce('spark_a').mockResolvedValueOnce('spark_b');

    const result = await handlers.get('claim_spark_deposit')!({});

    expect(result.isError).toBeUndefined();
    const body = parseToolJson(result);
    expect(body.success).toBe(true);
    expect(body.claimed).toHaveLength(2);
    expect(body.claimed[0]).toMatchObject({ txid: 'txa', transfer_id: 'spark_a', credited_base_units: '50000' });
    expect(body.claimed[1]).toMatchObject({ txid: 'txb', transfer_id: 'spark_b', credited_base_units: '70000' });
    expect(body.total_credited_base_units).toBe('120000');
    expect(body.failed).toBeUndefined();

    // The pending one (txc) was never claimed.
    expect(mockGetDepositQuote).toHaveBeenCalledTimes(2);
    expect(mockGetDepositQuote).not.toHaveBeenCalledWith('txc');
    expect(deps.trackToolCall).toHaveBeenCalledWith('claim_spark_deposit');

    // Each claimed deposit is counted as a completed BTC → Spark swap (swap_completed analytics).
    expect(deps.trackSwapCompleted).toHaveBeenCalledTimes(2);
    expect(deps.trackSwapCompleted).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: 'spark_a', serviceName: 'Native', sendAsset: 'native:bitcoin', receiveAsset: 'native:spark', sendAmount: '0.0005', receiveAmount: '0.0005' })
    );
    expect(deps.trackSwapCompleted).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: 'spark_b', sendAmount: '0.0007', receiveAmount: '0.0007' }));
  });

  it('claims only the deposit matching the supplied txid', async () => {
    mockGetCommonSwaps.mockResolvedValueOnce([
      { network: NETWORK_SPARK, id: 'txa', status: 'claimable', amount: 50000, direction: 'receive' },
      { network: NETWORK_SPARK, id: 'txb', status: 'claimable', amount: 70000, direction: 'receive' },
    ]);

    const result = await handlers.get('claim_spark_deposit')!({ txid: ' txb ' });

    expect(result.isError).toBeUndefined();
    const body = parseToolJson(result);
    expect(body.claimed).toHaveLength(1);
    expect(body.claimed[0].txid).toBe('txb');
    expect(mockGetDepositQuote).toHaveBeenCalledTimes(1);
    expect(mockGetDepositQuote).toHaveBeenCalledWith('txb');
  });

  it('returns the pending list with confirmation progress when nothing is claimable', async () => {
    mockGetCommonSwaps.mockResolvedValueOnce([{ network: NETWORK_SPARK, id: 'txp', status: 'pending', amount: 90000, confirmations: 2, targetConfirmations: 3, direction: 'receive' }]);

    const result = await handlers.get('claim_spark_deposit')!({});

    expect(result.isError).toBeUndefined();
    const body = parseToolJson(result);
    expect(body.claimed).toEqual([]);
    expect(body.pending).toHaveLength(1);
    expect(body.pending[0]).toMatchObject({ txid: 'txp', confirmations: 2, target_confirmations: 3, amount_base_units: '90000' });
    expect(mockClaimDepositSpark).not.toHaveBeenCalled();
  });

  it('collects per-deposit failures as partial success', async () => {
    mockGetCommonSwaps.mockResolvedValueOnce([
      { network: NETWORK_SPARK, id: 'txa', status: 'claimable', amount: 50000, direction: 'receive' },
      { network: NETWORK_SPARK, id: 'txb', status: 'claimable', amount: 70000, direction: 'receive' },
    ]);
    mockGetDepositQuote.mockResolvedValueOnce({ transactionId: 'txa', creditAmountSats: 50000, signature: 's' }).mockRejectedValueOnce(new Error('quote expired'));
    mockClaimDepositSpark.mockResolvedValueOnce('spark_a');

    const result = await handlers.get('claim_spark_deposit')!({});

    expect(result.isError).toBeUndefined();
    const body = parseToolJson(result);
    expect(body.success).toBe(true);
    expect(body.claimed).toHaveLength(1);
    expect(body.claimed[0].txid).toBe('txa');
    expect(body.failed).toHaveLength(1);
    expect(body.failed[0]).toMatchObject({ txid: 'txb' });
    expect(body.failed[0].error).toMatch(/quote expired/i);

    // Only the successful claim (txa) counts as a completed swap.
    expect(deps.trackSwapCompleted).toHaveBeenCalledTimes(1);
    expect(deps.trackSwapCompleted).toHaveBeenCalledWith(expect.objectContaining({ id: 'spark_a' }));
  });

  it('surfaces an MCP error when every claim fails', async () => {
    mockGetCommonSwaps.mockResolvedValueOnce([{ network: NETWORK_SPARK, id: 'txa', status: 'claimable', amount: 50000, direction: 'receive' }]);
    mockGetDepositQuote.mockRejectedValueOnce(new Error('sdk down'));

    const result = await handlers.get('claim_spark_deposit')!({});

    expect(result.isError).toBe(true);
    const body = parseToolJson(result);
    expect(body.error).toMatch(/all claim attempts failed/i);
    expect(body.failed[0].error).toMatch(/sdk down/i);
    expect(deps.showSuccessToast).not.toHaveBeenCalled();
    expect(deps.trackSwapCompleted).not.toHaveBeenCalled();
  });

  it('rejects a wallet that is not a SparkWallet (instanceof guard)', async () => {
    mockLazyInitWallet.mockResolvedValueOnce({ getCommonSwaps: vi.fn() }); // not a SparkWallet instance

    const result = await handlers.get('claim_spark_deposit')!({});

    expect(result.isError).toBe(true);
    expect(parseToolJson(result).error).toMatch(/does not support on-chain spark deposits/i);
    expect(mockGetCommonSwaps).not.toHaveBeenCalled();
  });
});
