import assert from 'assert';
import useSWR from 'swr';

import { SparkWallet } from '../class/wallets/spark-wallet';
import { StacksWallet } from '../class/wallets/stacks-wallet';
import { getTokenList } from '../models/token-list';
import { IBackgroundCaller } from '../types/IBackgroundCaller';
import { IStorage } from '../types/IStorage';
import { NETWORK_LIQUID, NETWORK_LIQUID_TESTNET, NETWORK_SPARK, NETWORK_STACKS, Networks } from '../types/networks';
import { CachedTokenInfo } from '../types/token-info';

const STORAGE_KEY_CACHED_TOKEN_LIST = 'STORAGE_KEY_CACHED_TOKEN_LIST_V2';

interface tokenDiscoveryFetcherArg {
  cacheKey: string;
  network: Networks;
  accountNumber: number;
  backgroundCaller: IBackgroundCaller;
  storage: IStorage;
}

/**
 * returns cached tokens from storage if present, null otherwise
 */
async function restoreCachedTokens(cacheKey: string, storage: IStorage): Promise<CachedTokenInfo[] | null> {
  try {
    const cachedTokensString = await storage.getItem(cacheKey);
    const cachedTokens = JSON.parse(cachedTokensString);
    if (Array.isArray(cachedTokens) && cachedTokens.length > 0) {
      return cachedTokens;
    }
  } catch (_) {}
  return null;
}

export const tokenDiscoveryFetcher = async (arg: tokenDiscoveryFetcherArg): Promise<CachedTokenInfo[]> => {
  const { network, accountNumber, backgroundCaller, storage } = arg;

  if (network === NETWORK_SPARK) {
    const cacheKey = STORAGE_KEY_CACHED_TOKEN_LIST + network + accountNumber;

    if (!backgroundCaller.lazyInitWalletReady(network, accountNumber)) {
      // wallet not ready, definitely can use cached tokens (if any)
      const cachedTokens = await restoreCachedTokens(cacheKey, storage);
      if (cachedTokens) return cachedTokens;
    }

    // Lazy initialize Spark wallet
    const wallet = await backgroundCaller.lazyInitWallet(network, accountNumber);
    assert(wallet instanceof SparkWallet, 'Not a Spark wallet');

    // we do NOT fetch from network, we rely on cached value inside wallet internals
    if (!wallet._lastBalanceFetch) {
      // balance never fetched yet, so we can use cached tokens (if any)
      const cachedTokens = await restoreCachedTokens(cacheKey, storage);
      if (cachedTokens) return cachedTokens;
    }

    const tokenInfos: CachedTokenInfo[] = wallet.getTokenBalances();
    if (tokenInfos.length > 0) {
      await storage.setItem(cacheKey, JSON.stringify(tokenInfos)); // saving to cache
    }
    return tokenInfos;
  } else if (network === NETWORK_STACKS) {
    const wallet = await backgroundCaller.lazyInitWallet(network, accountNumber);
    assert(wallet instanceof StacksWallet, 'Not a Stacks wallet');

    await wallet.fetchTokenBalances();
    const tokenInfos: CachedTokenInfo[] = [];
    for (const token of wallet.getTokenBalances()) {
      tokenInfos.push(token);
    }

    return tokenInfos;
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

export function useTokenDiscovery(network: Networks, accountNumber: number, backgroundCaller: IBackgroundCaller, storage: IStorage, refreshInterval = 5_000) {
  // Only enable refresh interval for NETWORK_SPARK & NETWORK_STACKS
  const shouldRefresh = network === NETWORK_SPARK || network === NETWORK_STACKS;

  const arg: tokenDiscoveryFetcherArg = {
    cacheKey: 'tokenDiscoveryFetcher',
    network,
    accountNumber,
    backgroundCaller,
    storage,
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
