import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { GardenOrder, GardenSwap } from '../../services/garden-api';
import { GardenTransferService, deriveGardenStatus } from '../../services/transfer-service-garden';
import { STORAGE_KEY_GARDEN_TRANSFERS } from '../../types/IStorage';
import { TransferExecution, TransferQuote } from '../../types/transfer';

const BTC_ASSET = 'native:bitcoin' as const;
const BOTANIX_ASSET = 'native:botanix' as const;

function createMockStorage() {
  const store: Record<string, string> = {};
  return {
    _store: store,
    setItem: vi.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    getItem: vi.fn(async (key: string) => store[key] || ''),
  };
}

function makeExecution(overrides: Partial<TransferExecution> = {}): TransferExecution {
  return { id: 'e1', status: 'pending', sendAmount: '0.0005', receiveAmount: '0.000495', sendAsset: BTC_ASSET, receiveAsset: BOTANIX_ASSET, createdAt: 0, ...overrides };
}

function mockFetchResponse(data: any, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
  });
}

function makeSwap(overrides: Partial<GardenSwap> = {}): GardenSwap {
  return {
    swap_id: 'swap-1',
    chain: 'bitcoin',
    asset: 'bitcoin:btc',
    amount: '50000',
    secret_hash: 'abc123',
    initiate_tx_hash: null,
    redeem_tx_hash: null,
    refund_tx_hash: null,
    required_confirmations: 1,
    current_confirmations: 0,
    ...overrides,
  };
}

function makeOrder(overrides: Omit<Partial<GardenOrder>, 'source_swap' | 'destination_swap'> & { source_swap?: Partial<GardenSwap>; destination_swap?: Partial<GardenSwap> } = {}): GardenOrder {
  const { source_swap: srcOverrides, destination_swap: dstOverrides, ...rest } = overrides;
  return {
    order_id: 'order-123',
    created_at: new Date().toISOString(),
    source_swap: makeSwap(srcOverrides),
    destination_swap: makeSwap({ chain: 'botanix', asset: 'botanix:btc', ...dstOverrides }),
    nonce: '1',
    version: '1',
    solver_id: 'solver-1',
    ...rest,
  };
}

