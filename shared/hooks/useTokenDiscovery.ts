import assert from 'assert';
import useSWR from 'swr';

import { SparkWallet } from '../class/wallets/spark-wallet';
import { StacksWallet } from '../class/wallets/stacks-wallet';
import { getTokenList } from '../models/token-list';
import { IBackgroundCaller } from '../types/IBackgroundCaller';
import { NETWORK_LIQUID, NETWORK_LIQUID_TESTNET, NETWORK_SPARK, NETWORK_STACKS, Networks } from '../types/networks';
import { CachedTokenInfo } from '../types/token-info';

interface tokenDiscoveryFetcherArg {
  cacheKey: string;
  network: Networks;
  accountNumber: number;
  backgroundCaller: IBackgroundCaller;
}

export const tokenDiscoveryFetcher = async (arg: tokenDiscoveryFetcherArg): Promise<CachedTokenInfo[]> => {
  const { network, accountNumber, backgroundCaller } = arg;

  if (network === NETWORK_SPARK) {
    const wallet = await backgroundCaller.lazyInitWallet(network, accountNumber);
    assert(wallet instanceof SparkWallet, 'Not a Spark wallet');
    await wallet.fetchTokenBalances();
    return wallet.getTokenBalances();
  } else if (network === NETWORK_STACKS) {
    const wallet = await backgroundCaller.lazyInitWallet(network, accountNumber);
    assert(wallet instanceof StacksWallet, 'Not a Stacks wallet');
    await wallet.fetchTokenBalances();
    return wallet.getTokenBalances();
  } else if (network === NETWORK_LIQUID || network === NETWORK_LIQUID_TESTNET) {
    const tokens = getTokenList(network).map((token) => ({
      ...token,
      balance: undefined,
    }));
    return tokens;
  } else {
    // For all other networks, return the standard token list
    // Adapt TokenInfo[] to CachedTokenInfo[] by adding a default balance
    const tokens = getTokenList(network).map((token) => ({
      ...token,
      balance: undefined,
    }));
    return tokens;
  }
};

export function useTokenDiscovery(network: Networks, accountNumber: number, backgroundCaller: IBackgroundCaller, refreshInterval = 5_000) {
  // Only enable refresh interval for NETWORK_SPARK & NETWORK_STACKS
  const shouldRefresh = network === NETWORK_SPARK || network === NETWORK_STACKS;

  const arg: tokenDiscoveryFetcherArg = {
    cacheKey: 'tokenDiscoveryFetcher',
    network,
    accountNumber,
    backgroundCaller,
  };

  const { data, error, isLoading, mutate } = useSWR(arg, tokenDiscoveryFetcher, {
    refreshInterval: shouldRefresh ? refreshInterval : undefined,
    refreshWhenHidden: false,
    keepPreviousData: true,
  });

  return {
    tokenList: data ?? [],
    isLoading,
    error: error instanceof Error ? error : error ? new Error('Unknown error') : null,
    mutate,
  };
}
