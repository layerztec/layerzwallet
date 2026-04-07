import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NativeDepositTransferService } from '../../services/transfer-service-native-deposit';
import { STORAGE_KEY_NATIVE_DEPOSIT_TRANSFERS } from '../../types/IStorage';
import { EXECUTION_CLAIM, NativeClaimExecution } from '../../types/transfer';
import { CommonSwap } from '../../types/common-swap';

const TXID = 'abc123deadbeef';

function makeTransfer(overrides: Partial<NativeClaimExecution> = {}): NativeClaimExecution {
  return {
    type: EXECUTION_CLAIM,
    id: 'nd-exec-1',
    status: 'confirming',
    sendAmount: '0.001',
    receiveAmount: '0.001',
    sendAsset: 'native:bitcoin',
    receiveAsset: 'native:spark',
    createdAt: 1700000000,
    updatedAt: 0,
    accountNumber: 0,
    depositAddress: 'bc1q...',
    serviceName: 'Native',
    depositTxid: TXID,
    autoClaim: false,
    autoClaimAttempts: 0,
    ...overrides,
  };
}

function makeSwap(overrides: Partial<CommonSwap> = {}): CommonSwap {
  return {
    id: TXID,
    network: 'spark',
    direction: 'receive',
    status: 'pending',
    amount: 100000,
    timestamp: 1700000000,
    ...overrides,
  };
}

function createMockStorage(transfers: NativeClaimExecution[] = []) {
  const data: Record<string, string> = {};
  if (transfers.length) {
    data[STORAGE_KEY_NATIVE_DEPOSIT_TRANSFERS] = JSON.stringify(transfers);
  }
  return {
    getItem: vi.fn(async (key: string) => data[key] ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      data[key] = value;
    }),
  };
}

