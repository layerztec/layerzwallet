import BigNumber from 'bignumber.js';
import { describe, expect, it } from 'vitest';
import { getAssetInfo } from '../../models/asset-info';

describe('useAssetBalance logic', () => {
  it('native asset has no tokenId', () => {
    const info = getAssetInfo('native:bitcoin');
    expect(info.tokenId).toBeUndefined();
    expect(info.network).toBe('bitcoin');
  });

  it('token asset has tokenId', () => {
    const info = getAssetInfo('token:spark:usdb');
    expect(info.tokenId).toBeDefined();
    expect(info.network).toBe('spark');
  });

  it('native liquid has no tokenId', () => {
    const info = getAssetInfo('native:liquid');
    expect(info.tokenId).toBeUndefined();
    expect(info.network).toBe('liquid');
  });

  it('token liquid:usdt has tokenId', () => {
    const info = getAssetInfo('token:liquid:usdt');
    expect(info.tokenId).toBeDefined();
    expect(info.network).toBe('liquid');
  });

  it('balance check math works correctly', () => {
    const info = getAssetInfo('native:bitcoin');
    const sendAmount = '0.001';
    const balance = '50000'; // 50000 satoshis = 0.0005 BTC

    const amountSmallest = new BigNumber(sendAmount).times(new BigNumber(10).pow(info.decimals));
    // 0.001 * 10^8 = 100000 satoshis
    expect(amountSmallest.gt(new BigNumber(balance))).toBe(true); // insufficient

    const balance2 = '200000'; // 0.002 BTC
    expect(amountSmallest.gt(new BigNumber(balance2))).toBe(false); // sufficient
  });

  it('balance check works for token with different decimals', () => {
    const info = getAssetInfo('token:spark:usdb');
    const sendAmount = '10';
    const balance = '5000000'; // 5 USDB (6 decimals)

    const amountSmallest = new BigNumber(sendAmount).times(new BigNumber(10).pow(info.decimals));
    expect(amountSmallest.gt(new BigNumber(balance))).toBe(true); // insufficient

    const balance2 = '20000000'; // 20 USDB
    expect(amountSmallest.gt(new BigNumber(balance2))).toBe(false); // sufficient
  });
});
