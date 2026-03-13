import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { SideshiftShiftStatus } from '../../services/sideshift-api';
import { toSideshiftAsset, isSideshiftSupported, toSideshiftMethodId } from '../../services/sideshift-mappings';
import { SideshiftTransferService, mapSideshiftStatus } from '../../services/transfer-service-sideshift';
import { STORAGE_KEY_SIDESHIFT_TRANSFERS } from '../../types/IStorage';
import { AssetId } from '../../types/asset';
import { TransferExecution, TransferQuote } from '../../types/transfer';

const BTC_ASSET = 'native:bitcoin' as const;
const LBTC_ASSET = 'native:liquid' as const;

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
  return { id: 'e1', status: 'pending', sendAmount: '0.01', receiveAmount: '0.00981', sendAsset: BTC_ASSET, receiveAsset: LBTC_ASSET, createdAt: 0, ...overrides };
}

function mockFetchResponse(data: any, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
  });
}

describe('SideshiftTransferService', () => {
  let service: SideshiftTransferService;
  let storage: ReturnType<typeof createMockStorage>;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    storage = createMockStorage();
    service = new SideshiftTransferService(storage);
    fetchSpy = vi.spyOn(globalThis, 'fetch' as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPairInfo', () => {
    it('returns min/max/rate for a valid pair', async () => {
      fetchSpy.mockImplementation(() =>
        mockFetchResponse({
          min: '0.00007409',
          max: '0.44452242',
          rate: '0.980999391257',
          depositCoin: 'BTC',
          settleCoin: 'BTC',
          depositNetwork: 'bitcoin',
          settleNetwork: 'liquid',
        })
      );

      const info = await service.getPairInfo!(BTC_ASSET, LBTC_ASSET);
      expect(info.min).toBe('0.00007409');
      expect(info.max).toBe('0.44452242');
      expect(info.rate).toBe('0.980999391257');
    });
  });

  describe('getQuote', () => {
    it('returns a valid quote', async () => {
      fetchSpy.mockImplementation(() =>
        mockFetchResponse({
          id: 'quote-abc123',
          depositAmount: '0.01',
          settleAmount: '0.00981',
          rate: '0.981',
          expiresAt: new Date(Date.now() + 900_000).toISOString(),
          depositCoin: 'BTC',
          settleCoin: 'BTC',
          depositNetwork: 'bitcoin',
          settleNetwork: 'liquid',
        })
      );

      const quote = await service.getQuote(BTC_ASSET, LBTC_ASSET, '0.01');
      expect(quote.id).toBe('quote-abc123');
      expect(quote.providerQuoteId).toBe('quote-abc123');
      expect(quote.sendAmount).toBe('0.01');
      expect(quote.receiveAmount).toBe('0.00981');
      expect(quote.expiresAt).toBeGreaterThan(Date.now() / 1000);
    });

    it('surfaces API errors', async () => {
      fetchSpy.mockImplementation(() => mockFetchResponse({ error: { message: 'Amount below minimum' } }, false, 400));

      await expect(service.getQuote(BTC_ASSET, LBTC_ASSET, '0.0000001')).rejects.toThrow('Amount below minimum');
    });
  });

  describe('executeTransfer', () => {
    const makeQuote = (): TransferQuote => ({
      id: 'quote-abc',
      providerQuoteId: 'quote-abc',
      sendAsset: BTC_ASSET,
      receiveAsset: LBTC_ASSET,
      sendAmount: '0.01',
      receiveAmount: '0.00981',
      rate: '1 BTC = 0.981 L-BTC',
      fee: '0',
      feeTicker: 'BTC',
      estimatedTime: 600,
      expiresAt: Math.floor(Date.now() / 1000) + 900,
    });

    it('creates a shift but does not persist until commitTransfer', async () => {
      fetchSpy.mockImplementation(() =>
        mockFetchResponse({
          id: 'shift-xyz',
          status: 'waiting',
          depositAddress: 'bc1qdeposit...',
          settleAddress: 'lq1settle...',
          depositCoin: 'BTC',
          settleCoin: 'BTC',
          depositNetwork: 'bitcoin',
          settleNetwork: 'liquid',
          depositAmount: '0.01',
          settleAmount: '0.00981',
        })
      );

      const execution = await service.executeTransfer(makeQuote(), 'lq1settle...');
      expect(execution.id).toBe('shift-xyz');
      expect(execution.status).toBe('waiting');
      expect(execution.depositAddress).toBe('bc1qdeposit...');
      expect(execution.providerId).toBe('shift-xyz');

      // Not persisted yet
      expect(storage._store[STORAGE_KEY_SIDESHIFT_TRANSFERS]).toBeUndefined();

      // Commit persists to storage
      execution.relatedTxids = ['ABC123', 'abc123', ''];
      await service.commitTransfer(execution);
      const stored = JSON.parse(storage._store[STORAGE_KEY_SIDESHIFT_TRANSFERS]);
      expect(stored).toHaveLength(1);
      expect(stored[0].sideshiftShiftId).toBe('shift-xyz');
      expect(stored[0].execution.relatedTxids).toEqual(['abc123']);
    });

    it('throws on expired quote', async () => {
      const expiredQuote = makeQuote();
      expiredQuote.expiresAt = Math.floor(Date.now() / 1000) - 100;

      await expect(service.executeTransfer(expiredQuote, 'lq1settle...')).rejects.toThrow('Quote has expired');
    });

    it('throws when quote has no providerQuoteId', async () => {
      const quote = makeQuote();
      delete (quote as any).providerQuoteId;

      await expect(service.executeTransfer(quote, 'lq1settle...')).rejects.toThrow('Quote is missing provider quote ID');
    });
  });

  describe('getOngoingTransfers', () => {
    it('returns empty array when no transfers stored', async () => {
      const result = await service.getOngoingTransfers();
      expect(result).toEqual([]);
    });

    it('polls status for non-terminal transfers', async () => {
      // Seed storage with a pending transfer
      storage._store[STORAGE_KEY_SIDESHIFT_TRANSFERS] = JSON.stringify([
        {
          execution: {
            id: 'shift-1',
            providerId: 'shift-1',
            status: 'waiting',

            sendAmount: '0.01',
            receiveAmount: '0.00981',
            sendAsset: BTC_ASSET,
            receiveAsset: LBTC_ASSET,
            createdAt: Math.floor(Date.now() / 1000),
          },
          sideshiftShiftId: 'shift-1',
          depositCoin: 'BTC',
          settleCoin: 'BTC',
          depositNetwork: 'bitcoin',
          settleNetwork: 'liquid',
        },
      ]);

      fetchSpy.mockImplementation(() =>
        mockFetchResponse({
          id: 'shift-1',
          status: 'pending',
          settleAmount: '0.00981',
        })
      );

      const result = await service.getOngoingTransfers();
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('pending');
    });

    it('includes completed transfers in result', async () => {
      storage._store[STORAGE_KEY_SIDESHIFT_TRANSFERS] = JSON.stringify([
        {
          execution: {
            id: 'shift-1',
            providerId: 'shift-1',
            status: 'waiting',

            sendAmount: '0.01',
            receiveAmount: '0.00981',
            sendAsset: BTC_ASSET,
            receiveAsset: LBTC_ASSET,
            createdAt: Math.floor(Date.now() / 1000),
          },
          sideshiftShiftId: 'shift-1',
          depositCoin: 'BTC',
          settleCoin: 'BTC',
          depositNetwork: 'bitcoin',
          settleNetwork: 'liquid',
        },
      ]);

      fetchSpy.mockImplementation(() =>
        mockFetchResponse({
          id: 'shift-1',
          status: 'settled',
          settleAmount: '0.00981',
        })
      );

      const result = await service.getOngoingTransfers();
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('completed');
    });

    it('prunes old terminal transfers from storage', async () => {
      const oldTimestamp = Math.floor(Date.now() / 1000) - 8 * 24 * 60 * 60; // 8 days ago
      storage._store[STORAGE_KEY_SIDESHIFT_TRANSFERS] = JSON.stringify([
        {
          execution: {
            id: 'shift-old',
            providerId: 'shift-old',
            status: 'completed',
            steps: 3,

            sendAmount: '0.01',
            receiveAmount: '0.00981',
            sendAsset: BTC_ASSET,
            receiveAsset: LBTC_ASSET,
            createdAt: oldTimestamp,
          },
          sideshiftShiftId: 'shift-old',
          depositCoin: 'BTC',
          settleCoin: 'BTC',
          depositNetwork: 'bitcoin',
          settleNetwork: 'liquid',
        },
      ]);

      await service.getOngoingTransfers();

      const stored = JSON.parse(storage._store[STORAGE_KEY_SIDESHIFT_TRANSFERS]);
      expect(stored).toHaveLength(0);
    });

    it('handles poll failure gracefully', async () => {
      storage._store[STORAGE_KEY_SIDESHIFT_TRANSFERS] = JSON.stringify([
        {
          execution: {
            id: 'shift-1',
            providerId: 'shift-1',
            status: 'pending',
            steps: 3,

            sendAmount: '0.01',
            receiveAmount: '0.00981',
            sendAsset: BTC_ASSET,
            receiveAsset: LBTC_ASSET,
            createdAt: Math.floor(Date.now() / 1000),
          },
          sideshiftShiftId: 'shift-1',
          depositCoin: 'BTC',
          settleCoin: 'BTC',
          depositNetwork: 'bitcoin',
          settleNetwork: 'liquid',
        },
      ]);

      fetchSpy.mockImplementation(() => mockFetchResponse({ error: { message: 'Server error' } }, false, 500));

      // Should not throw, keeps last known state
      const result = await service.getOngoingTransfers();
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('pending');
    });

    it('handles corrupt storage gracefully', async () => {
      storage._store[STORAGE_KEY_SIDESHIFT_TRANSFERS] = 'not valid json{{{';

      const result = await service.getOngoingTransfers();
      expect(result).toEqual([]);
    });
  });
});

