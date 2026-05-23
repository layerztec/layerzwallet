import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exchangeRateFetcher } from '../../hooks/useExchangeRate';
import { tokenExchangeRateFetcher } from '../../hooks/useTokenExchangeRate';
import { getFiatRate } from '../../models/fiatUnit';
import { USDT_TOKENS } from '../../models/token-list';
import { NETWORK_BOTANIX_TESTNET, NETWORK_LIQUID, NETWORK_STACKS, NETWORK_USDT } from '../../types/networks';

vi.mock('../../models/fiatUnit', () => ({
  getFiatRate: vi.fn(),
}));

describe('exchange rate hooks fetchers', () => {
  const getFiatRateMock = vi.mocked(getFiatRate);
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns 0 for testnet exchange rates', async () => {
    const rate = await exchangeRateFetcher({
      cacheKey: 'exchangeRateFetcher',
      network: NETWORK_BOTANIX_TESTNET,
      fiat: 'EUR',
    });

    expect(rate).toBe(0);
    expect(getFiatRateMock).not.toHaveBeenCalled();
  });

  it('converts USDT network rates to selected fiat', async () => {
    getFiatRateMock.mockResolvedValueOnce(91000).mockResolvedValueOnce(100000);

    const rate = await exchangeRateFetcher({
      cacheKey: 'exchangeRateFetcher',
      network: NETWORK_USDT,
      fiat: 'EUR',
    });

    expect(rate).toBe(0.91);
    expect(getFiatRateMock).toHaveBeenCalledWith('EUR');
    expect(getFiatRateMock).toHaveBeenCalledWith('USD');
  });

  it('converts stablecoin token rates to selected fiat', async () => {
    getFiatRateMock.mockResolvedValueOnce(108000).mockResolvedValueOnce(100000);

    const rate = await tokenExchangeRateFetcher({
      cacheKey: 'exchangeRateFetcher',
      network: NETWORK_LIQUID,
      tokenId: USDT_TOKENS[NETWORK_LIQUID][0],
      fiat: 'CAD',
    });

    expect(rate).toBe(1.08);
    expect(getFiatRateMock).toHaveBeenCalledWith('CAD');
    expect(getFiatRateMock).toHaveBeenCalledWith('USD');
  });

  it('converts STXUSD quote into selected fiat', async () => {
    getFiatRateMock.mockResolvedValueOnce(90000).mockResolvedValueOnce(100000);
    global.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        error: [],
        result: {
          STXUSD: {
            c: ['2'],
          },
        },
      }),
    } as any);

    const rate = await tokenExchangeRateFetcher({
      cacheKey: 'exchangeRateFetcher',
      network: NETWORK_STACKS,
      tokenId: 'STX',
      fiat: 'EUR',
    });

    expect(rate).toBe(1.8);
    expect(getFiatRateMock).toHaveBeenCalledWith('EUR');
    expect(getFiatRateMock).toHaveBeenCalledWith('USD');
  });
});
