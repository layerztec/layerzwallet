import useSWR from 'swr';
import { useMemo } from 'react';
import { Networks } from '../types/networks';
import { getFiatRate } from '../models/fiatUnit';
import { getIsTestnet } from '../models/network-getters';

type TFiat = 'USD';

interface exchangeRateFetcherArg {
  cacheKey: string;
  network: Networks;
  fiat: TFiat;
}

export const exchangeRateFetcher = async (arg: exchangeRateFetcherArg): Promise<number> => {
  const { network, fiat } = arg;

  if (getIsTestnet(network)) {
    return 0;
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
    refreshInterval,
    refreshWhenHidden: false,
  });

  return {
    exchangeRate: data,
    isLoading,
    error,
  };
}
