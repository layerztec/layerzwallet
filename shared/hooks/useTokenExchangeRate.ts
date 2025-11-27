import { useMemo } from 'react';
import useSWR from 'swr';
import { getIsTestnet } from '../models/network-getters';
import { NETWORK_STACKS, NETWORK_USDT, Networks } from '../types/networks';

export type TFiat = 'USD';

interface tokenExchangeRateFetcherArg {
  cacheKey: string;
  network: Networks;
  tokenId: string;
  fiat: TFiat;
}

function middleware(useSWRNext: any) {
  return (key: any, fetcher: any, config: any) => {
    console.log(`useTokenExchangeRate(${JSON.stringify(key)})`); // logging

    return useSWRNext(key, () => fetcher(key), config);
  };
}

export const tokenExchangeRateFetcher = async (arg: tokenExchangeRateFetcherArg): Promise<number> => {
  const { network, tokenId, fiat } = arg;

  if (getIsTestnet(network)) {
    return 0;
  }

  if (network === NETWORK_USDT) {
    return 1;
  }

  // Handle STX token on Stacks network
  if (tokenId === 'STX' && network === NETWORK_STACKS) {
    try {
      const response = await fetch('https://api.kraken.com/0/public/Ticker?pair=STXUSD');
      const data = await response.json();

      if (data.error && data.error.length > 0) {
        console.error('Kraken API error:', data.error);
        return 0;
      }

      // Kraken returns the ticker data under the pair name key
      const tickerData = data.result?.STXUSD;
      if (tickerData && tickerData.c && tickerData.c[0]) {
        // 'c' is the last trade closed array [price, lot volume]
        return parseFloat(tickerData.c[0]);
      }

      return 0;
    } catch (error) {
      console.error('Error fetching STX exchange rate:', error);
      return 0;
    }
  }

  console.log(`dont know how to get exchange rate for token ${tokenId} on ${network}`);
  return 0;
};

export function useTokenExchangeRate(network: Networks, tokenId: string, fiat: TFiat) {
  let refreshInterval = 60_000;

  const arg: tokenExchangeRateFetcherArg = useMemo(
    () => ({
      cacheKey: 'exchangeRateFetcher',
      network,
      tokenId,
      fiat,
    }),
    [network, tokenId, fiat]
  );

  const { data, error, isLoading } = useSWR(arg, tokenExchangeRateFetcher, {
    use: [middleware],
    refreshInterval,
    refreshWhenHidden: false,
  });

  return {
    tokenExchangeRate: data,
    isLoading,
    error,
  };
}
