import assert from 'assert';
import { test } from 'vitest';
import { SwapProviderBoltz } from '../../models/swap-provider-boltz';
import { NETWORK_BITCOIN, NETWORK_BOTANIXTESTNET, NETWORK_BREEZTESTNET, NETWORK_ROOTSTOCK } from '../../types/networks';
import { getSwapPairs, getSwapProvidersList } from '../../models/swap-providers-list';

test('throws on incorrect swap pair', async () => {
  const swapper = new SwapProviderBoltz();

  let errMsg = '';
  try {
    await swapper.swap(NETWORK_BREEZTESTNET, () => {}, NETWORK_BOTANIXTESTNET, 1, '0x123');
  } catch (error: any) {
    errMsg = error.message;
  }

  assert.strictEqual(errMsg, 'Swap pair breeztest->botanix not supported by Boltz');
});

test('accepts correct swap pair', async () => {
  const onramper = new SwapProviderBoltz();
  const url = await onramper.swap(NETWORK_BITCOIN, () => {}, NETWORK_ROOTSTOCK, 1, '0x123');

  assert.ok(url);
});

test('getSwapPartnersList()', async () => {
  let providers = getSwapProvidersList(NETWORK_BITCOIN);
  assert.ok(providers.length > 0); // there are providers that swap from bitcoin

  providers = getSwapProvidersList(NETWORK_BREEZTESTNET);
  assert.ok(providers.length === 0); // there are no providers that swap from testnet
});

test('getSwapPairs() returns correct pairs', () => {
  const bitcoinPairs = getSwapPairs(NETWORK_BITCOIN);
  assert.ok(bitcoinPairs.length > 0); // bitcoin has swap pairs
  assert.ok(bitcoinPairs.every((pair) => pair.from === NETWORK_BITCOIN)); // all pairs are from bitcoin
  assert.ok(bitcoinPairs.some((pair) => pair.to === NETWORK_ROOTSTOCK)); // at least one pair swaps to rootstock

  const testnetPairs = getSwapPairs(NETWORK_BREEZTESTNET);
  assert.strictEqual(testnetPairs.length, 0); // testnet has no swap pairs

  // Check for duplicate pairs
  const pairStrings = bitcoinPairs.map((pair) => `${pair.from}-${pair.to}`);
  const uniquePairStrings = [...new Set(pairStrings)];
  assert.strictEqual(pairStrings.length, uniquePairStrings.length); // no duplicate pairs
});
