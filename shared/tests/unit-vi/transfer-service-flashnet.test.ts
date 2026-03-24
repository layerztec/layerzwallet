import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FlashnetTransferService } from '../../services/transfer-service-flashnet';
import { EXECUTION_INSTANT, InstantSwapExecution } from '../../types/transfer';

const mockStorage = {
  getItem: vi.fn().mockResolvedValue(''),
  setItem: vi.fn().mockResolvedValue(undefined),
};

const BTC_SPARK = 'native:spark' as const;
const USDB = 'token:spark:usdb' as const;

function makeExecution(overrides: Partial<InstantSwapExecution> = {}): InstantSwapExecution {
  return {
    type: EXECUTION_INSTANT,
    id: 'flashnet-1',
    status: 'completed',
    sendAmount: '0.001',
    receiveAmount: '99.5',
    sendAsset: BTC_SPARK,
    receiveAsset: USDB,
    createdAt: 0,
    updatedAt: 0,
    accountNumber: 0,
    serviceName: 'Flashnet',
    ...overrides,
  };
}

const MOCK_POOL_ID = 'pool-btc-usdb-123';

function makeMockClient() {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    simulateSwap: vi.fn().mockResolvedValue({
      amountOut: '99500000', // 99.5 USDB (6 decimals)
      executionPrice: '99500',
      priceImpactPct: '0.5',
    }),
    executeSwap: vi.fn().mockResolvedValue({
      amountOut: '99400000', // 99.4 USDB
      outboundTransferId: 'transfer-123',
    }),
    listPools: vi.fn().mockResolvedValue({
      pools: [
        {
          id: 'some-uuid',
          lpPublicKey: MOCK_POOL_ID,
          assetAAddress: '020202020202020202020202020202020202020202020202020202020202020202',
          assetBAddress: '3206c93b24a4d18ea19d0a9a213204af2c7e74a6d16c7535cc5d33eca4ad1eca',
        },
      ],
    }),
  };
}

// Mock @flashnet/sdk
vi.mock('@flashnet/sdk', () => ({
  FlashnetClient: vi.fn().mockImplementation(() => makeMockClient()),
  isFlashnetError: vi.fn().mockReturnValue(false),
}));

describe('FlashnetTransferService', () => {
  let service: FlashnetTransferService;
  let mockWallet: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWallet = { pubkey: 'mock-pubkey' };
    service = new FlashnetTransferService(mockStorage, () => mockWallet);
  });

  describe('getSupportedPairs', () => {
    it('returns BTC↔USDB pairs on Spark', () => {
      const pairs = service.getSupportedPairs();
      expect(pairs).toEqual([
        { sendAssetId: 'native:spark', receiveAssetId: 'token:spark:usdb' },
        { sendAssetId: 'token:spark:usdb', receiveAssetId: 'native:spark' },
      ]);
    });
  });

  describe('getQuote', () => {
    it('returns quote with correct amounts from simulation', async () => {
      const quote = await service.getQuote(BTC_SPARK, USDB, '0.001');

      expect(quote.sendAsset).toBe(BTC_SPARK);
      expect(quote.receiveAsset).toBe(USDB);
      expect(quote.sendAmount).toBe('0.001');
      // 99500000 / 1e6 = 99.500000
      expect(parseFloat(quote.receiveAmount)).toBeCloseTo(99.5, 1);
      expect(quote.rate).toContain('BTC');
      expect(quote.rate).toContain('USDB');
      expect(quote.estimatedTime).toBe(5);
    });

    it('handles USDB→BTC direction', async () => {
      const quote = await service.getQuote(USDB, BTC_SPARK, '100');

      expect(quote.sendAsset).toBe(USDB);
      expect(quote.receiveAsset).toBe(BTC_SPARK);
      expect(quote.sendAmount).toBe('100');
    });

    it('throws when Spark wallet not initialized', async () => {
      const noWalletService = new FlashnetTransferService(mockStorage, () => undefined);
      await expect(noWalletService.getQuote(BTC_SPARK, USDB, '0.001')).rejects.toThrow('Spark wallet not initialized');
    });
  });

  describe('executeTransfer', () => {
    it('returns completed execution without depositAddress', async () => {
      const quote = {
        id: 'test-quote',
        sendAsset: BTC_SPARK,
        receiveAsset: USDB,
        sendAmount: '0.001',
        receiveAmount: '99.500000',
        rate: '1 BTC = 99500 USDB',
        fee: '0',
        feeTicker: 'BTC',
        estimatedTime: 5,
        expiresAt: Math.floor(Date.now() / 1000) + 60,
        serviceName: 'Test',
      };

      const execution = await service.executeTransfer(quote, 0, 'spark-address');

      expect(execution.status).toBe('completed');
      expect(execution.depositAddress).toBeUndefined();
      expect(execution.sendAmount).toBe('0.001');
      expect(execution.sendAsset).toBe(BTC_SPARK);
      expect(execution.receiveAsset).toBe(USDB);
      expect(execution.id).toMatch(/^flashnet-/);
    });
  });

  describe('commitTransfer', () => {
    it('persists transfer to storage', async () => {
      await service.commitTransfer(makeExecution({ id: 'flashnet-123' }));

      expect(mockStorage.setItem).toHaveBeenCalled();
      const saved = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
      expect(saved).toHaveLength(1);
      expect(saved[0].execution.id).toBe('flashnet-123');
    });
  });

  describe('getOngoingTransfers', () => {
    it('returns empty for no stored transfers', async () => {
      const transfers = await service.getOngoingTransfers(0);
      expect(transfers).toEqual([]);
    });

    it('returns stored transfers', async () => {
      const stored = [
        {
          execution: {
            type: EXECUTION_INSTANT,
            id: 'flashnet-1',
            status: 'completed',
            sendAmount: '0.001',
            receiveAmount: '99.5',
            sendAsset: BTC_SPARK,
            receiveAsset: USDB,
            createdAt: Math.floor(Date.now() / 1000),
            updatedAt: 0,
            accountNumber: 0,
            serviceName: 'Flashnet',
          },
        },
      ];
      mockStorage.getItem.mockResolvedValueOnce(JSON.stringify(stored));

      const transfers = await service.getOngoingTransfers(0);
      expect(transfers).toHaveLength(1);
      expect(transfers[0].status).toBe('completed');
    });

    it('prunes old terminal transfers', async () => {
      const oldTime = Math.floor(Date.now() / 1000) - 8 * 24 * 60 * 60; // 8 days ago
      const stored = [
        {
          execution: {
            type: EXECUTION_INSTANT,
            id: 'flashnet-old',
            status: 'completed',
            sendAmount: '0.001',
            receiveAmount: '99.5',
            sendAsset: BTC_SPARK,
            receiveAsset: USDB,
            createdAt: oldTime,
            updatedAt: 0,
            accountNumber: 0,
            serviceName: 'Flashnet',
          },
        },
      ];
      mockStorage.getItem.mockResolvedValueOnce(JSON.stringify(stored));

      const transfers = await service.getOngoingTransfers(0);
      expect(transfers).toHaveLength(0);
    });
  });

  describe('getTimelineSteps', () => {
    it('returns single completed step for completed swap', () => {
      const steps = service.getTimelineSteps(makeExecution({ status: 'completed' }));
      expect(steps).toHaveLength(1);
      expect(steps[0].title).toBe('Swap');
      expect(steps[0].status).toBe('completed');
    });

    it('returns error step for failed swap', () => {
      const steps = service.getTimelineSteps(makeExecution({ status: 'failed' }));
      expect(steps[0].status).toBe('error');
    });
  });
});
