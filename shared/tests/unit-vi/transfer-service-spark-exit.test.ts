import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SparkExitTransferService } from '../../services/transfer-service-spark-exit';
import { STORAGE_KEY_SPARK_EXIT_TRANSFERS } from '../../types/IStorage';
import { EXECUTION_SPARK_EXIT, SparkExitExecution, TransferQuote } from '../../types/transfer';

const SPARK_BTC = 'native:spark' as const;
const BITCOIN = 'native:bitcoin' as const;
const USER_BTC_ADDR = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'; // a different valid mainnet P2WPKH
const PLACEHOLDER_ADDR = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'; // BIP173 spec test vector

/** Build a CoopExitFeeQuote-shaped mock. Each `originalValue` is in sats. */
function makeFeeQuoteFixture(): any {
  return {
    id: 'fee-quote-abc',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    network: 'MAINNET',
    totalAmount: { originalValue: 100_000, originalUnit: 'SATOSHI' },
    userFeeFast: { originalValue: 500, originalUnit: 'SATOSHI' },
    userFeeMedium: { originalValue: 250, originalUnit: 'SATOSHI' },
    userFeeSlow: { originalValue: 100, originalUnit: 'SATOSHI' },
    l1BroadcastFeeFast: { originalValue: 4000, originalUnit: 'SATOSHI' },
    l1BroadcastFeeMedium: { originalValue: 2000, originalUnit: 'SATOSHI' },
    l1BroadcastFeeSlow: { originalValue: 1000, originalUnit: 'SATOSHI' },
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
    typename: 'CoopExitFeeQuote',
  };
}

function makeStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: vi.fn(async (k: string) => map.get(k) ?? ''),
    setItem: vi.fn(async (k: string, v: string) => {
      map.set(k, v);
    }),
  };
}

function makeMockWallet() {
  return {
    getWithdrawalFeeQuote: vi.fn().mockResolvedValue(makeFeeQuoteFixture()),
    withdraw: vi.fn().mockResolvedValue({
      id: 'coop-exit-req-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'INITIATED',
      coopExitTxid: '',
      fee: { originalValue: 250, originalUnit: 'SATOSHI' },
      l1BroadcastFee: { originalValue: 2000, originalUnit: 'SATOSHI' },
      network: 'MAINNET',
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      rawConnectorTransaction: '',
      rawCoopExitTransaction: '',
      typename: 'CoopExitRequest',
    }),
    getCoopExitRequest: vi.fn(),
  };
}

