import { describe, expect, test } from 'vitest';

import { isBuyBitcoinVisibleForCountry } from '../../utils/buy-bitcoin-visibility';

describe('isBuyBitcoinVisibleForCountry', () => {
  test('hides the buy button for Great Britain', () => {
    expect(isBuyBitcoinVisibleForCountry('GB')).toBe(false);
    expect(isBuyBitcoinVisibleForCountry('gb')).toBe(false);
  });

  test('shows the buy button for other countries', () => {
    expect(isBuyBitcoinVisibleForCountry('US')).toBe(true);
    expect(isBuyBitcoinVisibleForCountry('DE')).toBe(true);
  });

  test('hides the buy button when country code is missing', () => {
    expect(isBuyBitcoinVisibleForCountry(undefined)).toBe(false);
    expect(isBuyBitcoinVisibleForCountry('')).toBe(false);
  });
});
