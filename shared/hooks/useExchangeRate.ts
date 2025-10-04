import useSWR from 'swr';
import { useMemo } from 'react';
import { NETWORK_USDT, Networks } from '../types/networks';
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

  const arg: exchangeRateFetcherArg = useMemo(
    () => ({
      cacheKey: 'exchangeRateFetcher',
      network,
      fiat,
    }),
    [network, fiat]
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