describe('SparkExitTransferService', () => {
  let service: SparkExitTransferService;
  let storage: ReturnType<typeof makeStorage>;
  let mockWallet: ReturnType<typeof makeMockWallet>;

  beforeEach(() => {
    storage = makeStorage();
    mockWallet = makeMockWallet();
    service = new SparkExitTransferService(storage as any, () => mockWallet as any);
    service.setCurrentAccountNumber(0);
  });

  describe('getSupportedPairs', () => {
    it('returns only native:spark → native:bitcoin (Spark→BTC is one-way)', () => {
      const pairs = service.getSupportedPairs();
      expect(pairs).toEqual([{ sendAssetId: SPARK_BTC, receiveAssetId: BITCOIN }]);
    });
  });

  describe('getPairInfo', () => {
    it('returns sensible min/max for the Spark exit', async () => {
      const info = await service.getPairInfo(SPARK_BTC, BITCOIN);
      expect(info).toEqual({ min: '0.00001', max: '1', rate: '1' });
    });
  });

  describe('getQuote', () => {
    it('quotes by calling the SDK with the placeholder address and MEDIUM fees', async () => {
      const quote = await service.getQuote(SPARK_BTC, BITCOIN, '0.001');

      // 0.001 BTC = 100,000 sats
      expect(mockWallet.getWithdrawalFeeQuote).toHaveBeenCalledWith({
        amountSats: 100_000,
        withdrawalAddress: PLACEHOLDER_ADDR,
      });

      // userFeeMedium (250) + l1BroadcastFeeMedium (2000) = 2250 sats
      expect(quote.feeBaseUnits).toBe('2250');
      expect(quote.fee).toBe('0.00002250');
      expect(quote.feeTicker).toBe('BTC');

      // receiveAmount = 100_000 − 2250 = 97_750 sats = 0.0009775 BTC
      expect(quote.receiveAmount).toBe('0.00097750');
      expect(quote.sendAmount).toBe('0.00100000');
      expect(quote.sendAsset).toBe(SPARK_BTC);
      expect(quote.receiveAsset).toBe(BITCOIN);
      expect(quote.serviceName).toBe('SparkExit');
      expect(quote.id).toMatch(/^spark-exit-/);
    });

    it('throws when Spark wallet not initialized', async () => {
      const noWalletService = new SparkExitTransferService(storage as any, () => undefined);
      noWalletService.setCurrentAccountNumber(0);
      await expect(noWalletService.getQuote(SPARK_BTC, BITCOIN, '0.001')).rejects.toThrow('Spark wallet not initialized');
    });

    it('throws when SDK returns null fee quote (e.g. SSP rejected the amount)', async () => {
      mockWallet.getWithdrawalFeeQuote = vi.fn().mockResolvedValue(null);
      await expect(service.getQuote(SPARK_BTC, BITCOIN, '0.001')).rejects.toThrow('Spark withdrawal fee quote unavailable');
    });

    it('does not move any funds — no withdraw() call during quoting', async () => {
      await service.getQuote(SPARK_BTC, BITCOIN, '0.001');
      expect(mockWallet.withdraw).not.toHaveBeenCalled();
    });

    it('throws when a userFee field uses a non-SATOSHI unit (guards against fee mis-pricing)', async () => {
      // A BITCOIN-denominated value read as sats would understate the fee by 1e8 and lose user funds.
      const badQuote = makeFeeQuoteFixture();
      badQuote.userFeeMedium = { originalValue: 0.0000025, originalUnit: 'BITCOIN' };
      mockWallet.getWithdrawalFeeQuote = vi.fn().mockResolvedValue(badQuote);
      await expect(service.getQuote(SPARK_BTC, BITCOIN, '0.001')).rejects.toThrow(/unexpected unit/i);
    });

    it('throws when an l1BroadcastFee field uses a non-SATOSHI unit', async () => {
      const badQuote = makeFeeQuoteFixture();
      badQuote.l1BroadcastFeeMedium = { originalValue: 0.00002, originalUnit: 'MILLIBITCOIN' };
      mockWallet.getWithdrawalFeeQuote = vi.fn().mockResolvedValue(badQuote);
      await expect(service.getQuote(SPARK_BTC, BITCOIN, '0.001')).rejects.toThrow(/unexpected unit/i);
    });

    it('throws when a fee field is missing from the SDK quote (no silent zero-fee)', async () => {
      const badQuote = makeFeeQuoteFixture();
      delete badQuote.userFeeMedium;
      mockWallet.getWithdrawalFeeQuote = vi.fn().mockResolvedValue(badQuote);
      await expect(service.getQuote(SPARK_BTC, BITCOIN, '0.001')).rejects.toThrow(/missing/i);
    });

    it('sets expiresAt from the SDK fee quote, not a fixed 60s window', async () => {
      const sdkExpiry = new Date(Date.now() + 280_000).toISOString();
      const fq = makeFeeQuoteFixture();
      fq.expiresAt = sdkExpiry;
      mockWallet.getWithdrawalFeeQuote = vi.fn().mockResolvedValue(fq);
      const quote = await service.getQuote(SPARK_BTC, BITCOIN, '0.001');
      expect(quote.expiresAt).toBe(Math.floor(new Date(sdkExpiry).getTime() / 1000));
    });

    it('falls back to the staging TTL when the SDK quote expiry is unparseable', async () => {
      const fq = makeFeeQuoteFixture();
      fq.expiresAt = 'not-a-date';
      mockWallet.getWithdrawalFeeQuote = vi.fn().mockResolvedValue(fq);
      const before = Math.floor(Date.now() / 1000);
      const quote = await service.getQuote(SPARK_BTC, BITCOIN, '0.001');
      // PENDING_QUOTE_TTL is 5 minutes — the quote should advertise that, not a stale 60s.
      expect(quote.expiresAt).toBeGreaterThanOrEqual(before + 5 * 60);
      expect(quote.expiresAt).toBeLessThanOrEqual(before + 5 * 60 + 5);
    });
  });

  describe('executeTransfer', () => {
    it('stages params in memory without calling withdraw() — funds do not move yet', async () => {
      const quote = await service.getQuote(SPARK_BTC, BITCOIN, '0.001');
      mockWallet.withdraw.mockClear();

      const execution = await service.executeTransfer(quote, 0, USER_BTC_ADDR);

      expect(execution.type).toBe(EXECUTION_SPARK_EXIT);
      expect(execution.status).toBe('pending');
      expect(execution.depositAddress).toBeUndefined();
      expect(execution.settleAddress).toBe(USER_BTC_ADDR);
      expect(execution.serviceName).toBe('SparkExit');
      expect((execution as SparkExitExecution).coopExitRequestId).toBe('');
      expect((execution as SparkExitExecution).exitSpeed).toBe('MEDIUM');

      // Hard safety invariant: no SDK withdraw call until executeInstantSwap.
      expect(mockWallet.withdraw).not.toHaveBeenCalled();
    });

    it('throws when settleAddress is empty (otherwise the SDK throws a less helpful error later)', async () => {
      const quote = await service.getQuote(SPARK_BTC, BITCOIN, '0.001');
      await expect(service.executeTransfer(quote, 0, '')).rejects.toThrow('Bitcoin destination address is required');
    });

    it('rejects an unknown / expired quote ID', async () => {
      const fakeQuote: TransferQuote = {
        id: 'never-issued',
        sendAsset: SPARK_BTC,
        receiveAsset: BITCOIN,
        sendAmount: '0.001',
        receiveAmount: '0.0009775',
        rate: '1 BTC = 1 BTC',
        fee: '0.0000225',
        feeTicker: 'BTC',
        estimatedTime: 1800,
        expiresAt: Math.floor(Date.now() / 1000) + 60,
        serviceName: 'SparkExit',
      };
      await expect(service.executeTransfer(fakeQuote, 0, USER_BTC_ADDR)).rejects.toThrow('Quote not found or expired');
    });

    it('consumes the quote — re-using it fails on the second call', async () => {
      const quote = await service.getQuote(SPARK_BTC, BITCOIN, '0.001');
      await service.executeTransfer(quote, 0, USER_BTC_ADDR);
      await expect(service.executeTransfer(quote, 0, USER_BTC_ADDR)).rejects.toThrow('Quote not found or expired');
    });

    // The SDK's feeQuoteId is bound to the wallet that produced it. If the user switches accounts
    // between getQuote and Continue, the staged feeQuoteId belongs to the wrong wallet. We must
    // reject loudly rather than carrying a cross-account feeQuoteId into withdraw().
    it('rejects with a clear "re-quote" error when the account changed since the quote', async () => {
      const quote = await service.getQuote(SPARK_BTC, BITCOIN, '0.001'); // staged on account 0

      service.setCurrentAccountNumber(1); // user switched accounts before tapping Continue
      await expect(service.executeTransfer(quote, 1, USER_BTC_ADDR)).rejects.toThrow('Account changed since the quote');

      // The quote must also be consumed so a subsequent attempt fresh-quote, not retry-the-mismatch.
      await expect(service.executeTransfer(quote, 1, USER_BTC_ADDR)).rejects.toThrow('Quote not found or expired');
    });
  });

  describe('executeInstantSwap', () => {
    it('calls SDK withdraw with the user’s real BTC address and the staged fee quote ID', async () => {
      const quote = await service.getQuote(SPARK_BTC, BITCOIN, '0.001');
      const pending = await service.executeTransfer(quote, 0, USER_BTC_ADDR);

      const committed = await service.executeInstantSwap(pending.id);

      expect(mockWallet.withdraw).toHaveBeenCalledWith({
        onchainAddress: USER_BTC_ADDR, // real address — NOT the placeholder used at quote time
        exitSpeed: 'MEDIUM',
        amountSats: 100_000,
        feeQuoteId: 'fee-quote-abc',
        feeAmountSats: 2250,
        deductFeeFromWithdrawalAmount: true,
      });

      expect(committed.type).toBe(EXECUTION_SPARK_EXIT);
      expect(committed.status).toBe('pending'); // SDK returned INITIATED
      expect((committed as SparkExitExecution).coopExitRequestId).toBe('coop-exit-req-1');
      expect(committed.id).toBe(pending.id);
    });

    it('throws for unknown execution id', async () => {
      await expect(service.executeInstantSwap('unknown')).rejects.toThrow('No pending exit found');
    });

    it('cannot be replayed — second call is rejected (double-tap safety)', async () => {
      const quote = await service.getQuote(SPARK_BTC, BITCOIN, '0.001');
      const pending = await service.executeTransfer(quote, 0, USER_BTC_ADDR);

      await service.executeInstantSwap(pending.id);
      await expect(service.executeInstantSwap(pending.id)).rejects.toThrow('No pending exit found');
      expect(mockWallet.withdraw).toHaveBeenCalledTimes(1);
    });

    it('surfaces SDK null return as a clear error rather than silently dropping the operation', async () => {
      mockWallet.withdraw = vi.fn().mockResolvedValue(null);
      const quote = await service.getQuote(SPARK_BTC, BITCOIN, '0.001');
      const pending = await service.executeTransfer(quote, 0, USER_BTC_ADDR);
      await expect(service.executeInstantSwap(pending.id)).rejects.toThrow('SSP returned no exit request');
    });

    it('maps SDK status → TransferStatus and propagates coopExitTxid when present', async () => {
      const cases: [string, string][] = [
        ['INITIATED', 'pending'],
        ['INBOUND_TRANSFER_CHECKED', 'pending'],
        ['TX_SIGNED', 'pending'],
        ['TX_BROADCASTED', 'confirming'],
        ['WAITING_ON_TX_CONFIRMATIONS', 'confirming'],
        ['SUCCEEDED', 'completed'],
        ['EXPIRED', 'expired'],
        ['FAILED', 'failed'],
      ];

      for (const [sdkStatus, expected] of cases) {
        const txid = sdkStatus === 'TX_BROADCASTED' ? 'abc123' : '';
        mockWallet.withdraw = vi.fn().mockResolvedValue({
          id: `req-${sdkStatus}`,
          status: sdkStatus,
          coopExitTxid: txid,
        });
        const quote = await service.getQuote(SPARK_BTC, BITCOIN, '0.001');
        const pending = await service.executeTransfer(quote, 0, USER_BTC_ADDR);
        const committed = await service.executeInstantSwap(pending.id);
        expect(committed.status, `sdk status ${sdkStatus}`).toBe(expected);
        expect((committed as SparkExitExecution).coopExitRequestId, `req id for ${sdkStatus}`).toBe(`req-${sdkStatus}`);
        // coopExitTxid: empty string from SDK should become undefined (downstream code uses truthiness checks).
        expect((committed as SparkExitExecution).coopExitTxid, `txid for ${sdkStatus}`).toBe(txid ? txid : undefined);
      }
    });

    // ─── Fund-safety: account race between stage and confirm ───────────────────────────────────
    // The reviewer flagged that the previous implementation resolved the wallet via
    // `this.currentAccountNumber`, which is mutated externally on every account switch. If the user
    // staged on account 0 and switched to account 1 before tapping Confirm, funds would be debited
    // from the WRONG wallet while the persisted row recorded account 0. The fix wires
    // `executeInstantSwap` to resolve the wallet from `params.accountNumber`. This test would have
    // caught that bug, and locks the invariant in for future refactors.
    it('withdraws from the STAGED account, not the currently active account', async () => {
      const walletAcct0 = makeMockWallet();
      const walletAcct1 = makeMockWallet();
      const walletsByAccount = new Map<number, ReturnType<typeof makeMockWallet>>([
        [0, walletAcct0],
        [1, walletAcct1],
      ]);
      const multiAcctService = new SparkExitTransferService(storage as any, (acct) => walletsByAccount.get(acct) as any);

      // Quote + stage on account 0.
      multiAcctService.setCurrentAccountNumber(0);
      const quote = await multiAcctService.getQuote(SPARK_BTC, BITCOIN, '0.001');
      const pending = await multiAcctService.executeTransfer(quote, 0, USER_BTC_ADDR);

      // User switches to account 1 before tapping Confirm.
      multiAcctService.setCurrentAccountNumber(1);

      const committed = await multiAcctService.executeInstantSwap(pending.id);

      // The withdraw() must have hit account 0's wallet (the staged one), NOT account 1's.
      expect(walletAcct0.withdraw).toHaveBeenCalledTimes(1);
      expect(walletAcct1.withdraw).not.toHaveBeenCalled();
      expect((committed as SparkExitExecution).accountNumber).toBe(0);
    });

    it('throws when the staged account no longer has an initialized wallet', async () => {
      const walletAcct0 = makeMockWallet();
      const walletsByAccount = new Map<number, ReturnType<typeof makeMockWallet>>([[0, walletAcct0]]);
      const restrictedService = new SparkExitTransferService(storage as any, (acct) => walletsByAccount.get(acct) as any);

      restrictedService.setCurrentAccountNumber(0);
      const quote = await restrictedService.getQuote(SPARK_BTC, BITCOIN, '0.001');
      const pending = await restrictedService.executeTransfer(quote, 0, USER_BTC_ADDR);

      // Simulate the staged account's wallet being evicted between stage and confirm.
      walletsByAccount.delete(0);

      await expect(restrictedService.executeInstantSwap(pending.id)).rejects.toThrow('Spark wallet for account 0 is not initialized');
      expect(walletAcct0.withdraw).not.toHaveBeenCalled();
    });

    // ─── Fund-safety: persist BEFORE returning ─────────────────────────────────────────────────
    // The reviewer flagged that the previous version popped pendingExits and returned WITHOUT
    // persisting. If the caller's subsequent `commitTransfer` threw, the `coopExitRequestId` was
    // lost forever. The fix persists inline.
    it('persists the execution inside executeInstantSwap, before returning (caller does NOT need to commit)', async () => {
      const quote = await service.getQuote(SPARK_BTC, BITCOIN, '0.001');
      const pending = await service.executeTransfer(quote, 0, USER_BTC_ADDR);

      // Clear the setItem spy's call history so we can isolate writes done by executeInstantSwap.
      storage.setItem.mockClear();

      const committed = await service.executeInstantSwap(pending.id);

      // The method MUST have written to storage on its own. If a future refactor moves persist
      // back out to the caller, this assertion fails — even though the storage map would still
      // be empty (because we never called commitTransfer in this test).
      expect(storage.setItem, 'executeInstantSwap must persist internally').toHaveBeenCalledWith(STORAGE_KEY_SPARK_EXIT_TRANSFERS, expect.any(String));

      const raw = storage.map.get(STORAGE_KEY_SPARK_EXIT_TRANSFERS);
      const parsed = JSON.parse(raw!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].execution.id).toBe(committed.id);
      expect(parsed[0].execution.coopExitRequestId).toBe('coop-exit-req-1');
      // Asserting the persisted shape would survive a JSON.stringify round-trip — guards against
      // someone accidentally persisting a non-plain object (Map/class instance) that fails reload.
      expect(parsed[0].execution.type).toBe(EXECUTION_SPARK_EXIT);
    });

    it("caller's subsequent commitTransfer is idempotent (upsert by id, no duplicate row)", async () => {
      const quote = await service.getQuote(SPARK_BTC, BITCOIN, '0.001');
      const pending = await service.executeTransfer(quote, 0, USER_BTC_ADDR);
      const committed = await service.executeInstantSwap(pending.id);

      await service.commitTransfer(committed); // simulate confirm.tsx's redundant commit

      const parsed = JSON.parse(storage.map.get(STORAGE_KEY_SPARK_EXIT_TRANSFERS)!);
      expect(parsed).toHaveLength(1); // not 2 — upsert
    });

    // ─── Concurrent-call safety: in-flight guard ───────────────────────────────────────────────
    // A double-tap on the Confirm button (or a re-render that fires the handler twice) must NOT
    // enter the SDK's `withdraw()` twice — that would produce two cooperative exits.
    it('rejects a second executeInstantSwap call FAST while the first is still in-flight (no double-broadcast, no hang)', async () => {
      // Make the first withdraw() hang on a manual promise so we can issue a second call concurrently.
      let release!: (v: any) => void;
      const hang = new Promise((resolve) => {
        release = resolve;
      });
      mockWallet.withdraw = vi.fn().mockReturnValue(hang);

      const quote = await service.getQuote(SPARK_BTC, BITCOIN, '0.001');
      const pending = await service.executeTransfer(quote, 0, USER_BTC_ADDR);

      const first = service.executeInstantSwap(pending.id); // intentionally not awaited
      // Yield a microtask so the first call enters the try block and marks in-flight.
      await Promise.resolve();

      // The second call MUST reject synchronously (before reaching withdraw()), NOT hang waiting
      // on the SDK. We race the call against a 250ms timeout to catch both possible regressions:
      //   - guard removed: call enters withdraw() and awaits the hang → timeout wins → fail
      //   - wrong error thrown: assertion fails on the message
      // Without the timeout race, removing the guard would just hang the suite indefinitely.
      const second = service.executeInstantSwap(pending.id);
      const outcome = await Promise.race([
        second.then(
          () => ({ kind: 'resolved' as const }),
          (e: Error) => ({ kind: 'rejected' as const, message: e.message })
        ),
        new Promise<{ kind: 'timeout' }>((r) => setTimeout(() => r({ kind: 'timeout' }), 250)),
      ]);

      expect(outcome.kind, 'second call must reject synchronously, not hang on SDK').toBe('rejected');
      expect((outcome as { kind: 'rejected'; message: string }).message).toContain('Withdrawal already in progress');

      // Resolve the hanging SDK call so the first promise can settle without leaking.
      release({ id: 'coop-exit-req-1', status: 'INITIATED', coopExitTxid: '' });
      await first;

      // The killer assertion: withdraw() was called exactly once across two executeInstantSwap calls.
      expect(mockWallet.withdraw).toHaveBeenCalledTimes(1);
    });

    // ─── Conservative cleanup on SDK error ────────────────────────────────────────────────────
    // SDK errors are ambiguous (SSP may or may not have committed). To prevent a UI-driven retry
    // from creating a second cooperative exit, we pop pendingExits even on error. The user must
    // re-quote to retry.
    it('pops pendingExits on SDK error, so a retry surfaces "No pending exit found" rather than re-broadcasting', async () => {
      mockWallet.withdraw = vi.fn().mockRejectedValue(new Error('SSP timed out'));

      const quote = await service.getQuote(SPARK_BTC, BITCOIN, '0.001');
      const pending = await service.executeTransfer(quote, 0, USER_BTC_ADDR);

      await expect(service.executeInstantSwap(pending.id)).rejects.toThrow('SSP timed out');

      // Retry must not call withdraw() again — the user must re-quote instead.
      await expect(service.executeInstantSwap(pending.id)).rejects.toThrow('No pending exit found');
      expect(mockWallet.withdraw).toHaveBeenCalledTimes(1);
    });

    // ─── Edge case: persist failure after successful withdraw ──────────────────────────────────
    // Defense-in-depth: even though we log loudly and rethrow, the SDK has committed. Verify that
    // the in-flight guard is cleared on this branch too (otherwise a fresh re-quote→re-confirm
    // would be blocked).
    it('clears in-flight marker when persist fails post-withdraw, so a fresh quote-cycle can proceed', async () => {
      // First call: storage.setItem throws on commit.
      const quote = await service.getQuote(SPARK_BTC, BITCOIN, '0.001');
      const pending = await service.executeTransfer(quote, 0, USER_BTC_ADDR);

      // Make setItem throw exactly once so persist-after-withdraw fails.
      const realSetItem = storage.setItem.getMockImplementation()!;
      let throwOnce = true;
      storage.setItem.mockImplementation(async (k: string, v: string) => {
        if (throwOnce) {
          throwOnce = false;
          throw new Error('AsyncStorage write failed');
        }
        return realSetItem(k, v);
      });

      await expect(service.executeInstantSwap(pending.id)).rejects.toThrow('AsyncStorage write failed');

      // A second, fresh cycle must not be blocked by a leaked in-flight marker.
      mockWallet.withdraw.mockClear();
      const quote2 = await service.getQuote(SPARK_BTC, BITCOIN, '0.001');
      const pending2 = await service.executeTransfer(quote2, 0, USER_BTC_ADDR);
      await expect(service.executeInstantSwap(pending2.id)).resolves.toBeDefined();
    });
  });

  describe('commitTransfer + getOngoingTransfers', () => {
    function makePersistedExecution(overrides: Partial<SparkExitExecution> = {}): SparkExitExecution {
      const now = Math.floor(Date.now() / 1000);
      return {
        type: EXECUTION_SPARK_EXIT,
        id: 'spark-exit-fixture',
        status: 'pending',
        sendAmount: '0.001',
        receiveAmount: '0.0009775',
        sendAsset: SPARK_BTC,
        receiveAsset: BITCOIN,
        createdAt: now,
        updatedAt: now,
        settleAddress: USER_BTC_ADDR,
        accountNumber: 0,
        serviceName: 'SparkExit',
        coopExitRequestId: 'coop-exit-req-1',
        exitSpeed: 'MEDIUM',
        ...overrides,
      };
    }

    it('persists an execution and upserts on subsequent commits with the same id', async () => {
      const exec1 = makePersistedExecution({ status: 'pending' });
      await service.commitTransfer(exec1);

      const exec2 = makePersistedExecution({ status: 'confirming', coopExitTxid: 'L1TX' });
      await service.commitTransfer(exec2);

      const raw = storage.map.get(STORAGE_KEY_SPARK_EXIT_TRANSFERS);
      const parsed = JSON.parse(raw!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].execution.status).toBe('confirming');
      expect(parsed[0].execution.coopExitTxid).toBe('L1TX');
    });

    it('opportunistically refreshes non-terminal transfers and persists the new status', async () => {
      const exec = makePersistedExecution({ status: 'pending' });
      await service.commitTransfer(exec);

      mockWallet.getCoopExitRequest = vi.fn().mockResolvedValue({
        id: 'coop-exit-req-1',
        status: 'TX_BROADCASTED',
        coopExitTxid: 'TX_FRESH',
      });

      const transfers = await service.getOngoingTransfers(0);
      expect(transfers).toHaveLength(1);
      expect(transfers[0].status).toBe('confirming');
      expect((transfers[0] as SparkExitExecution).coopExitTxid).toBe('TX_FRESH');

      // Persisted, so the next poll won't re-hit the SDK for the same change.
      const raw = storage.map.get(STORAGE_KEY_SPARK_EXIT_TRANSFERS);
      expect(raw).toContain('TX_FRESH');
    });

    it('does not refresh terminal transfers (no SDK calls for SUCCEEDED / FAILED)', async () => {
      await service.commitTransfer(makePersistedExecution({ status: 'completed', coopExitTxid: 'final' }));
      mockWallet.getCoopExitRequest = vi.fn();

      await service.getOngoingTransfers(0);
      expect(mockWallet.getCoopExitRequest).not.toHaveBeenCalled();
    });

    it('filters returned transfers AND scopes refresh to the requested account (does not poll the SDK for foreign accounts)', async () => {
      await service.commitTransfer(makePersistedExecution({ id: 'a', accountNumber: 0, coopExitRequestId: 'req-acct-0' }));
      await service.commitTransfer(makePersistedExecution({ id: 'b', accountNumber: 1, coopExitRequestId: 'req-acct-1' }));

      mockWallet.getCoopExitRequest = vi.fn().mockResolvedValue(undefined);

      const acct0 = await service.getOngoingTransfers(0);
      expect(acct0.map((t) => t.id)).toEqual(['a']);
      // The refresh loop must skip the account-1 row when polling for account 0.
      // Without this assertion the filter-only behavior would pass even if refresh had no scoping.
      expect(mockWallet.getCoopExitRequest).toHaveBeenCalledTimes(1);
      expect(mockWallet.getCoopExitRequest).toHaveBeenCalledWith('req-acct-0');

      mockWallet.getCoopExitRequest.mockClear();

      const acct1 = await service.getOngoingTransfers(1);
      expect(acct1.map((t) => t.id)).toEqual(['b']);
      expect(mockWallet.getCoopExitRequest).toHaveBeenCalledTimes(1);
      expect(mockWallet.getCoopExitRequest).toHaveBeenCalledWith('req-acct-1');
    });

    it('prunes terminal transfers older than 7 days', async () => {
      const old = Math.floor(Date.now() / 1000) - 8 * 24 * 60 * 60;
      await service.commitTransfer(makePersistedExecution({ id: 'old', status: 'completed', createdAt: old }));
      await service.commitTransfer(makePersistedExecution({ id: 'fresh', status: 'pending' }));

      const transfers = await service.getOngoingTransfers(0);
      expect(transfers.map((t) => t.id)).toEqual(['fresh']);
    });

    it('survives a transient SDK error during refresh — keeps the existing status and retries next poll', async () => {
      await service.commitTransfer(makePersistedExecution({ status: 'pending' }));
      mockWallet.getCoopExitRequest = vi.fn().mockRejectedValue(new Error('SSP timed out'));

      const transfers = await service.getOngoingTransfers(0);
      expect(transfers[0].status).toBe('pending');
    });

    it('refreshTransferStatus throws for an unknown execution id', async () => {
      await service.commitTransfer(makePersistedExecution({ id: 'real-one' }));
      await expect(service.refreshTransferStatus('unknown', 0)).rejects.toThrow('SparkExit transfer unknown not found');
    });

    it('commitTransfer is a no-op for executions owned by a different service (type guard)', async () => {
      // Manager dispatches commitTransfer to ALL services; ours must ignore non-SparkExit rows.
      const foreignExecution = {
        type: 'deposit-address' as const, // EXECUTION_DEPOSIT — owned by NativeDeposit / SideShift / etc.
        id: 'foreign-1',
        status: 'pending' as const,
        sendAmount: '0.01',
        receiveAmount: '0.01',
        sendAsset: 'native:bitcoin' as const,
        receiveAsset: 'native:spark' as const,
        createdAt: 0,
        updatedAt: 0,
        accountNumber: 0,
        serviceName: 'NativeDeposit',
        depositAddress: 'bc1q...',
      };

      storage.setItem.mockClear();
      await service.commitTransfer(foreignExecution as any);

      // Must not have written anything to OUR storage key.
      expect(storage.setItem).not.toHaveBeenCalled();
      expect(storage.map.get(STORAGE_KEY_SPARK_EXIT_TRANSFERS)).toBeUndefined();
    });
  });

  describe('getTimelineSteps + getTrackingUrl', () => {
    function exec(overrides: Partial<SparkExitExecution>): SparkExitExecution {
      return {
        type: EXECUTION_SPARK_EXIT,
        id: 'x',
        status: 'pending',
        sendAmount: '0.001',
        receiveAmount: '0.0009775',
        sendAsset: SPARK_BTC,
        receiveAsset: BITCOIN,
        createdAt: 0,
        updatedAt: 0,
        accountNumber: 0,
        serviceName: 'SparkExit',
        coopExitRequestId: 'r',
        exitSpeed: 'MEDIUM',
        ...overrides,
      };
    }

    it('returns 3 timeline steps with correct active/completed states', () => {
      const steps = service.getTimelineSteps(exec({ status: 'confirming', coopExitTxid: 'ABCDEF1234567890' }));
      expect(steps).toHaveLength(3);
      expect(steps[0].status).toBe('completed'); // exit initiated
      expect(steps[1].status).toBe('active'); // broadcasted, waiting on confirmations
      expect(steps[2].status).toBe('upcoming'); // not yet confirmed
      // Txid is included in the broadcast step description so the user sees it inline.
      expect(steps[1].description).toContain('ABCDEF1234567890'.slice(0, 12));
    });

    it('omits tracking URL until the L1 txid is known', () => {
      expect(service.getTrackingUrl(exec({ status: 'pending' }))).toBeUndefined();
      expect(service.getTrackingUrl(exec({ status: 'confirming', coopExitTxid: 'TX' }))).toContain('TX');
      expect(service.getTrackingUrl(exec({ status: 'confirming', coopExitTxid: 'TX' }))).toContain('/tx/');
    });

    it('returns terminal state for completed status (step 3 done) and surfaces the L1 txid description on step 2', () => {
      const steps = service.getTimelineSteps(exec({ status: 'completed', coopExitTxid: 'FINALTX567890ABC' }));
      expect(steps[0].status).toBe('completed');
      expect(steps[1].status).toBe('completed');
      expect(steps[2].status).toBe('completed');
      expect(steps[1].description).toContain('FINALTX56789');
    });

    it('marks only step 1 active while still in initiated/pending state with no L1 txid', () => {
      const steps = service.getTimelineSteps(exec({ status: 'pending' }));
      expect(steps[0].status).toBe('completed');
      expect(steps[1].status).toBe('upcoming');
      expect(steps[2].status).toBe('upcoming');
      // Description for step 2 must clearly indicate we're still waiting.
      expect(steps[1].description.toLowerCase()).toContain('waiting');
    });

    // ─── Type-guard coverage ──────────────────────────────────────────────────────────────────
    // Manager dispatches getTimelineSteps / getTrackingUrl across all services. Each service
    // must ignore executions it doesn't own. Removing those guards must be a test failure.
    it('getTimelineSteps returns [] for non-SparkExit executions', () => {
      const foreign: any = {
        type: 'deposit-address',
        id: 'x',
        status: 'pending',
        sendAmount: '0',
        receiveAmount: '0',
        sendAsset: SPARK_BTC,
        receiveAsset: BITCOIN,
        createdAt: 0,
        updatedAt: 0,
        accountNumber: 0,
        serviceName: 'NativeDeposit',
      };
      expect(service.getTimelineSteps(foreign)).toEqual([]);
    });

    it('getTrackingUrl returns undefined for non-SparkExit executions even when they carry a txid', () => {
      const foreign: any = {
        type: 'deposit-address',
        id: 'x',
        status: 'pending',
        sendAmount: '0',
        receiveAmount: '0',
        sendAsset: SPARK_BTC,
        receiveAsset: BITCOIN,
        createdAt: 0,
        updatedAt: 0,
        accountNumber: 0,
        serviceName: 'NativeDeposit',
        depositTxid: 'NOT_OURS',
      };
      expect(service.getTrackingUrl(foreign)).toBeUndefined();
    });
  });
});
