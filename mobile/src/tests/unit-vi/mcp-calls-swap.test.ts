/**
 * Tests the MCP `get_swap_quote` / `execute_swap` tools against the **real**
 * `FlashnetTransferService` + `TransferServiceManager`, with only the
 * `@flashnet/sdk` network boundary mocked. This avoids the trap where the
 * test just re-asserts whatever string was stuffed into a mock — assertions
 * here exercise actual BigNumber conversions, direction resolution, the
 * slippage floor, and the `pendingSwaps` replay map.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MCP_BALANCE_ACCOUNT_NUMBER } from '@shared/hooks/AccountNumberContext';
import { registerWalletMcpCalls } from '../../features/mcp/modules/mcp-calls';
import { FlashnetTransferService } from '@shared/services/transfer-service-flashnet';
import { TransferServiceManager } from '@shared/services/transfer-service-manager';

// Constants must match the production code (`transfer-service-flashnet.ts`).
const BTC_PUBKEY = '020202020202020202020202020202020202020202020202020202020202020202';
const USDB_PUBKEY = '3206c93b24a4d18ea19d0a9a213204af2c7e74a6d16c7535cc5d33eca4ad1eca';
const POOL_ID = 'pool-btc-usdb';

// vi.hoisted — vi.mock factories are lifted above imports, so their closures need
// stable references that exist at hoist time. SDK call spies live here so we can
// assert on them from inside tests after vi.clearAllMocks().
const { lazyInitWallet, getSparkWallet, sdkSimulateSwap, sdkExecuteSwap, sdkListPools, sdkInitialize, getTransferServiceManager, setFlashnetAccountNumber, useTransferService } = vi.hoisted(() => ({
  lazyInitWallet: vi.fn().mockResolvedValue(undefined),
  getSparkWallet: vi.fn(),
  sdkSimulateSwap: vi.fn(),
  sdkExecuteSwap: vi.fn(),
  sdkListPools: vi.fn(),
  sdkInitialize: vi.fn().mockResolvedValue(undefined),
  getTransferServiceManager: vi.fn(),
  setFlashnetAccountNumber: vi.fn(),
  useTransferService: vi.fn(),
}));

vi.mock('@flashnet/sdk', () => ({
  FlashnetClient: vi.fn().mockImplementation(() => ({
    initialize: sdkInitialize,
    simulateSwap: sdkSimulateSwap,
    executeSwap: sdkExecuteSwap,
    listPools: sdkListPools,
  })),
  isFlashnetError: vi.fn().mockReturnValue(false),
}));

vi.mock('react-native-toast-message', () => ({ default: { show: vi.fn() } }));
vi.mock('@/src/class/layerz-storage', () => ({ LayerzStorage: { getItem: vi.fn().mockResolvedValue(''), setItem: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('@/src/modules/background-executor', () => ({ BackgroundExecutor: { lazyInitWallet } }));
vi.mock('@/src/modules/analytics', () => ({ AnalyticsEvents: { McpCall: 'mcp_call' }, trackAnalyticsEvent: vi.fn() }));
vi.mock('@shared/hooks/useTransferService', () => ({
  useTransferService,
  getTransferServiceManager,
  setFlashnetAccountNumber,
}));
vi.mock('@shared/hooks/useExchangeRate', () => ({ exchangeRateFetcher: vi.fn() }));
vi.mock('@shared/hooks/useBalance', () => ({ balanceFetcher: vi.fn() }));
vi.mock('../../features/mcp/modules/mcp-activity-log', () => ({ pushMcpActivityLog: vi.fn() }));

type ToolHandler = (input: any) => Promise<{ content: { text: string }[]; isError?: boolean }>;

function parseToolJson(result: { content: { text: string }[] }): any {
  return JSON.parse(result.content[0].text);
}

/**
 * Real Flashnet service backed by a real in-memory storage Map plus the mocked SDK.
 * Each test re-creates them so `pendingSwaps` and persisted transfers are isolated.
 */
