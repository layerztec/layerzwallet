import { describe, it, expect, beforeAll } from 'vitest';
import { isNetworkOffline, SideshiftApi } from '../../services/sideshift-api';
import { toSideshiftAsset } from '../../services/sideshift-mappings';
import { SideshiftTransferService } from '../../services/transfer-service-sideshift';
import { IStorage } from '../../types/IStorage';
import { AssetId } from '../../types/asset';

const AFFILIATE_ID = 'uYB9AagC9';

const mockStorage: Record<string, string> = {};
const storage: IStorage = {
  getItem: async (key: string) => mockStorage[key] ?? null,
  setItem: async (key: string, value: string) => {
    mockStorage[key] = value;
  },
};

const BTC_ASSET: AssetId = 'native:bitcoin';
const RBTC_ASSET: AssetId = 'native:rootstock';

function isGeoBlocked(e: any): boolean {
  return e?.message?.includes('Access denied') || e?.statusCode === 403;
}

describe('SideShift API integration', () => {
  let geoBlocked = false;

  beforeAll(async () => {
    try {
      const api = new SideshiftApi(AFFILIATE_ID);
      await api.createQuote({ depositCoin: 'BTC', depositNetwork: 'bitcoin', settleCoin: 'RBTC', settleNetwork: 'rootstock', depositAmount: '0.001' });
    } catch (e: any) {
      if (isGeoBlocked(e)) {
        geoBlocked = true;
        console.log('SideShift geo-restricted in this region — skipping POST-dependent tests');
      }
    }
  });
  it('GET /coins exposes offline fields', async () => {
    const api = new SideshiftApi(AFFILIATE_ID);
    const coins = await api.getCoins();
    expect(coins.length).toBeGreaterThan(0);
    for (const c of coins) {
      for (const field of [c.depositOffline, c.settleOffline]) {
        expect(Array.isArray(field) || typeof field === 'boolean' || field === undefined).toBe(true);
      }
    }
    for (const assetId of [BTC_ASSET, RBTC_ASSET]) {
      const { coin, network } = toSideshiftAsset(assetId);
      const entry = coins.find((c) => c.coin === coin);
      expect(entry, `${coin} missing from /coins`).toBeDefined();
      expect(entry!.networks).toContain(network);
    }
  });

  it('GET /pair works for BTC-bitcoin/RBTC-rootstock', async () => {
    const api = new SideshiftApi(AFFILIATE_ID);
    const pair = await api.getPair('BTC-bitcoin', 'RBTC-rootstock');
    console.log('Pair info:', JSON.stringify(pair, null, 2));
    expect(pair).toBeDefined();
    expect(pair.rate).not.toBeNull();
    expect(parseFloat(pair.rate!)).toBeGreaterThan(0);
    expect(pair.min).not.toBeNull();
    expect(pair.max).not.toBeNull();
  });

  it('POST /quotes for BTC→RBTC', async () => {
    if (geoBlocked) return;
    const api = new SideshiftApi(AFFILIATE_ID);
    const quote = await api.createQuote({
      depositCoin: 'BTC',
      depositNetwork: 'bitcoin',
      settleCoin: 'RBTC',
      settleNetwork: 'rootstock',
      depositAmount: '0.01',
    });
    console.log('Quote response:', JSON.stringify(quote, null, 2));
    expect(quote.id).toBeDefined();
    expect(quote.rate).toBeDefined();
  });

  it('getQuote for BTC→RBTC', async () => {
    if (geoBlocked) return;
    const service = new SideshiftTransferService(storage, AFFILIATE_ID);
    const quote = await service.getQuote(BTC_ASSET, RBTC_ASSET, '0.01');
    console.log('Quote result:', JSON.stringify(quote, null, 2));
    expect(quote).toBeDefined();
    expect(quote.sendAmount).toBe('0.01');
    expect(parseFloat(quote.receiveAmount)).toBeGreaterThan(0);
    expect(quote.rate).toBeDefined();
  });

  it('getSupportedPairs returns pairs', () => {
    const service = new SideshiftTransferService(storage, AFFILIATE_ID);
    const pairs = service.getSupportedPairs();
    console.log('Supported pairs:', pairs.length);
    expect(pairs.length).toBeGreaterThan(0);
  });

  it('getQuote reports a paused settle network with a friendly error', async () => {
    if (geoBlocked) return;
    const service = new SideshiftTransferService(storage, AFFILIATE_ID);
    const coins = await new SideshiftApi(AFFILIATE_ID).getCoins();
    const receiveAssets = [...new Set(service.getSupportedPairs().map((p) => p.receiveAssetId))];
    const paused = receiveAssets.find((id) => {
      if (id === BTC_ASSET) return false;
      const { coin, network } = toSideshiftAsset(id);
      return isNetworkOffline(coins.find((c) => c.coin === coin)?.settleOffline, network);
    });
    if (!paused) {
      console.log('No mapped settle network is paused on SideShift right now — skipping');
      return;
    }
    console.log('Paused settle asset:', paused);
    await expect(service.getQuote(BTC_ASSET, paused, '0.01')).rejects.toThrow('is temporarily unavailable');
  });

  it('getPairInfo works for BTC→RBTC', async () => {
    const service = new SideshiftTransferService(storage, AFFILIATE_ID);
    const pairInfo = await service.getPairInfo(BTC_ASSET, RBTC_ASSET);
    console.log('Pair info:', JSON.stringify(pairInfo, null, 2));
    expect(parseFloat(pairInfo.rate)).toBeGreaterThan(0);
    expect(parseFloat(pairInfo.min)).toBeGreaterThan(0);
    expect(parseFloat(pairInfo.max)).toBeGreaterThan(0);
  });
});
