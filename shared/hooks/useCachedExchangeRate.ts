import { useSWRConfig } from 'swr';
import { NETWORK_USDT, Networks } from '../types/networks';
import { TFiat } from './useExchangeRate';
import { StringNumber } from '../types/string-number';

/**
 * This hook gets exchange rate from SWR cache instead of doing network request
 *
 * @param network - the network for which to get the rate
 * @param fiat - currently only 'USD'
 */
export function useCachedExchangeRate(network: Networks, fiat: TFiat): { exchangeRate: StringNumber | undefined } {
  const { cache } = useSWRConfig();

  if (network === NETWORK_USDT) {
    return {
      exchangeRate: '1',
    };
  }

  for (const key of cache.keys()) {
    if (key.includes(`exchangeRateFetcher`) && key.includes(`network:"${network}"`)) {
      const rate = cache.get(key);
      if (rate?.data) {
        return {
          exchangeRate: String(rate.data),
        };
      }
    }
  }

  return {
    exchangeRate: undefined,
  };
}