function makeRealStack() {
  const storageMap = new Map<string, string>();
  const realStorage = {
    getItem: async (k: string) => storageMap.get(k) ?? '',
    setItem: async (k: string, v: string) => {
      storageMap.set(k, v);
    },
  };
  const flashnet = new FlashnetTransferService(realStorage as any, getSparkWallet);
  const manager = new TransferServiceManager([flashnet]);
  return { flashnet, manager, storageMap };
}

function buildHandlers(): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();
  const fakeServer = {
    registerTool: vi.fn((name: string, _config: unknown, handler: ToolHandler) => {
      handlers.set(name, handler);
    }),
  };
  registerWalletMcpCalls(fakeServer as any);
  return handlers;
}

describe('MCP swap tools', () => {
  let handlers: Map<string, ToolHandler>;
  let flashnet: FlashnetTransferService;
  let manager: TransferServiceManager;

  beforeEach(() => {
    vi.clearAllMocks();
    sdkInitialize.mockResolvedValue(undefined);

    // Same wallet stub for every account number — FlashnetClient is mocked anyway,
    // it never inspects the wallet beyond identity equality (for client reuse).
    const sparkWalletStub = { pubkey: 'spark-stub' };
    getSparkWallet.mockReturnValue(sparkWalletStub);

    // Default SDK responses: BTC -> USDB pool present, simulation gives a healthy quote.
    // Pool is configured at 30 + 10 = 40 bps (0.40%). Fee is computed deterministically as
    // amountIn × totalFeeBps / 10000 — `feePaidAssetIn` on the simulation is not consumed
    // (its real units don't match the SDK's name; see transfer-service-flashnet.ts comment).
    sdkListPools.mockResolvedValue({
      pools: [{ id: 'p', lpPublicKey: POOL_ID, assetAAddress: BTC_PUBKEY, assetBAddress: USDB_PUBKEY, lpFeeBps: 30, hostFeeBps: 10 }],
    });
    sdkSimulateSwap.mockResolvedValue({
      amountOut: '99500000', // 99.5 USDB (6 decimals)
      executionPrice: '99500',
      feePaidAssetIn: '49750', // ignored — left as a realistic value to detect accidental reuse
      priceImpactPct: '0.5',
    });
    sdkExecuteSwap.mockResolvedValue({
      amountOut: '99400000', // 99.4 USDB realized after slippage
    });

    const stack = makeRealStack();
    flashnet = stack.flashnet;
    manager = stack.manager;

    // Wire the production singleton accessors to point at the real services.
    setFlashnetAccountNumber.mockImplementation((n: number) => flashnet.setCurrentAccountNumber(n));
    getTransferServiceManager.mockReturnValue(manager);
    useTransferService.mockReturnValue(manager);

    handlers = buildHandlers();
  });

  describe('get_swap_quote — happy path', () => {
    it('BTC -> USDB: passes correct amount to AMM, returns realized base-unit output', async () => {
      const result = await handlers.get('get_swap_quote')!({
        send_asset: 'native:spark',
        receive_asset: 'token:spark:usdb',
        send_amount_base_units: '100000',
      });

      expect(result.isError).toBeUndefined();

      // SDK invariants — verify the wrapper drove the real Flashnet service correctly.
      // (1) Direction: BTC = assetIn, USDB = assetOut.
      // (2) AMM is queried in smallest units, not human units — so amountIn must stay as '100000'.
      expect(sdkSimulateSwap).toHaveBeenCalledWith({
        poolId: POOL_ID,
        assetInAddress: BTC_PUBKEY,
        assetOutAddress: USDB_PUBKEY,
        amountIn: '100000',
      });

      const body = parseToolJson(result);
      // Real conversion: 99.500000 (human) × 10^6 = 99,500,000 base units USDB.
      expect(body.receive_amount_base_units).toBe('99500000');
      // Fee derived from pool bps: 100,000 sats × 40 bps / 10,000 = 400 sats.
      // Crucially, this is computed from `pool.lpFeeBps + hostFeeBps`, NOT from
      // `simulation.feePaidAssetIn` (49750 in the mock) — if a regression went back to
      // using the simulation field, the assertion would land at 49750 and fail loudly.
      expect(body.fee_base_units).toBe('400');
      expect(body.fee_ticker).toBe('BTC');
      expect(body.fee_asset).toBe('native:spark');
      // 400 / 100000 × 100 = 0.4000% — matches pool's configured 40 bps. Sanity check that
      // the percentage matches the pool config exactly when fee is derived from bps.
      expect(body.effective_fee_rate).toBe('0.4000');
      // 99.5 USDB / 0.001 BTC = 99500.00 USDB per BTC. Always normalized to USDB/BTC,
      // even though we're swapping BTC -> USDB, so the user gets a market-comparable price.
      // A direction-swap bug would land at 0.00001 here.
      expect(body.effective_exchange_rate).toBe('99500.00');
      // priceImpactPct is plumbed straight through (it's slippage info, not a fee).
      expect(body.price_impact_pct).toBe('0.5');
      // quote_id is generated by Flashnet's executeTransfer using `flashnet-${unix}-${rand}`.
      // We don't pin the exact value (it's clock-dependent), only the prefix the AI relies on for execute.
      expect(body.quote_id).toMatch(/^flashnet-\d+-[a-z0-9]+$/);
      expect(body.service).toBe('Flashnet');
    });

    it('USDB -> BTC: reverses direction at the SDK boundary and scales for 6-vs-8 decimals', async () => {
      sdkSimulateSwap.mockResolvedValueOnce({ amountOut: '50000', feePaidAssetIn: '300000', priceImpactPct: '0.1' });

      const result = await handlers.get('get_swap_quote')!({
        send_asset: 'token:spark:usdb',
        receive_asset: 'native:spark',
        send_amount_base_units: '50000000',
      });

      expect(result.isError).toBeUndefined();
      // Direction inverts: USDB is now `assetIn`, BTC is `assetOut`.
      expect(sdkSimulateSwap).toHaveBeenCalledWith({
        poolId: POOL_ID,
        assetInAddress: USDB_PUBKEY,
        assetOutAddress: BTC_PUBKEY,
        amountIn: '50000000',
      });

      const body = parseToolJson(result);
      // 50000 sats from the AMM converts back to '50000' sats base units (no rounding).
      expect(body.receive_amount_base_units).toBe('50000');
      // Fee derived from pool bps: 50,000,000 USDB units × 40 bps / 10,000 = 200,000 USDB units.
      // This is in the INPUT asset's smallest units (USDB) — direction-asymmetric vs the BTC→USDB
      // case which yielded 400 sats. A regression that hardcoded sats or forgot to use the input
      // asset's decimals would fail at one direction or the other.
      expect(body.fee_base_units).toBe('200000');
      expect(body.fee_ticker).toBe('USDB');
      expect(body.fee_asset).toBe('token:spark:usdb');
      // Pool bps are the same in both directions (40 bps), so the percentage is symmetric.
      expect(body.effective_fee_rate).toBe('0.4000');
      // 50 USDB / 0.0005 BTC = 100000.00 USDB per BTC. Different number than the BTC->USDB
      // direction (99500.00), so a bug that always picks `sendAmountHuman / receiveAmount`
      // (i.e. forgets to normalize) would land at 100000 in one direction and 0.00001 in the other.
      expect(body.effective_exchange_rate).toBe('100000.00');
    });
  });

  describe('get_swap_quote — wiring guarantees', () => {
    it('pins all swap activity to MCP_BALANCE_ACCOUNT_NUMBER, even if a UI flow set a different one', async () => {
      // Pretend the UI was on account 7 right before the agent came in.
      flashnet.setCurrentAccountNumber(7);

      await handlers.get('get_swap_quote')!({
        send_asset: 'native:spark',
        receive_asset: 'token:spark:usdb',
        send_amount_base_units: '100000',
      });

      // Spark wallet for the MCP account must have been initialized.
      expect(lazyInitWallet).toHaveBeenCalledWith('spark', MCP_BALANCE_ACCOUNT_NUMBER);

      // FlashnetTransferService.ensureClient resolves its wallet via getSparkWallet(currentAccountNumber).
      // If the wrapper had failed to re-point the service at MCP_BALANCE_ACCOUNT_NUMBER, this would be called with 7.
      expect(getSparkWallet).toHaveBeenCalledWith(MCP_BALANCE_ACCOUNT_NUMBER);
      expect(getSparkWallet).not.toHaveBeenCalledWith(7);
    });

    it('preserves sub-percent precision in effective_fee_rate (1 bps pool renders as "0.0100")', async () => {
      // Mirrors the real Flashnet BTC/USDB pool which is configured at 5 bps; using 1 bps here
      // proves that .toFixed(4) carries enough precision for any realistic AMM tier. If someone
      // regresses to .toFixed(2) this would render "0.01" (3 chars) instead of "0.0100" (6 chars)
      // and fail.
      sdkListPools.mockResolvedValueOnce({
        pools: [{ id: 'p', lpPublicKey: POOL_ID, assetAAddress: BTC_PUBKEY, assetBAddress: USDB_PUBKEY, lpFeeBps: 1, hostFeeBps: 0 }],
      });
      sdkSimulateSwap.mockResolvedValueOnce({ amountOut: '99500000', priceImpactPct: '0' });

      const result = await handlers.get('get_swap_quote')!({
        send_asset: 'native:spark',
        receive_asset: 'token:spark:usdb',
        send_amount_base_units: '100000',
      });

      const body = parseToolJson(result);
      // 100,000 sats × 1 bps / 10,000 = 10 sats. 10 / 100,000 × 100 = 0.0100%.
      expect(body.fee_base_units).toBe('10');
      expect(body.effective_fee_rate).toBe('0.0100');
    });

    it('treats a pool with missing fee bps as zero-fee (no NaN, no crash)', async () => {
      // Defensive: if Flashnet ever changes the AmmPool shape or returns a pool without
      // lpFeeBps/hostFeeBps, we must degrade gracefully — never produce Infinity, NaN, or throw.
      sdkListPools.mockResolvedValueOnce({
        pools: [{ id: 'p', lpPublicKey: POOL_ID, assetAAddress: BTC_PUBKEY, assetBAddress: USDB_PUBKEY }],
      });
      sdkSimulateSwap.mockResolvedValueOnce({ amountOut: '99500000' });

      const result = await handlers.get('get_swap_quote')!({
        send_asset: 'native:spark',
        receive_asset: 'token:spark:usdb',
        send_amount_base_units: '100000',
      });

      expect(result.isError).toBeUndefined();
      const body = parseToolJson(result);
      expect(body.fee_base_units).toBe('0');
      expect(body.price_impact_pct).toBe('0');
      expect(body.effective_fee_rate).toBe('0.0000');
      expect(body.receive_amount_base_units).toBe('99500000');
    });

    it('preserves precision through the base-unit ⇄ human round-trip for 1-sat inputs', async () => {
      // 1 sat is the boundary case: '1' → BigNumber.div(10^8) → '1e-8' → BigNumber.times(10^8).floor → '1'.
      // Regresses if anyone replaces BigNumber with Number (which would round '1e-8' weirdly).
      await handlers.get('get_swap_quote')!({
        send_asset: 'native:spark',
        receive_asset: 'token:spark:usdb',
        send_amount_base_units: '1',
      });
      expect(sdkSimulateSwap).toHaveBeenCalledWith(expect.objectContaining({ amountIn: '1' }));
    });

    it('preserves precision for amounts beyond Number.MAX_SAFE_INTEGER', async () => {
      // 10^18 sats > Number.MAX_SAFE_INTEGER (~9 × 10^15). Any Number-based math would lose digits here.
      const huge = '1000000000000000001'; // 19 digits
      await handlers.get('get_swap_quote')!({
        send_asset: 'native:spark',
        receive_asset: 'token:spark:usdb',
        send_amount_base_units: huge,
      });
      expect(sdkSimulateSwap).toHaveBeenCalledWith(expect.objectContaining({ amountIn: huge }));
    });
  });

  describe('get_swap_quote — rejections', () => {
    it('rejects identical send/receive assets without touching the wallet or AMM', async () => {
      const result = await handlers.get('get_swap_quote')!({
        send_asset: 'native:spark',
        receive_asset: 'native:spark',
        send_amount_base_units: '100000',
      });

      expect(result.isError).toBe(true);
      expect(parseToolJson(result).error).toMatch(/must differ/i);
      expect(lazyInitWallet).not.toHaveBeenCalled();
      expect(sdkSimulateSwap).not.toHaveBeenCalled();
      expect(sdkListPools).not.toHaveBeenCalled();
    });

    it('reports a friendly error when the singleton has not been constructed yet', async () => {
      getTransferServiceManager.mockReturnValueOnce(undefined);

      const result = await handlers.get('get_swap_quote')!({
        send_asset: 'native:spark',
        receive_asset: 'token:spark:usdb',
        send_amount_base_units: '100000',
      });

      expect(result.isError).toBe(true);
      expect(parseToolJson(result).error).toMatch(/not initialized/i);
      // lazyInitWallet runs before the manager check, but the AMM must never be reached.
      expect(sdkSimulateSwap).not.toHaveBeenCalled();
    });

    it('surfaces AMM simulation errors verbatim', async () => {
      sdkSimulateSwap.mockRejectedValueOnce(new Error('Pool unavailable'));

      const result = await handlers.get('get_swap_quote')!({
        send_asset: 'native:spark',
        receive_asset: 'token:spark:usdb',
        send_amount_base_units: '100000',
      });

      expect(result.isError).toBe(true);
      expect(parseToolJson(result).error).toBe('Pool unavailable');
    });

    it('fails the quote if no BTC/USDB pool is published by Flashnet', async () => {
      sdkListPools.mockResolvedValueOnce({ pools: [] });

      const result = await handlers.get('get_swap_quote')!({
        send_asset: 'native:spark',
        receive_asset: 'token:spark:usdb',
        send_amount_base_units: '100000',
      });

      expect(result.isError).toBe(true);
      expect(parseToolJson(result).error).toMatch(/pool not found/i);
      expect(sdkSimulateSwap).not.toHaveBeenCalled();
    });
  });

  describe('execute_swap — happy path', () => {
    it('forwards the staged quote_id to the AMM with the 3% slippage floor and returns realized output', async () => {
      const quoted = await handlers.get('get_swap_quote')!({
        send_asset: 'native:spark',
        receive_asset: 'token:spark:usdb',
        send_amount_base_units: '100000',
      });
      const quoteId = parseToolJson(quoted).quote_id;

      const result = await handlers.get('execute_swap')!({ quote_id: quoteId });

      expect(result.isError).toBeUndefined();
      // Slippage discipline: minAmountOut = floor(99500000 * 0.97) = 96515000.
      // maxSlippageBps must stay at 300 (3%) — change this and the test should fail loudly.
      expect(sdkExecuteSwap).toHaveBeenCalledWith({
        poolId: POOL_ID,
        assetInAddress: BTC_PUBKEY,
        assetOutAddress: USDB_PUBKEY,
        amountIn: '100000',
        minAmountOut: '96515000',
        maxSlippageBps: 300,
      });

      const body = parseToolJson(result);
      // Realized output came from the executeSwap mock (99400000), confirms the
      // wrapper reports realized (not quoted) amounts to the agent.
      expect(body.receive_amount_base_units).toBe('99400000');
      expect(body.send_amount_base_units).toBe('100000');
      expect(body.service).toBe('Flashnet');
    });

    it('trims surrounding whitespace before looking the quote up', async () => {
      const quoted = await handlers.get('get_swap_quote')!({
        send_asset: 'native:spark',
        receive_asset: 'token:spark:usdb',
        send_amount_base_units: '100000',
      });
      const quoteId = parseToolJson(quoted).quote_id;

      const result = await handlers.get('execute_swap')!({ quote_id: `   ${quoteId}   ` });

      expect(result.isError).toBeUndefined();
      expect(sdkExecuteSwap).toHaveBeenCalledTimes(1);
    });
  });

  describe('execute_swap — invariants', () => {
    it('re-pins the Flashnet service to MCP_BALANCE_ACCOUNT_NUMBER even if it drifted between quote and execute', async () => {
      const quoted = await handlers.get('get_swap_quote')!({
        send_asset: 'native:spark',
        receive_asset: 'token:spark:usdb',
        send_amount_base_units: '100000',
      });
      const quoteId = parseToolJson(quoted).quote_id;

      // UI flow sneaks in between quote and execute.
      flashnet.setCurrentAccountNumber(9);
      getSparkWallet.mockClear();

      await handlers.get('execute_swap')!({ quote_id: quoteId });

      // Execute must have asked for the MCP pocket wallet, not 9.
      expect(getSparkWallet).toHaveBeenCalledWith(MCP_BALANCE_ACCOUNT_NUMBER);
      expect(getSparkWallet).not.toHaveBeenCalledWith(9);
    });

    it('replay of the same quote_id is rejected by the real pendingSwaps map', async () => {
      const quoted = await handlers.get('get_swap_quote')!({
        send_asset: 'native:spark',
        receive_asset: 'token:spark:usdb',
        send_amount_base_units: '100000',
      });
      const quoteId = parseToolJson(quoted).quote_id;

      const first = await handlers.get('execute_swap')!({ quote_id: quoteId });
      expect(first.isError).toBeUndefined();
      // Real provider only ran the AMM once — the second call must short-circuit before the SDK.
      expect(sdkExecuteSwap).toHaveBeenCalledTimes(1);

      const second = await handlers.get('execute_swap')!({ quote_id: quoteId });
      expect(second.isError).toBe(true);
      expect(parseToolJson(second).error).toMatch(/no pending swap/i);
      expect(sdkExecuteSwap).toHaveBeenCalledTimes(1);
    });
  });

  describe('execute_swap — error mapping', () => {
    it('errors out cleanly when no quote has been staged with that id', async () => {
      const result = await handlers.get('execute_swap')!({ quote_id: 'flashnet-never-existed' });

      expect(result.isError).toBe(true);
      const body = parseToolJson(result);
      expect(body.error).toMatch(/no pending swap/i);
      expect(body.quote_id).toBe('flashnet-never-existed');
      expect(sdkExecuteSwap).not.toHaveBeenCalled();
    });

    it('surfaces mid-execute AMM errors (e.g. slippage exceeded) and echoes the quote_id', async () => {
      const quoted = await handlers.get('get_swap_quote')!({
        send_asset: 'native:spark',
        receive_asset: 'token:spark:usdb',
        send_amount_base_units: '100000',
      });
      const quoteId = parseToolJson(quoted).quote_id;

      sdkExecuteSwap.mockRejectedValueOnce(new Error('Slippage exceeded'));

      const result = await handlers.get('execute_swap')!({ quote_id: quoteId });

      expect(result.isError).toBe(true);
      const body = parseToolJson(result);
      expect(body.error).toBe('Slippage exceeded');
      expect(body.quote_id).toBe(quoteId);
    });

    it('reports the friendly error when the transfer service manager is not wired', async () => {
      getTransferServiceManager.mockReturnValueOnce(undefined);

      const result = await handlers.get('execute_swap')!({ quote_id: 'flashnet-anything' });

      expect(result.isError).toBe(true);
      expect(parseToolJson(result).error).toMatch(/not initialized/i);
      expect(sdkExecuteSwap).not.toHaveBeenCalled();
    });
  });
});
