import assert from 'assert';
import useSWR from 'swr';

import { StacksWallet } from '../class/wallets/stacks-wallet';
import { IBackgroundCaller } from '../types/IBackgroundCaller';
import { IStorage } from '../types/IStorage';
import { NETWORK_SPARK, NETWORK_STACKS, Networks } from '../types/networks';
import { CachedTokenInfo, NftInfo } from '../types/token-info';

const STORAGE_KEY_CACHED_NFT = 'STORAGE_KEY_CACHED_NFT';

interface nftDiscoveryFetcherArg {
  cacheKey: string;
  network: Networks;
  accountNumber: number;
  backgroundCaller: IBackgroundCaller;
  storage: IStorage;
}

/**
 * returns cached nfts from storage if present, null otherwise
 */
async function restoreCachedNfts(cacheKey: string, storage: IStorage): Promise<NftInfo[] | null> {
  try {
    const cachedTokensString = await storage.getItem(cacheKey);
    const cachedTokens = JSON.parse(cachedTokensString);
    if (Array.isArray(cachedTokens) && cachedTokens.length > 0) {
      return cachedTokens;
    }
  } catch (_) {}
  return null;
}

export const nftDiscoveryFetcher = async (arg: nftDiscoveryFetcherArg): Promise<NftInfo[]> => {
  const { network, accountNumber, backgroundCaller, storage } = arg;

  if (network === NETWORK_STACKS) {
    const cacheKey = STORAGE_KEY_CACHED_NFT + network + accountNumber;

    if (!backgroundCaller.lazyInitWalletReady(network, accountNumber)) {
      // wallet not ready, definitely can use cached nfts (if any)
      const cachedNfts = await restoreCachedNfts(cacheKey, storage);
      if (cachedNfts) return cachedNfts;
    }

    const wallet = await backgroundCaller.lazyInitWallet(network, accountNumber);
    assert(wallet instanceof StacksWallet, 'Not a Stacks wallet');

    const nfts = await wallet.fetchNfts();
    await storage.setItem(cacheKey, JSON.stringify(nfts));
    return nfts;
  }

  // for unsupported networks, return empty array
  return [];
};

export function useNftDiscovery(network: Networks, accountNumber: number, backgroundCaller: IBackgroundCaller, storage: IStorage, refreshInterval = 5_000) {
  // Only enable refresh interval for NETWORK_SPARK & NETWORK_STACKS
  const shouldRefresh = network === NETWORK_SPARK || network === NETWORK_STACKS;

  const arg: nftDiscoveryFetcherArg = {
    cacheKey: 'nftDiscoveryFetcher',
    network,
    accountNumber,
    backgroundCaller,
    storage,
  };

  const { data, error, isLoading, mutate } = useSWR(arg, nftDiscoveryFetcher, {
    refreshInterval: shouldRefresh ? refreshInterval : undefined,
    refreshWhenHidden: false,
    keepPreviousData: true,
  });

  return {
    nftList: data ?? [],
    isLoading,
    error: error instanceof Error ? error : error ? new Error('Unknown error') : null,
    mutate,
  };
}
