import { useSWRConfig } from 'swr';
import { NETWORK_ARK, NETWORK_BITCOIN, NETWORK_CITREA, NETWORK_LIGHTNING, NETWORK_LIQUID, NETWORK_ROOTSTOCK, NETWORK_SPARK, NETWORK_STACKS, NETWORK_USDT, Networks } from '../types/networks';
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

  let network2use: Networks = network;

  if (network === NETWORK_LIGHTNING) {
    // lightning doesnt have its own exchange rate, its basically btc
    network2use = NETWORK_BITCOIN;
  }

  // we do not expect depeg, so we assume all those networks are the same thing,
  // so we hardcode network to bitcoin so that useSWR will use its cache.
  // WHEN and IF depegs become possible, remove
  switch (network) {
    case NETWORK_SPARK:
    case NETWORK_ARK:
    case NETWORK_LIQUID:
    case NETWORK_CITREA:
    case NETWORK_ROOTSTOCK:
    case NETWORK_STACKS:
      network2use = NETWORK_BITCOIN;
  }
  //

  for (const key of cache.keys()) {
    if (key.includes(`exchangeRateFetcher`) && key.includes(`network:"${network2use}"`)) {
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
