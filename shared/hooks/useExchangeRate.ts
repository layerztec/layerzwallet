import useSWR from 'swr';
import { useMemo } from 'react';
import { NETWORK_ARK, NETWORK_BITCOIN, NETWORK_BOTANIX, NETWORK_CITREA, NETWORK_LIQUID, NETWORK_ROOTSTOCK, NETWORK_SPARK, NETWORK_STACKS, NETWORK_USDT, Networks } from '../types/networks';
import { getFiatRate } from '../models/fiatUnit';
import { getIsTestnet } from '../models/network-getters';

export type TFiat = 'USD';

interface exchangeRateFetcherArg {
  cacheKey: string;
  network: Networks;
  fiat: TFiat;
}

function middleware(useSWRNext: any) {
  return (key: any, fetcher: any, config: any) => {
    console.log(`useExchangeRate(${JSON.stringify(key)})`); // logging

    return useSWRNext(key, () => fetcher(key), config);
  };
}

export const exchangeRateFetcher = async (arg: exchangeRateFetcherArg): Promise<number> => {
  const { network, fiat } = arg;

  if (getIsTestnet(network)) {
    return 0;
  }

  if (network === NETWORK_USDT) {
    return 1;
  }

  return await getFiatRate(fiat);
};

export function useExchangeRate(network: Networks, fiat: TFiat) {
  let refreshInterval = 60_000;

  let network2use: Networks = network;

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

  const arg: exchangeRateFetcherArg = useMemo(
    () => ({
      cacheKey: 'exchangeRateFetcher',
      network: network2use,
      fiat,
    }),
    [network2use, fiat]
  );

  const { data, error, isLoading } = useSWR(arg, exchangeRateFetcher, {
    use: [middleware],
    refreshInterval,
    refreshWhenHidden: false,
  });

  return {
    exchangeRate: data,
    isLoading,
    error,
  };
}