describe('GardenTransferService', () => {
  let service: GardenTransferService;
  let storage: ReturnType<typeof createMockStorage>;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    storage = createMockStorage();
    service = new GardenTransferService(storage, 'test-app-id');
    fetchSpy = vi.spyOn(globalThis, 'fetch' as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSupportedPairs', () => {
    it('returns BTC → Botanix pair', () => {
      const pairs = service.getSupportedPairs();
      expect(pairs).toHaveLength(1);
      expect(pairs[0]).toEqual({ sendAssetId: BTC_ASSET, receiveAssetId: BOTANIX_ASSET });
    });
  });

  describe('getQuote', () => {
    it('returns a valid quote', async () => {
      fetchSpy.mockImplementation(() =>
        mockFetchResponse({
          status: 'Ok',
          error: null,
          result: [
            {
              solver_id: 'solver-abc',
              estimated_time: 600,
              source: { asset: 'bitcoin:btc', amount: '50000', display: '0.0005', value: '50' },
              destination: { asset: 'botanix:btc', amount: '49500', display: '0.000495', value: '49.5' },
              slippage: 100,
              fee: 100,
              fixed_fee: '0.5',
            },
          ],
        })
      );

      const quote = await service.getQuote(BTC_ASSET, BOTANIX_ASSET, '0.0005');
      expect(quote.providerQuoteId).toBe('solver-abc');
      expect(quote.sendAmount).toBe('0.0005');
      expect(quote.receiveAmount).toBe('0.000495');
      expect(quote.estimatedTime).toBe(600);
    });

    it('throws when no quote available', async () => {
      fetchSpy.mockImplementation(() =>
        mockFetchResponse({
          status: 'Ok',
          error: null,
          result: [],
        })
      );

      await expect(service.getQuote(BTC_ASSET, BOTANIX_ASSET, '0.0005')).rejects.toThrow('No quote available from Garden');
    });

    it('surfaces API errors', async () => {
      fetchSpy.mockImplementation(() => mockFetchResponse({ status: 'Error', error: 'Amount below minimum' }, false, 400));

      await expect(service.getQuote(BTC_ASSET, BOTANIX_ASSET, '0.0000001')).rejects.toThrow('Amount below minimum');
    });
  });

  describe('executeTransfer', () => {
    const makeQuote = (): TransferQuote => ({
      id: 'garden-123',
      providerQuoteId: 'solver-abc',
      sendAsset: BTC_ASSET,
      receiveAsset: BOTANIX_ASSET,
      sendAmount: '0.0005',
      receiveAmount: '0.000495',
      rate: '1 BTC = 0.99000000 BTC',
      fee: '0.00000500',
      feeTicker: 'BTC',
      estimatedTime: 600,
      expiresAt: Math.floor(Date.now() / 1000) + 300,
    });

    it('creates an order and returns execution with deposit address', async () => {
      fetchSpy.mockImplementation(() =>
        mockFetchResponse({
          status: 'Ok',
          error: null,
          result: {
            order_id: 'order-xyz',
            to: 'bc1qdeposit...',
            amount: '50000',
          },
        })
      );

      const execution = await service.executeTransfer(makeQuote(), '0xSettleBotanix', 'bc1qsource...');
      expect(execution.id).toBe('order-xyz');
      expect(execution.status).toBe('waiting');
      expect(execution.depositAddress).toBe('bc1qdeposit...');
      expect(execution.providerId).toBe('order-xyz');

      // Not persisted yet
      expect(storage._store[STORAGE_KEY_GARDEN_TRANSFERS]).toBeUndefined();

      // Commit persists to storage
      execution.relatedTxids = ['TXID123', 'txid123', ''];
      await service.commitTransfer(execution);
      const stored = JSON.parse(storage._store[STORAGE_KEY_GARDEN_TRANSFERS]);
      expect(stored).toHaveLength(1);
      expect(stored[0].gardenOrderId).toBe('order-xyz');
      expect(stored[0].execution.relatedTxids).toEqual(['txid123']);
    });

    it('throws when fromAddress is missing', async () => {
      await expect(service.executeTransfer(makeQuote(), '0xSettleBotanix')).rejects.toThrow('Garden requires a source address');
    });

    it('throws on expired quote', async () => {
      const expiredQuote = makeQuote();
      expiredQuote.expiresAt = Math.floor(Date.now() / 1000) - 100;

      await expect(service.executeTransfer(expiredQuote, '0xSettleBotanix', 'bc1qsource...')).rejects.toThrow('Quote has expired');
    });
  });

  describe('getOngoingTransfers', () => {
    it('returns empty array when no transfers stored', async () => {
      const result = await service.getOngoingTransfers(0);
      expect(result).toEqual([]);
    });

    it('polls status for non-terminal transfers', async () => {
      storage._store[STORAGE_KEY_GARDEN_TRANSFERS] = JSON.stringify([
        {
          execution: {
            id: 'order-1',
            providerId: 'order-1',
            status: 'waiting',
            sendAmount: '0.0005',
            receiveAmount: '0.000495',
            sendAsset: BTC_ASSET,
            receiveAsset: BOTANIX_ASSET,
            createdAt: Math.floor(Date.now() / 1000),
          },
          gardenOrderId: 'order-1',
          sourceAsset: 'bitcoin:btc',
          destinationAsset: 'botanix:btc',
        },
      ]);

      fetchSpy.mockImplementation(() =>
        mockFetchResponse({
          status: 'Ok',
          error: null,
          result: makeOrder({ source_swap: { initiate_tx_hash: 'tx1' } }),
        })
      );

      const result = await service.getOngoingTransfers(0);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('pending');
    });

    it('detects completed transfers', async () => {
      storage._store[STORAGE_KEY_GARDEN_TRANSFERS] = JSON.stringify([
        {
          execution: {
            id: 'order-1',
            providerId: 'order-1',
            status: 'confirming',
            sendAmount: '0.0005',
            receiveAmount: '0.000495',
            sendAsset: BTC_ASSET,
            receiveAsset: BOTANIX_ASSET,
            createdAt: Math.floor(Date.now() / 1000),
          },
          gardenOrderId: 'order-1',
          sourceAsset: 'bitcoin:btc',
          destinationAsset: 'botanix:btc',
        },
      ]);

      fetchSpy.mockImplementation(() =>
        mockFetchResponse({
          status: 'Ok',
          error: null,
          result: makeOrder({
            source_swap: { initiate_tx_hash: 'tx1' },
            destination_swap: { initiate_tx_hash: 'tx2', redeem_tx_hash: 'tx3' },
          }),
        })
      );

      const result = await service.getOngoingTransfers(0);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('completed');
    });

    it('prunes old terminal transfers from storage', async () => {
      const oldTimestamp = Math.floor(Date.now() / 1000) - 8 * 24 * 60 * 60;
      storage._store[STORAGE_KEY_GARDEN_TRANSFERS] = JSON.stringify([
        {
          execution: {
            id: 'order-old',
            providerId: 'order-old',
            status: 'completed',
            sendAmount: '0.0005',
            receiveAmount: '0.000495',
            sendAsset: BTC_ASSET,
            receiveAsset: BOTANIX_ASSET,
            createdAt: oldTimestamp,
          },
          gardenOrderId: 'order-old',
          sourceAsset: 'bitcoin:btc',
          destinationAsset: 'botanix:btc',
        },
      ]);

      await service.getOngoingTransfers(0);

      const stored = JSON.parse(storage._store[STORAGE_KEY_GARDEN_TRANSFERS]);
      expect(stored).toHaveLength(0);
    });

    it('handles poll failure gracefully', async () => {
      storage._store[STORAGE_KEY_GARDEN_TRANSFERS] = JSON.stringify([
        {
          execution: {
            id: 'order-1',
            providerId: 'order-1',
            status: 'pending',
            sendAmount: '0.0005',
            receiveAmount: '0.000495',
            sendAsset: BTC_ASSET,
            receiveAsset: BOTANIX_ASSET,
            createdAt: Math.floor(Date.now() / 1000),
          },
          gardenOrderId: 'order-1',
          sourceAsset: 'bitcoin:btc',
          destinationAsset: 'botanix:btc',
        },
      ]);

      fetchSpy.mockImplementation(() => mockFetchResponse({ status: 'Error', error: 'Server error' }, false, 500));

      const result = await service.getOngoingTransfers(0);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('pending');
    });

    it('handles corrupt storage gracefully', async () => {
      storage._store[STORAGE_KEY_GARDEN_TRANSFERS] = 'not valid json{{{';

      const result = await service.getOngoingTransfers(0);
      expect(result).toEqual([]);
    });
  });
});

