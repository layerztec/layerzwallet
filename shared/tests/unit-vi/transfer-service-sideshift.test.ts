import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { SideshiftShiftStatus, isNetworkOffline } from '../../services/sideshift-api';
import { toSideshiftAsset, isSideshiftSupported, toSideshiftMethodId } from '../../services/sideshift-mappings';
import { SideshiftTransferService, mapSideshiftStatus } from '../../services/transfer-service-sideshift';
import { STORAGE_KEY_SIDESHIFT_TRANSFERS } from '../../types/IStorage';
import { AssetId } from '../../types/asset';
import { DepositAddressExecution, EXECUTION_DEPOSIT, TransferQuote } from '../../types/transfer';

const BTC_ASSET = 'native:bitcoin' as const;
const LBTC_ASSET = 'native:liquid' as const;
const RBTC_ASSET = 'native:rootstock' as const;

const COINS_ONLINE = [
  { coin: 'BTC', networks: ['bitcoin', 'liquid'], name: 'Bitcoin', depositOffline: false, settleOffline: false },
  { coin: 'RBTC', networks: ['rootstock'], name: 'Rootstock', depositOffline: false, settleOffline: false },
];
const COINS_LIQUID_PAUSED = [{ ...COINS_ONLINE[0], depositOffline: ['liquid'], settleOffline: ['liquid'] }, COINS_ONLINE[1]];

const PAIR_OK = {
  min: '0.00007409',
  max: '0.44452242',
  rate: '0.980999391257',
  depositCoin: 'BTC',
  settleCoin: 'BTC',
  depositNetwork: 'bitcoin',
  settleNetwork: 'liquid',
};

const QUOTE_OK = {
  id: 'quote-abc123',
  depositAmount: '0.01',
  settleAmount: '0.00981',
  rate: '0.981',
  expiresAt: new Date(Date.now() + 900_000).toISOString(),
  depositCoin: 'BTC',
  settleCoin: 'BTC',
  depositNetwork: 'bitcoin',
  settleNetwork: 'liquid',
};

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

function makeExecution(overrides: Partial<DepositAddressExecution> = {}): DepositAddressExecution {
  return {
    type: EXECUTION_DEPOSIT,
    id: 'e1',
    status: 'pending',
    sendAmount: '0.01',
    receiveAmount: '0.00981',
    sendAsset: BTC_ASSET,
    receiveAsset: LBTC_ASSET,
    createdAt: 0,
    updatedAt: 0,
    accountNumber: 0,
    serviceName: 'SideShift',
    ...overrides,
  };
}

function mockFetchResponse(data: any, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
  });
}

type Route = { body: any; ok?: boolean; status?: number };

/** Route fetch mock by API path prefix (e.g. '/coins', '/pair', '/quotes'). Unmocked paths get 404. */
function mockFetchByUrl(fetchSpy: ReturnType<typeof vi.spyOn>, routes: Record<string, Route>) {
  fetchSpy.mockImplementation((url: any) => {
    const path = new URL(String(url)).pathname.replace('/api/v2', '');
    const hit = Object.entries(routes).find(([prefix]) => path.startsWith(prefix));
    if (!hit) return mockFetchResponse({ error: { message: `unmocked ${path}` } }, false, 404);
    const { body, ok = true, status = 200 } = hit[1];
    return mockFetchResponse(body, ok, status);
  });
}

