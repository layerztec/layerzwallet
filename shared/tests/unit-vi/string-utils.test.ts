import assert from 'assert';
import { test } from 'vitest';
import { getDecimalsByNetwork } from '../../models/network-getters';
import { capitalizeFirstLetter, formatBalance, formatFiatBalance } from '../../modules/string-utils';
import { NETWORK_BITCOIN, NETWORK_ROOTSTOCK } from '../../types/networks';

test('capitalizeFirstLetter', () => {
  assert.strictEqual(capitalizeFirstLetter('hello world'), 'Hello world');
  assert.strictEqual(capitalizeFirstLetter('Hello world'), 'Hello world');
  assert.strictEqual(capitalizeFirstLetter('111'), '111');
  assert.strictEqual(capitalizeFirstLetter(''), '');
});

test('formatBalance', () => {
  assert.strictEqual(formatBalance('123000000', getDecimalsByNetwork(NETWORK_BITCOIN), 8), '1.23');
  assert.strictEqual(formatBalance('123456789', getDecimalsByNetwork(NETWORK_BITCOIN), 8), '1.23456789');
  assert.strictEqual(formatBalance('123456789', getDecimalsByNetwork(NETWORK_BITCOIN), 2), '1.23');
  assert.strictEqual(formatBalance('123456789', getDecimalsByNetwork(NETWORK_BITCOIN), 4), '1.2346'); // rounding up
  assert.strictEqual(formatBalance('1', getDecimalsByNetwork(NETWORK_BITCOIN)), '0.00000001'); // 1 sat should be displayed properly for btc
});

test('formatFiatBalance', () => {
  assert.strictEqual(formatFiatBalance('1011138556590607', getDecimalsByNetwork(NETWORK_ROOTSTOCK), 105338.6), '106.51');
});
