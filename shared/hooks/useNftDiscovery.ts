import assert from 'assert';
import useSWR from 'swr';

import { IBackgroundCaller } from '../types/IBackgroundCaller';
import { IStorage } from '../types/IStorage';
import { NETWORK_STACKS, NETWORK_SPARK, Networks } from '../types/networks';
import { NftInfo } from '../types/token-info';
import { walletCanHaveNfts } from '@shared/class/wallets/interface-can-have-nfts';

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

  if (network === NETWORK_STACKS || network === NETWORK_SPARK) {
    const cacheKey = STORAGE_KEY_CACHED_NFT + network + accountNumber;

    if (!backgroundCaller.lazyInitWalletReady(network, accountNumber)) {
      // wallet not ready, definitely can use cached nfts (if any)
      const cachedNfts = await restoreCachedNfts(cacheKey, storage);
      if (cachedNfts) return cachedNfts;
    }

    const wallet = await backgroundCaller.lazyInitWallet(network, accountNumber);
    assert(walletCanHaveNfts(wallet), 'Not an NFT-capable wallet');

    if (!wallet._lastNftsFetch) {
      // wallet initialized, but NFTs never fetched yet, lets again use cache:
      const cachedNfts = await restoreCachedNfts(cacheKey, storage);
      if (cachedNfts) return cachedNfts;
    }

    const nfts = await wallet.fetchNfts();
    await storage.setItem(cacheKey, JSON.stringify(nfts));
    return nfts;
  }

  // for unsupported networks, return empty array
  return [];
};

export function useNftDiscovery(network: Networks, accountNumber: number, backgroundCaller: IBackgroundCaller, storage: IStorage, refreshInterval = 10_000) {
  let shouldRefresh = false;
  switch (network) {
    case NETWORK_STACKS:
    case NETWORK_SPARK:
      shouldRefresh = true;
      break;
  }

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