function fetchedPaths(fetchSpy: ReturnType<typeof vi.spyOn>): string[] {
  return fetchSpy.mock.calls.map((c) => new URL(String(c[0])).pathname.replace('/api/v2', ''));
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
      mockFetchByUrl(fetchSpy, { '/pair': { body: PAIR_OK } });

      const info = await service.getPairInfo!(BTC_ASSET, LBTC_ASSET);
      expect(info.min).toBe('0.00007409');
      expect(info.max).toBe('0.44452242');
      expect(info.rate).toBe('0.980999391257');
    });
  });

  describe('getQuote', () => {
    it('returns a valid quote', async () => {
      mockFetchByUrl(fetchSpy, { '/coins': { body: COINS_ONLINE }, '/quotes': { body: QUOTE_OK } });

      const quote = await service.getQuote(BTC_ASSET, LBTC_ASSET, '0.01');
      expect(quote.id).toBe('quote-abc123');
      expect(quote.providerQuoteId).toBe('quote-abc123');
      expect(quote.sendAmount).toBe('0.01');
      expect(quote.receiveAmount).toBe('0.00981');
      expect(quote.expiresAt).toBeGreaterThan(Date.now() / 1000);
    });

    it('surfaces API errors', async () => {
      mockFetchByUrl(fetchSpy, { '/coins': { body: COINS_ONLINE }, '/quotes': { body: { error: { message: 'Amount below minimum' } }, ok: false, status: 400 } });

      await expect(service.getQuote(BTC_ASSET, LBTC_ASSET, '0.0000001')).rejects.toThrow('Amount below minimum');
    });

    it('maps SHIFT_UNAVAILABLE from /quotes to a friendly message', async () => {
      mockFetchByUrl(fetchSpy, {
        '/coins': { body: COINS_ONLINE },
        '/quotes': { body: { error: { message: 'Settle method unavailable', code: 'SHIFT_UNAVAILABLE' } }, ok: false, status: 400 },
      });

      await expect(service.getQuote(BTC_ASSET, LBTC_ASSET, '0.01')).rejects.toThrow('BTC → L-BTC is temporarily unavailable');
    });
  });

  describe('offline networks', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('getQuote throws when settle network is paused (array form), even if /quotes succeeds', async () => {
      mockFetchByUrl(fetchSpy, { '/coins': { body: COINS_LIQUID_PAUSED }, '/quotes': { body: QUOTE_OK } });

      await expect(service.getQuote(BTC_ASSET, LBTC_ASSET, '0.01')).rejects.toThrow('L-BTC on Liquid is temporarily unavailable');
    });

    it('getQuote throws when deposit network is paused', async () => {
      mockFetchByUrl(fetchSpy, { '/coins': { body: COINS_LIQUID_PAUSED }, '/quotes': { body: QUOTE_OK } });

      await expect(service.getQuote(LBTC_ASSET, BTC_ASSET, '0.01')).rejects.toThrow('L-BTC on Liquid is temporarily unavailable');
    });

    it('prefers the pause message over a generic /quotes failure', async () => {
      mockFetchByUrl(fetchSpy, {
        '/coins': { body: COINS_LIQUID_PAUSED },
        '/quotes': { body: { error: { message: 'Settle method unavailable', code: 'SHIFT_UNAVAILABLE' } }, ok: false, status: 400 },
      });

      await expect(service.getQuote(BTC_ASSET, LBTC_ASSET, '0.01')).rejects.toThrow('L-BTC on Liquid is temporarily unavailable');
    });

    it('fetches /coins and /quotes in parallel', async () => {
      const started: string[] = [];
      fetchSpy.mockImplementation((url: any) => {
        const path = new URL(String(url)).pathname.replace('/api/v2', '');
        started.push(path);
        return new Promise((resolve) => setTimeout(() => resolve({ ok: true, status: 200, json: () => Promise.resolve(path === '/coins' ? COINS_ONLINE : QUOTE_OK) }), 20));
      });

      const p = service.getQuote(BTC_ASSET, LBTC_ASSET, '0.01');
      await Promise.resolve();
      expect(started).toEqual(['/coins', '/quotes']);
      await p;
    });

    it('getPairInfo does not pre-flight /coins (manager swallows its errors, UI needs pairInfo)', async () => {
      mockFetchByUrl(fetchSpy, { '/coins': { body: COINS_LIQUID_PAUSED }, '/pair': { body: PAIR_OK } });

      const info = await service.getPairInfo!(BTC_ASSET, LBTC_ASSET);
      expect(info.rate).toBe('0.980999391257');
      expect(fetchedPaths(fetchSpy)).not.toContain('/coins');
    });

    it('treats boolean true as paused for a single-network coin', async () => {
      const coins = [COINS_ONLINE[0], { ...COINS_ONLINE[1], settleOffline: true }];
      mockFetchByUrl(fetchSpy, { '/coins': { body: coins }, '/quotes': { body: QUOTE_OK } });

      await expect(service.getQuote(BTC_ASSET, RBTC_ASSET, '0.01')).rejects.toThrow('RBTC on Rootstock is temporarily unavailable');
    });

    it('does not block when a different network of the same coin is paused', async () => {
      mockFetchByUrl(fetchSpy, { '/coins': { body: COINS_LIQUID_PAUSED }, '/quotes': { body: QUOTE_OK } });

      const quote = await service.getQuote(BTC_ASSET, RBTC_ASSET, '0.01');
      expect(quote.id).toBe('quote-abc123');
    });

    it('falls through to /quotes when /coins fails', async () => {
      mockFetchByUrl(fetchSpy, { '/coins': { body: {}, ok: false, status: 500 }, '/quotes': { body: QUOTE_OK } });

      const quote = await service.getQuote(BTC_ASSET, LBTC_ASSET, '0.01');
      expect(quote.id).toBe('quote-abc123');
    });

    it('falls through to /quotes when /coins is a malformed 200 and does not cache it', async () => {
      const routes: Record<string, Route> = { '/coins': { body: {} }, '/quotes': { body: QUOTE_OK } };
      mockFetchByUrl(fetchSpy, routes);

      const quote = await service.getQuote(BTC_ASSET, LBTC_ASSET, '0.01');
      expect(quote.id).toBe('quote-abc123');

      routes['/coins'] = { body: COINS_LIQUID_PAUSED };
      await expect(service.getQuote(BTC_ASSET, LBTC_ASSET, '0.01')).rejects.toThrow('L-BTC on Liquid is temporarily unavailable');
      expect(fetchedPaths(fetchSpy).filter((p) => p === '/coins')).toHaveLength(2);
    });

    it('treats coins missing from /coins as online', async () => {
      mockFetchByUrl(fetchSpy, { '/coins': { body: [] }, '/quotes': { body: QUOTE_OK } });

      const quote = await service.getQuote(BTC_ASSET, LBTC_ASSET, '0.01');
      expect(quote.id).toBe('quote-abc123');
    });

    it('caches /coins within TTL and refetches after it expires', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      mockFetchByUrl(fetchSpy, { '/coins': { body: COINS_ONLINE }, '/quotes': { body: QUOTE_OK } });

      await service.getQuote(BTC_ASSET, LBTC_ASSET, '0.01');
      await service.getQuote(BTC_ASSET, LBTC_ASSET, '0.01');
      expect(fetchedPaths(fetchSpy).filter((p) => p === '/coins')).toHaveLength(1);

      vi.setSystemTime(Date.now() + 5 * 60_000);
      await service.getQuote(BTC_ASSET, LBTC_ASSET, '0.01');
      expect(fetchedPaths(fetchSpy).filter((p) => p === '/coins')).toHaveLength(2);
    });

    it('does not cache a failed /coins fetch', async () => {
      const routes: Record<string, Route> = { '/coins': { body: {}, ok: false, status: 500 }, '/quotes': { body: QUOTE_OK } };
      mockFetchByUrl(fetchSpy, routes);

      await service.getQuote(BTC_ASSET, LBTC_ASSET, '0.01');
      routes['/coins'] = { body: COINS_LIQUID_PAUSED };

      await expect(service.getQuote(BTC_ASSET, LBTC_ASSET, '0.01')).rejects.toThrow('L-BTC on Liquid is temporarily unavailable');
      expect(fetchedPaths(fetchSpy).filter((p) => p === '/coins')).toHaveLength(2);
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
      serviceName: 'Test',
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

      const execution = await service.executeTransfer(makeQuote(), 0, 'lq1settle...');
      expect(execution.id).toBe('shift-xyz');
      expect(execution.status).toBe('waiting');
      expect(execution.depositAddress).toBe('bc1qdeposit...');
      expect(execution.providerId).toBe('shift-xyz');

      // Not persisted yet
      expect(storage._store[STORAGE_KEY_SIDESHIFT_TRANSFERS]).toBeUndefined();

      // Commit persists to storage
      execution.depositTxid = 'abc123';
      await service.commitTransfer(execution);
      const stored = JSON.parse(storage._store[STORAGE_KEY_SIDESHIFT_TRANSFERS]);
      expect(stored).toHaveLength(1);
      expect(stored[0].sideshiftShiftId).toBe('shift-xyz');
      expect(stored[0].execution.depositTxid).toBe('abc123');
    });

    it('throws on expired quote', async () => {
      const expiredQuote = makeQuote();
      expiredQuote.expiresAt = Math.floor(Date.now() / 1000) - 100;

      await expect(service.executeTransfer(expiredQuote, 0, 'lq1settle...')).rejects.toThrow('Quote has expired');
    });

    it('throws when quote has no providerQuoteId', async () => {
      const quote = makeQuote();
      delete (quote as any).providerQuoteId;

      await expect(service.executeTransfer(quote, 0, 'lq1settle...')).rejects.toThrow('Quote is missing provider quote ID');
    });
  });

  describe('getOngoingTransfers', () => {
    it('returns empty array when no transfers stored', async () => {
      const result = await service.getOngoingTransfers(0);
      expect(result).toEqual([]);
    });

    it('polls status for non-terminal transfers', async () => {
      // Seed storage with a pending transfer
      storage._store[STORAGE_KEY_SIDESHIFT_TRANSFERS] = JSON.stringify([
        {
          execution: {
            type: EXECUTION_DEPOSIT,
            id: 'shift-1',
            providerId: 'shift-1',
            status: 'waiting',

            sendAmount: '0.01',
            receiveAmount: '0.00981',
            sendAsset: BTC_ASSET,
            receiveAsset: LBTC_ASSET,
            createdAt: Math.floor(Date.now() / 1000),
            updatedAt: 0,
            accountNumber: 0,
            serviceName: 'SideShift',
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

      const result = await service.getOngoingTransfers(0);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('pending');
    });

    it('includes completed transfers in result', async () => {
      storage._store[STORAGE_KEY_SIDESHIFT_TRANSFERS] = JSON.stringify([
        {
          execution: {
            type: EXECUTION_DEPOSIT,
            id: 'shift-1',
            providerId: 'shift-1',
            status: 'waiting',

            sendAmount: '0.01',
            receiveAmount: '0.00981',
            sendAsset: BTC_ASSET,
            receiveAsset: LBTC_ASSET,
            createdAt: Math.floor(Date.now() / 1000),
            updatedAt: 0,
            accountNumber: 0,
            serviceName: 'SideShift',
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

      const result = await service.getOngoingTransfers(0);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('completed');
    });

    it('prunes old terminal transfers from storage', async () => {
      const oldTimestamp = Math.floor(Date.now() / 1000) - 8 * 24 * 60 * 60; // 8 days ago
      storage._store[STORAGE_KEY_SIDESHIFT_TRANSFERS] = JSON.stringify([
        {
          execution: {
            type: EXECUTION_DEPOSIT,
            id: 'shift-old',
            providerId: 'shift-old',
            status: 'completed',
            steps: 3,

            sendAmount: '0.01',
            receiveAmount: '0.00981',
            sendAsset: BTC_ASSET,
            receiveAsset: LBTC_ASSET,
            createdAt: oldTimestamp,
            updatedAt: 0,
            accountNumber: 0,
            serviceName: 'SideShift',
          },
          sideshiftShiftId: 'shift-old',
          depositCoin: 'BTC',
          settleCoin: 'BTC',
          depositNetwork: 'bitcoin',
          settleNetwork: 'liquid',
        },
      ]);

      await service.getOngoingTransfers(0);

      const stored = JSON.parse(storage._store[STORAGE_KEY_SIDESHIFT_TRANSFERS]);
      expect(stored).toHaveLength(0);
    });

    it('handles poll failure gracefully', async () => {
      storage._store[STORAGE_KEY_SIDESHIFT_TRANSFERS] = JSON.stringify([
        {
          execution: {
            type: EXECUTION_DEPOSIT,
            id: 'shift-1',
            providerId: 'shift-1',
            status: 'pending',
            steps: 3,

            sendAmount: '0.01',
            receiveAmount: '0.00981',
            sendAsset: BTC_ASSET,
            receiveAsset: LBTC_ASSET,
            createdAt: Math.floor(Date.now() / 1000),
            updatedAt: 0,
            accountNumber: 0,
            serviceName: 'SideShift',
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
      const result = await service.getOngoingTransfers(0);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('pending');
    });

    it('handles corrupt storage gracefully', async () => {
      storage._store[STORAGE_KEY_SIDESHIFT_TRANSFERS] = 'not valid json{{{';

      const result = await service.getOngoingTransfers(0);
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

describe('isNetworkOffline', () => {
  it.each<[string[] | boolean | undefined, string, boolean]>([
    [['liquid'], 'liquid', true],
    [['liquid'], 'bitcoin', false],
    [true, 'rootstock', true],
    [false, 'rootstock', false],
    [undefined, 'rootstock', false],
  ])('isNetworkOffline(%j, %s) → %s', (offline, network, expected) => {
    expect(isNetworkOffline(offline, network)).toBe(expected);
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