describe('NativeDepositTransferService', () => {
  describe('getOngoingTransfers — status transitions', () => {
    it('transitions confirming → claimable when swap is claimable', async () => {
      const transfer = makeTransfer({ status: 'confirming' });
      const storage = createMockStorage([transfer]);
      const service = new NativeDepositTransferService(storage);
      service.setSwapsFetcher(async () => [makeSwap({ status: 'claimable' })]);

      const result = (await service.getOngoingTransfers(0)) as NativeClaimExecution[];

      expect(result[0].status).toBe('claimable');
      expect(result[0].claimSwapJson).toBeDefined();
    });

    it('transitions claimable → completed when swap is confirmed', async () => {
      const transfer = makeTransfer({ status: 'claimable', claimSwapJson: '{}' });
      const storage = createMockStorage([transfer]);
      const service = new NativeDepositTransferService(storage);
      service.setSwapsFetcher(async () => [makeSwap({ status: 'confirmed' })]);

      const result = await service.getOngoingTransfers(0);

      expect(result[0].status).toBe('completed');
      expect(result[0].updatedAt).toBeGreaterThan(0);
    });

    it('matches claimed swap by depositTxid when swap id differs', async () => {
      const transfer = makeTransfer({ status: 'claimable', claimSwapJson: '{}' });
      const storage = createMockStorage([transfer]);
      const service = new NativeDepositTransferService(storage);
      // Claimed swap has a different id (spending tx) but depositTxid matches the original deposit
      service.setSwapsFetcher(async () => [makeSwap({ id: 'spending-tx-different', status: 'confirmed', depositTxid: TXID })]);

      const result = await service.getOngoingTransfers(0);

      expect(result[0].status).toBe('completed');
    });

    it('does not re-poll completed transfers', async () => {
      const transfer = makeTransfer({ status: 'completed', createdAt: Math.floor(Date.now() / 1000) });
      const storage = createMockStorage([transfer]);
      const fetcher = vi.fn(async () => []);
      const service = new NativeDepositTransferService(storage);
      service.setSwapsFetcher(fetcher);

      const result = await service.getOngoingTransfers(0);

      expect(result[0].status).toBe('completed');
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('stays confirming when swap is still pending', async () => {
      const transfer = makeTransfer({ status: 'waiting' });
      const storage = createMockStorage([transfer]);
      const service = new NativeDepositTransferService(storage);
      service.setSwapsFetcher(async () => [makeSwap({ status: 'pending', confirmations: 1, targetConfirmations: 3 })]);

      const result = (await service.getOngoingTransfers(0)) as NativeClaimExecution[];

      expect(result[0].status).toBe('confirming');
      expect(result[0].confirmations).toBe(1);
      expect(result[0].targetConfirmations).toBe(3);
    });

    it('persists status changes to storage', async () => {
      const transfer = makeTransfer({ status: 'claimable', claimSwapJson: '{}' });
      const storage = createMockStorage([transfer]);
      const service = new NativeDepositTransferService(storage);
      service.setSwapsFetcher(async () => [makeSwap({ status: 'confirmed' })]);

      await service.getOngoingTransfers(0);

      expect(storage.setItem).toHaveBeenCalledWith(STORAGE_KEY_NATIVE_DEPOSIT_TRANSFERS, expect.stringContaining('"completed"'));
    });

    it('does not change status for non-waiting transfers without depositTxid', async () => {
      const transfer = makeTransfer({ status: 'confirming', depositTxid: undefined });
      const storage = createMockStorage([transfer]);
      const service = new NativeDepositTransferService(storage);
      service.setSwapsFetcher(async () => [makeSwap()]);

      const result = await service.getOngoingTransfers(0);

      expect(result[0].status).toBe('confirming');
      expect(result[0].depositTxid).toBeUndefined();
    });

    it('discovers swap for waiting transfer without depositTxid', async () => {
      const now = Math.floor(Date.now() / 1000);
      const transfer = makeTransfer({ status: 'waiting', depositTxid: undefined, createdAt: now });
      const storage = createMockStorage([transfer]);
      const service = new NativeDepositTransferService(storage);
      const swapTxid = 'discovered-txid';
      service.setSwapsFetcher(async () => [makeSwap({ id: swapTxid, status: 'pending', timestamp: now * 1000, confirmations: 1, targetConfirmations: 3 })]);

      const result = (await service.getOngoingTransfers(0)) as NativeClaimExecution[];

      expect(result[0].status).toBe('confirming');
      expect(result[0].depositTxid).toBe(swapTxid);
    });

    it('keeps last state on fetcher error', async () => {
      const transfer = makeTransfer({ status: 'confirming' });
      const storage = createMockStorage([transfer]);
      const service = new NativeDepositTransferService(storage);
      service.setSwapsFetcher(async () => {
        throw new Error('network error');
      });

      const result = await service.getOngoingTransfers(0);

      expect(result[0].status).toBe('confirming');
    });
  });

  describe('getTimelineSteps', () => {
    let service: NativeDepositTransferService;

    beforeEach(() => {
      service = new NativeDepositTransferService(createMockStorage());
    });

    it('returns 3 steps for waiting status', () => {
      const steps = service.getTimelineSteps(makeTransfer({ status: 'waiting' }));
      expect(steps).toHaveLength(3);
      expect(steps[0].status).toBe('active');
      expect(steps[1].status).toBe('upcoming');
      expect(steps[2].status).toBe('upcoming');
    });

    it('returns active step 2 for claimable', () => {
      const steps = service.getTimelineSteps(makeTransfer({ status: 'claimable' }));
      expect(steps[0].status).toBe('completed');
      expect(steps[1].status).toBe('active');
      expect(steps[1].title).toBe('Ready to Claim');
      expect(steps[2].status).toBe('upcoming');
    });

    it('returns all completed for completed status', () => {
      const steps = service.getTimelineSteps(makeTransfer({ status: 'completed', updatedAt: 1700001000 }));
      expect(steps[0].status).toBe('completed');
      expect(steps[1].status).toBe('completed');
      expect(steps[1].title).toBe('Claimed');
      expect(steps[2].status).toBe('completed');
    });

    it('shows confirmation count when available', () => {
      const steps = service.getTimelineSteps(makeTransfer({ status: 'confirming', confirmations: 2, targetConfirmations: 3 }));
      expect(steps[0].description).toBe('2/3 confirmations');
    });

    it('returns 3-step timeline for refunded (refund handled on claim screen)', () => {
      const steps = service.getTimelineSteps(makeTransfer({ status: 'refunded', updatedAt: 1700001000 }));
      expect(steps).toHaveLength(3);
      expect(steps[0].title).toBe('Deposit Sent');
      expect(steps[0].status).toBe('completed');
    });
  });

  describe('getOngoingTransfers — refund detection', () => {
    it('transitions to refunded when swap is confirmed + refunded', async () => {
      const transfer = makeTransfer({ status: 'claimable', claimSwapJson: '{}' });
      const storage = createMockStorage([transfer]);
      const service = new NativeDepositTransferService(storage);
      service.setSwapsFetcher(async () => [makeSwap({ status: 'confirmed', refunded: true })]);

      const result = await service.getOngoingTransfers(0);

      expect(result[0].status).toBe('refunded');
      expect(result[0].updatedAt).toBeGreaterThan(0);
    });

    it('does not re-poll refunded transfers', async () => {
      const transfer = makeTransfer({ status: 'refunded', createdAt: Math.floor(Date.now() / 1000) });
      const storage = createMockStorage([transfer]);
      const fetcher = vi.fn(async () => []);
      const service = new NativeDepositTransferService(storage);
      service.setSwapsFetcher(fetcher);

      const result = await service.getOngoingTransfers(0);

      expect(result[0].status).toBe('refunded');
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('persists refunded status to storage', async () => {
      const transfer = makeTransfer({ status: 'confirming' });
      const storage = createMockStorage([transfer]);
      const service = new NativeDepositTransferService(storage);
      service.setSwapsFetcher(async () => [makeSwap({ status: 'confirmed', refunded: true })]);

      await service.getOngoingTransfers(0);

      expect(storage.setItem).toHaveBeenCalledWith(STORAGE_KEY_NATIVE_DEPOSIT_TRANSFERS, expect.stringContaining('"refunded"'));
    });
  });

  describe('auto-claim', () => {
    it('triggers claim executor when autoClaim=true and status becomes claimable', async () => {
      const transfer = makeTransfer({ status: 'confirming', autoClaim: true });
      const storage = createMockStorage([transfer]);
      const claimExecutor = vi.fn(async () => ({ receiveTransferId: 'claim-txid-123', creditAmountSats: 95000 }));
      const service = new NativeDepositTransferService(storage);
      service.setSwapsFetcher(async () => [makeSwap({ status: 'claimable' })]);
      service.setClaimExecutor(claimExecutor);

      const result = (await service.getOngoingTransfers(0)) as NativeClaimExecution[];

      expect(claimExecutor).toHaveBeenCalledOnce();
      expect(result[0].status).toBe('completed');
      expect(result[0].receiveTransferId).toBe('claim-txid-123');
    });

    it('does not trigger claim executor when autoClaim=false', async () => {
      const transfer = makeTransfer({ status: 'confirming', autoClaim: false });
      const storage = createMockStorage([transfer]);
      const claimExecutor = vi.fn(async () => ({ receiveTransferId: 'txid' }));
      const service = new NativeDepositTransferService(storage);
      service.setSwapsFetcher(async () => [makeSwap({ status: 'claimable' })]);
      service.setClaimExecutor(claimExecutor);

      const result = (await service.getOngoingTransfers(0)) as NativeClaimExecution[];

      expect(claimExecutor).not.toHaveBeenCalled();
      expect(result[0].status).toBe('claimable');
    });

    it('increments autoClaimAttempts and sets autoClaimError on failure', async () => {
      const transfer = makeTransfer({ status: 'confirming', autoClaim: true });
      const storage = createMockStorage([transfer]);
      const claimExecutor = vi.fn(async () => {
        throw new Error('SDK timeout');
      });
      const service = new NativeDepositTransferService(storage);
      service.setSwapsFetcher(async () => [makeSwap({ status: 'claimable' })]);
      service.setClaimExecutor(claimExecutor);

      const result = (await service.getOngoingTransfers(0)) as NativeClaimExecution[];

      expect(result[0].status).toBe('claimable');
      expect(result[0].autoClaimAttempts).toBe(1);
      expect(result[0].autoClaimError).toBe('SDK timeout');
    });

    it('stops retrying after MAX_ATTEMPTS', async () => {
      const transfer = makeTransfer({ status: 'confirming', autoClaim: true, autoClaimAttempts: 5 });
      const storage = createMockStorage([transfer]);
      const claimExecutor = vi.fn(async () => ({ receiveTransferId: 'txid' }));
      const service = new NativeDepositTransferService(storage);
      service.setSwapsFetcher(async () => [makeSwap({ status: 'claimable' })]);
      service.setClaimExecutor(claimExecutor);

      const result = (await service.getOngoingTransfers(0)) as NativeClaimExecution[];

      expect(claimExecutor).not.toHaveBeenCalled();
      expect(result[0].status).toBe('claimable');
    });

    it('does not trigger when claim executor is not set', async () => {
      const transfer = makeTransfer({ status: 'confirming', autoClaim: true });
      const storage = createMockStorage([transfer]);
      const service = new NativeDepositTransferService(storage);
      service.setSwapsFetcher(async () => [makeSwap({ status: 'claimable' })]);

      const result = (await service.getOngoingTransfers(0)) as NativeClaimExecution[];

      expect(result[0].status).toBe('claimable');
    });

    it('persists completed status after successful auto-claim', async () => {
      const transfer = makeTransfer({ status: 'confirming', autoClaim: true });
      const storage = createMockStorage([transfer]);
      const service = new NativeDepositTransferService(storage);
      service.setSwapsFetcher(async () => [makeSwap({ status: 'claimable' })]);
      service.setClaimExecutor(async () => ({ receiveTransferId: 'txid' }));

      await service.getOngoingTransfers(0);

      expect(storage.setItem).toHaveBeenCalledWith(STORAGE_KEY_NATIVE_DEPOSIT_TRANSFERS, expect.stringContaining('"completed"'));
    });

    it('processAutoClaims polls accounts with pending auto-claim transfers', async () => {
      const transfer = makeTransfer({ status: 'confirming', autoClaim: true, accountNumber: 2 });
      const storage = createMockStorage([transfer]);
      const claimExecutor = vi.fn(async () => ({ receiveTransferId: 'txid' }));
      const service = new NativeDepositTransferService(storage);
      service.setSwapsFetcher(async () => [makeSwap({ status: 'claimable' })]);
      service.setClaimExecutor(claimExecutor);

      await service.processAutoClaims();

      expect(claimExecutor).toHaveBeenCalledOnce();
    });

    it('processAutoClaims emits completion callback when auto-claim completes', async () => {
      const transfer = makeTransfer({ status: 'confirming', autoClaim: true, accountNumber: 2 });
      const storage = createMockStorage([transfer]);
      const onTransferCompleted = vi.fn();
      const service = new NativeDepositTransferService(storage);
      service.onTransferCompleted = onTransferCompleted;
      service.setSwapsFetcher(async () => [makeSwap({ status: 'claimable' })]);
      service.setClaimExecutor(async () => ({ receiveTransferId: 'txid' }));

      await service.processAutoClaims();

      expect(onTransferCompleted).toHaveBeenCalledOnce();
      expect(onTransferCompleted).toHaveBeenCalledWith(expect.objectContaining({ id: transfer.id, status: 'completed' }));
    });

    it('does not increment attempts on transient "not enough confirmations" error', async () => {
      const transfer = makeTransfer({ status: 'confirming', autoClaim: true });
      const storage = createMockStorage([transfer]);
      const claimExecutor = vi.fn(async () => {
        throw new Error("deposit tx doesn't have enough confirmations: confirmation height: 941335 current block height: 941336");
      });
      const service = new NativeDepositTransferService(storage);
      service.setSwapsFetcher(async () => [makeSwap({ status: 'claimable' })]);
      service.setClaimExecutor(claimExecutor);

      const result = (await service.getOngoingTransfers(0)) as NativeClaimExecution[];

      expect(result[0].autoClaimAttempts).toBe(0);
      expect(result[0].autoClaimError).toBeUndefined();
      expect(result[0].lastAutoClaimAt).toBeUndefined();
    });

    it('skips auto-claim during cooldown period', async () => {
      const now = Math.floor(Date.now() / 1000);
      const transfer = makeTransfer({ status: 'confirming', autoClaim: true, lastAutoClaimAt: now - 60 }); // 60s ago, within 300s cooldown
      const storage = createMockStorage([transfer]);
      const claimExecutor = vi.fn(async () => ({ receiveTransferId: 'txid' }));
      const service = new NativeDepositTransferService(storage);
      service.setSwapsFetcher(async () => [makeSwap({ status: 'claimable' })]);
      service.setClaimExecutor(claimExecutor);

      const result = (await service.getOngoingTransfers(0)) as NativeClaimExecution[];

      expect(claimExecutor).not.toHaveBeenCalled();
      expect(result[0].status).toBe('claimable');
    });

    it('stores receiveTransferId on successful Spark auto-claim', async () => {
      const transfer = makeTransfer({ status: 'confirming', autoClaim: true });
      const storage = createMockStorage([transfer]);
      const service = new NativeDepositTransferService(storage);
      service.setSwapsFetcher(async () => [makeSwap({ status: 'claimable' })]);
      service.setClaimExecutor(async () => ({ receiveTransferId: 'spark-transfer-uuid-123' }));

      const result = (await service.getOngoingTransfers(0)) as NativeClaimExecution[];

      expect(result[0].status).toBe('completed');
      expect(result[0].receiveTransferId).toBe('spark-transfer-uuid-123');
    });

    it('updates receiveAmount from creditAmountSats on successful claim', async () => {
      const transfer = makeTransfer({ status: 'confirming', autoClaim: true, sendAmount: '0.001', receiveAmount: '0.001' });
      const storage = createMockStorage([transfer]);
      const service = new NativeDepositTransferService(storage);
      service.setSwapsFetcher(async () => [makeSwap({ status: 'claimable' })]);
      service.setClaimExecutor(async () => ({ receiveTransferId: 'spark-id', creditAmountSats: 95000 }));

      const result = (await service.getOngoingTransfers(0)) as NativeClaimExecution[];

      expect(result[0].status).toBe('completed');
      expect(result[0].receiveAmount).toBe('0.00095000');
    });

    it('processAutoClaims skips when no autoClaim transfers exist', async () => {
      const transfer = makeTransfer({ status: 'confirming', autoClaim: false });
      const storage = createMockStorage([transfer]);
      const claimExecutor = vi.fn(async () => ({ receiveTransferId: 'txid' }));
      const service = new NativeDepositTransferService(storage);
      service.setSwapsFetcher(async () => [makeSwap({ status: 'claimable' })]);
      service.setClaimExecutor(claimExecutor);

      await service.processAutoClaims();

      expect(claimExecutor).not.toHaveBeenCalled();
    });
  });

  describe('auto-claim timeline', () => {
    let service: NativeDepositTransferService;

    beforeEach(() => {
      service = new NativeDepositTransferService(createMockStorage());
    });

    it('shows Auto-claiming title when autoClaim=true and claimable', () => {
      const steps = service.getTimelineSteps(makeTransfer({ status: 'claimable', autoClaim: true }));
      expect(steps[1].title).toBe('Auto-claiming');
      expect(steps[1].description).toBe('Will be claimed automatically');
    });

    it('shows error in description when auto-claim failed', () => {
      const steps = service.getTimelineSteps(makeTransfer({ status: 'claimable', autoClaim: true, autoClaimError: 'Network error' }));
      expect(steps[1].title).toBe('Auto-claiming');
      expect(steps[1].description).toBe('Network error');
    });

    it('shows manual claim text when autoClaim=false', () => {
      const steps = service.getTimelineSteps(makeTransfer({ status: 'claimable', autoClaim: false }));
      expect(steps[1].title).toBe('Ready to Claim');
      expect(steps[1].description).toBe('Tap Claim to receive your funds');
    });
  });
});
