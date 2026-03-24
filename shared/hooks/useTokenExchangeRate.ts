import { useMemo } from 'react';
import useSWR from 'swr';
import { getIsTestnet } from '../models/network-getters';
import { USDT_TOKENS } from '../models/token-list';
import { NETWORK_LIQUID, NETWORK_ROOTSTOCK, NETWORK_SPARK, NETWORK_STACKS, NETWORK_USDT, Networks } from '../types/networks';
import { getFiatRate } from '../models/fiatUnit';
import { TFiat } from '../types/fiat';

interface tokenExchangeRateFetcherArg {
  cacheKey: string;
  network: Networks;
  tokenId: string;
  fiat: TFiat;
}

function middleware(useSWRNext: any) {
  return (key: any, fetcher: any, config: any) => {
    // console.log(`useTokenExchangeRate(${JSON.stringify(key)})`); // logging

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

  // USDT on Liquid network
  if (network === NETWORK_LIQUID && USDT_TOKENS[NETWORK_LIQUID].includes(tokenId as any)) {
    return 1;
  }

  // USDT0 and rUSDT on Rootstock network
  if (network === NETWORK_ROOTSTOCK && USDT_TOKENS[NETWORK_ROOTSTOCK].includes(tokenId as any)) {
    return 1;
  }

  // USDB on Spark network
  if (network === NETWORK_SPARK && USDT_TOKENS[NETWORK_SPARK]?.includes(tokenId as any)) {
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
      globalThis.handleError?.(error, 'useTokenExchangeRate.ts');
      console.error('Error fetching STX exchange rate:', error);
      return 0;
    }
  }

  switch (tokenId) {
    // different kinds of wrapped BTC:
    // TODO: maybe worth configuring somewhere; also, think about the case of de-peg
    case '0x21EdC56532b6E92E676aA260B2a1f968B20EB1F5':
    case '0x0D2437F93Fed6EA64Ef01cCde385FB1263910C56':
    case '0xF4586028FFdA7Eca636864F80f8a3f2589E33795':
    case '0x321f90864fb21cdcddd0d67fe5e4cbc812ec9e64':
    case '0x542FDA317318eBf1d3DeAF76E0B632741a7e677d':
      return await getFiatRate(fiat);
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

  const { data, error, isLoading } = useSWR(tokenId ? arg : null, tokenExchangeRateFetcher, {
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
