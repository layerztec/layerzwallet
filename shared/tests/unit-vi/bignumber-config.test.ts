import BigNumber from 'bignumber.js';
import { expect, test } from 'vitest';

test('invalid BigNumber input is NaN, not an exception', () => {
  for (const input of ['', '.', 'abc', '1,5', undefined, null]) {
    expect(new BigNumber(input as unknown as string).isNaN()).toBe(true);
  }
  expect(new BigNumber('1.').toString()).toBe('1');
  expect(new BigNumber(10n).toString()).toBe('10');
});
