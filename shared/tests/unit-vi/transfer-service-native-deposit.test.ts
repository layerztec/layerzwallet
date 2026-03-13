import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NativeDepositTransferService } from '../../services/transfer-service-native-deposit';
import { STORAGE_KEY_NATIVE_DEPOSIT_TRANSFERS } from '../../types/IStorage';
import { TransferExecution } from '../../types/transfer';
import { CommonSwap } from '../../types/common-swap';

const TXID = 'abc123deadbeef';

function makeTransfer(overrides: Partial<TransferExecution> = {}): TransferExecution {
  return {
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
    settleAddress: 'bc1q...',
    serviceName: 'Native',
    relatedTxids: [TXID],
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

function createMockStorage(transfers: TransferExecution[] = []) {
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

      const result = await service.getOngoingTransfers(0);

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

      const result = await service.getOngoingTransfers(0);

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

    it('skips transfers without relatedTxids', async () => {
      const transfer = makeTransfer({ status: 'confirming', relatedTxids: undefined });
      const storage = createMockStorage([transfer]);
      const fetcher = vi.fn(async () => []);
      const service = new NativeDepositTransferService(storage);
      service.setSwapsFetcher(fetcher);

      const result = await service.getOngoingTransfers(0);

      expect(result[0].status).toBe('confirming');
      expect(fetcher).not.toHaveBeenCalled();
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
});
