import { describe, it, expect, beforeAll } from 'vitest';
import { SideshiftApi } from '../../services/sideshift-api';
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
const LBTC_ASSET: AssetId = 'native:liquid';

function isGeoBlocked(e: any): boolean {
  return e?.message?.includes('Access denied') || e?.statusCode === 403;
}

describe('SideShift API integration', () => {
  let geoBlocked = false;

  beforeAll(async () => {
    try {
      const api = new SideshiftApi(AFFILIATE_ID);
      await api.createQuote({ depositCoin: 'BTC', depositNetwork: 'bitcoin', settleCoin: 'BTC', settleNetwork: 'liquid', depositAmount: '0.001' });
    } catch (e: any) {
      if (isGeoBlocked(e)) {
        geoBlocked = true;
        console.log('SideShift geo-restricted in this region — skipping POST-dependent tests');
      }
    }
  });
  it('GET /pair works for BTC-bitcoin/BTC-liquid', async () => {
    const api = new SideshiftApi(AFFILIATE_ID);
    const pair = await api.getPair('BTC-bitcoin', 'BTC-liquid');
    console.log('Pair info:', JSON.stringify(pair, null, 2));
    expect(pair).toBeDefined();
    expect(pair.rate).not.toBeNull();
    expect(parseFloat(pair.rate!)).toBeGreaterThan(0);
    expect(pair.min).not.toBeNull();
    expect(pair.max).not.toBeNull();
  });

  it('POST /quotes for BTC→L-BTC', async () => {
    if (geoBlocked) return;
    const api = new SideshiftApi(AFFILIATE_ID);
    const quote = await api.createQuote({
      depositCoin: 'BTC',
      depositNetwork: 'bitcoin',
      settleCoin: 'BTC',
      settleNetwork: 'liquid',
      depositAmount: '0.01',
    });
    console.log('Quote response:', JSON.stringify(quote, null, 2));
    expect(quote.id).toBeDefined();
    expect(quote.rate).toBeDefined();
  });

  it('getQuote for BTC→L-BTC', async () => {
    if (geoBlocked) return;
    const service = new SideshiftTransferService(storage, AFFILIATE_ID);
    const quote = await service.getQuote(BTC_ASSET, LBTC_ASSET, '0.01');
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

  it('getPairInfo works for BTC→L-BTC', async () => {
    const service = new SideshiftTransferService(storage, AFFILIATE_ID);
    const pairInfo = await service.getPairInfo(BTC_ASSET, LBTC_ASSET);
    console.log('Pair info:', JSON.stringify(pairInfo, null, 2));
    expect(parseFloat(pairInfo.rate)).toBeGreaterThan(0);
    expect(parseFloat(pairInfo.min)).toBeGreaterThan(0);
    expect(parseFloat(pairInfo.max)).toBeGreaterThan(0);
  });
});