describe('getTrackingUrl', () => {
  let service: SideshiftTransferService;

  beforeEach(() => {
    service = new SideshiftTransferService(createMockStorage());
  });

  it('returns SideShift order URL when providerId exists', () => {
    const url = service.getTrackingUrl(makeExecution({ providerId: 'shift-abc123' }));
    expect(url).toBe('https://sideshift.ai/orders/shift-abc123');
  });

  it('returns undefined when providerId is missing', () => {
    const url = service.getTrackingUrl(makeExecution());
    expect(url).toBeUndefined();
  });
});

describe('mapSideshiftStatus', () => {
  it.each<[SideshiftShiftStatus, string]>([
    ['waiting', 'waiting'],
    ['pending', 'pending'],
    ['processing', 'confirming'],
    ['review', 'confirming'],
    ['settling', 'confirming'],
    ['settled', 'completed'],
    ['refund', 'refunded'],
    ['refunding', 'refunded'],
    ['refunded', 'refunded'],
  ])('maps %s → %s', (input, expected) => {
    expect(mapSideshiftStatus(input)).toBe(expected);
  });
});

describe('sideshift-mappings', () => {
  it.each([
    ['native:bitcoin', { coin: 'BTC', network: 'bitcoin' }],
    ['native:liquid', { coin: 'BTC', network: 'liquid' }],
    ['token:liquid:usdt', { coin: 'USDT', network: 'liquid' }],
    ['native:rootstock', { coin: 'RBTC', network: 'rootstock' }],
    ['token:stacks:stx', { coin: 'STX', network: 'stacks' }],
  ])('toSideshiftAsset(%s)', (assetId, expected) => {
    expect(toSideshiftAsset(assetId as AssetId)).toEqual(expected);
  });

  it('toSideshiftAsset throws for unknown asset', () => {
    expect(() => toSideshiftAsset('native:citrea' as AssetId)).toThrow('not supported by SideShift');
  });

  it('isSideshiftSupported', () => {
    expect(isSideshiftSupported('native:bitcoin' as AssetId)).toBe(true);
    expect(isSideshiftSupported('native:liquid' as AssetId)).toBe(true);
    expect(isSideshiftSupported('native:citrea' as AssetId)).toBe(false);
    expect(isSideshiftSupported('native:spark' as AssetId)).toBe(false);
  });

  it('toSideshiftMethodId', () => {
    expect(toSideshiftMethodId({ coin: 'BTC', network: 'bitcoin' })).toBe('BTC-bitcoin');
    expect(toSideshiftMethodId({ coin: 'RBTC', network: 'rootstock' })).toBe('RBTC-rootstock');
  });
});
