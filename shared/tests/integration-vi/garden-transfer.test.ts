import { describe, it, expect } from 'vitest';
import { GardenApi } from '../../services/garden-api';
import { GardenTransferService } from '../../services/transfer-service-garden';
import { IStorage } from '../../types/IStorage';
import { AssetId } from '../../types/asset';

const APP_ID = 'f242ea49332293424c96c562a6ef575a819908c878134dcb4fce424dc84ec796';

const mockStorage: Record<string, string> = {};
const storage: IStorage = {
  getItem: async (key: string) => mockStorage[key] ?? null,
  setItem: async (key: string, value: string) => {
    mockStorage[key] = value;
  },
};

const BTC_ASSET: AssetId = 'native:bitcoin';
const BOTANIX_ASSET: AssetId = 'native:botanix';

describe('Garden Finance API integration', () => {
  it('GET /quote returns valid amounts for BTC→Botanix', async () => {
    const api = new GardenApi(APP_ID);
    const resp = await api.getQuote('bitcoin:btc', 'botanix:btc', '10000');
    console.log('Quote response:', JSON.stringify(resp, null, 2));

    expect(resp.status).toBe('Ok');
    expect(resp.result.length).toBeGreaterThan(0);

    const quote = resp.result[0];
    expect(quote.source.asset).toBe('bitcoin:btc');
    expect(quote.destination.asset).toBe('botanix:btc');

    // Source: 10000 sats = 0.0001 BTC
    expect(quote.source.display).toBe('0.00010000');

    // Destination display should be a reasonable BTC value (not 997900 or similar)
    const receiveDisplay = parseFloat(quote.destination.display);
    console.log('Source display:', quote.source.display, 'Destination display:', quote.destination.display);
    expect(receiveDisplay).toBeGreaterThan(0);
    expect(receiveDisplay).toBeLessThan(0.001); // should be close to 0.0001, never > 0.001
  });

  it('getQuote returns correctly scaled amounts', async () => {
    const service = new GardenTransferService(storage, APP_ID);
    const quote = await service.getQuote(BTC_ASSET, BOTANIX_ASSET, '0.0001');
    console.log('Service quote:', JSON.stringify(quote, null, 2));

    const sendAmount = parseFloat(quote.sendAmount);
    const receiveAmount = parseFloat(quote.receiveAmount);

    // Send 0.0001 BTC — receive should be close to 0.0001, never exceed it
    expect(sendAmount).toBeCloseTo(0.0001, 5);
    expect(receiveAmount).toBeGreaterThan(0);
    expect(receiveAmount).toBeLessThan(0.001);
    console.log('Send:', quote.sendAmount, 'Receive:', quote.receiveAmount, 'Fee:', quote.fee, 'Rate:', quote.rate);
  });

  it('getQuote amounts are reasonable for 0.01 BTC', async () => {
    const service = new GardenTransferService(storage, APP_ID);
    const quote = await service.getQuote(BTC_ASSET, BOTANIX_ASSET, '0.01');
    console.log('0.01 BTC quote:', JSON.stringify(quote, null, 2));

    const sendAmount = parseFloat(quote.sendAmount);
    const receiveAmount = parseFloat(quote.receiveAmount);

    expect(sendAmount).toBeCloseTo(0.01, 4);
    expect(receiveAmount).toBeGreaterThan(0.009); // at least 90% after fees
    expect(receiveAmount).toBeLessThanOrEqual(0.01); // never more than sent
    console.log('Send:', quote.sendAmount, 'Receive:', quote.receiveAmount);
  });

  it('getSupportedPairs returns BTC→Botanix', () => {
    const service = new GardenTransferService(storage, APP_ID);
    const pairs = service.getSupportedPairs();
    expect(pairs).toHaveLength(1);
    expect(pairs[0].sendAssetId).toBe(BTC_ASSET);
    expect(pairs[0].receiveAssetId).toBe(BOTANIX_ASSET);
  });

  it('getPairInfo returns valid rate', async () => {
    const service = new GardenTransferService(storage, APP_ID);
    const info = await service.getPairInfo(BTC_ASSET, BOTANIX_ASSET);
    console.log('Pair info:', JSON.stringify(info, null, 2));

    const rate = parseFloat(info.rate);
    expect(rate).toBeGreaterThan(0.9); // should be close to 1:1 for BTC→BTC
    expect(rate).toBeLessThanOrEqual(1);
  });
});
