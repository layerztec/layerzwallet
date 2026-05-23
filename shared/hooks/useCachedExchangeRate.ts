import { useSWRConfig } from 'swr';
import {
  NETWORK_ARK,
  NETWORK_BITCOIN,
  NETWORK_BOTANIX,
  NETWORK_CITREA,
  NETWORK_LIGHTNING,
  NETWORK_LIQUID,
  NETWORK_ROOTSTOCK,
  NETWORK_SPARK,
  NETWORK_STACKS,
  NETWORK_USDT,
  Networks,
} from '../types/networks';
import { StringNumber } from '../types/string-number';
import { useSelectedFiat } from './useSelectedFiat';

/**
 * This hook gets exchange rate from SWR cache instead of doing network request
 *
 * @param network - the network for which to get the rate
 */
export function useCachedExchangeRate(network: Networks): { exchangeRate: StringNumber | undefined } {
  const fiat = useSelectedFiat();
  const { cache } = useSWRConfig();

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
    case NETWORK_BOTANIX:
    case NETWORK_CITREA:
    case NETWORK_ROOTSTOCK:
    case NETWORK_STACKS:
      network2use = NETWORK_BITCOIN;
  }
  //

  for (const key of cache.keys()) {
    if (key.includes(`exchangeRateFetcher`) && key.includes(`network:"${network2use}"`) && key.includes(`fiat:"${fiat}"`)) {
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
