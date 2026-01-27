import assert from 'assert';
import useSWR from 'swr';

import { SparkWallet } from '../class/wallets/spark-wallet';
import { CommonSwap } from '../types/common-swap';
import { IBackgroundCaller } from '../types/IBackgroundCaller';
import { NETWORK_ARK, NETWORK_ARK_MUTINYNET, NETWORK_SPARK, Networks } from '../types/networks';
import { ArkWallet } from '@shared/class/wallets/ark-wallet';

interface swapFetcherArg {
  cacheKey: string;
  accountNumber: number;
  network: Networks;
  backgroundCaller: IBackgroundCaller;
}

/**
 * extra key `backgroundCaller` can mutate unpredictably, causing more cache saves, and messing up logic. this middleware removes it from the key
 */
function keyCleanupMiddleware(useSWRNext: any) {
  return (key: any, fetcher: any, config: any) => {
    let newKey = key;
    if (typeof key === 'object' && key.backgroundCaller) {
      newKey = Object.assign({}, key);
      delete newKey.backgroundCaller;
    }

    return useSWRNext(newKey, () => fetcher(key), config);
  };
}

export const swapFetcher = async (arg: swapFetcherArg): Promise<CommonSwap[]> => {
  const { accountNumber, network, backgroundCaller } = arg;

  try {
    if (network === NETWORK_SPARK) {
      const wallet = await backgroundCaller.lazyInitWallet(network, accountNumber);
      assert(wallet instanceof SparkWallet, 'Not a Spark wallet');
      return await wallet.getCommonSwaps();
    }

    if (network === NETWORK_ARK_MUTINYNET || network === NETWORK_ARK) {
      const wallet = await backgroundCaller.lazyInitWallet(network, accountNumber);
      assert(wallet instanceof ArkWallet, 'Not an Ark wallet');
      return await wallet.getCommonSwaps();
    }

    // For now, only Spark wallet is supported
    return [];
  } catch (error) {
    globalThis.handleError?.(error, 'useSwaps.ts');
    console.error('swap fetch error', error);
    throw error;
  }
};

export function useSwaps(network: Networks, accountNumber: number, backgroundCaller: IBackgroundCaller) {
  let refreshInterval = 60_000; // 1 min default

  switch (network) {
    case NETWORK_SPARK:
      refreshInterval = 20_000; // 20 seconds for Spark swaps
      break;
    case NETWORK_ARK_MUTINYNET:
    case NETWORK_ARK:
      refreshInterval = 20_000; // 20 seconds for Ark swaps
      break;
  }

  const arg: swapFetcherArg = { cacheKey: 'swapFetcher', accountNumber, network, backgroundCaller };
  const { data, error, isLoading, mutate } = useSWR(arg, swapFetcher, {
    use: [keyCleanupMiddleware],
    refreshInterval,
    refreshWhenHidden: false,
    keepPreviousData: true,
  });

  return {
    swaps: data,
    isLoading,
    error,
    mutate,
  };
}