describe('getTrackingUrl', () => {
  let service: GardenTransferService;

  beforeEach(() => {
    service = new GardenTransferService(createMockStorage(), 'test-app-id');
  });

  it('returns Garden explorer URL when providerId exists', () => {
    const url = service.getTrackingUrl(makeExecution({ providerId: 'order-xyz' }));
    expect(url).toBe('https://garden.finance/explorer/?order=order-xyz');
  });

  it('returns undefined when providerId is missing', () => {
    const url = service.getTrackingUrl(makeExecution());
    expect(url).toBeUndefined();
  });
});

describe('deriveGardenStatus', () => {
  it.each([
    [{}, 'waiting'],
    [{ source_swap: { initiate_tx_hash: 'tx1' } }, 'pending'],
    [{ source_swap: { initiate_tx_hash: 'tx1' }, destination_swap: { initiate_tx_hash: 'tx2' } }, 'confirming'],
    [{ source_swap: { initiate_tx_hash: 'tx1' }, destination_swap: { initiate_tx_hash: 'tx2', redeem_tx_hash: 'tx3' } }, 'completed'],
    [{ source_swap: { initiate_tx_hash: 'tx1', refund_tx_hash: 'r1' } }, 'refunded'],
  ])('derives %s → %s', (overrides, expected) => {
    expect(deriveGardenStatus(makeOrder(overrides))).toBe(expected);
  });
});
