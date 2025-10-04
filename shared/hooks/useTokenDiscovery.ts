import { useState, useEffect, useCallback, useRef } from 'react';
import { Networks, NETWORK_SPARK, NETWORK_LIQUID, NETWORK_LIQUID_TESTNET } from '../types/networks';
import { CachedTokenInfo } from '../types/token-info';
import { getTokenList } from '../models/token-list';
import { IBackgroundCaller } from '../types/IBackgroundCaller';
import { SparkWallet } from '../class/wallets/spark-wallet';
import assert from 'assert';
import { IStorage } from '../types/IStorage';

const STORAGE_KEY_CACHED_TOKEN_LIST = 'STORAGE_KEY_CACHED_TOKEN_LIST';

export function useTokenDiscovery(network: Networks, accountNumber: number, backgroundCaller: IBackgroundCaller, storage: IStorage, refreshInterval = 2_000) {
  const [tokenList, setTokenList] = useState<CachedTokenInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | number | null>(null);

  /**
   * returns true if cached tokens are present, and successfully restored to state, false otherwise
   */
  const restoreCachedTokens = useCallback(
    async (cacheKey: string) => {
      try {
        const cachedTokensString = await storage.getItem(cacheKey);
        const cachedTokens = JSON.parse(cachedTokensString);
        if (Array.isArray(cachedTokens) && cachedTokens.length > 0) {
          setTokenList(cachedTokens);
          return true;
        }
      } catch (_) {}
      return false;
    },
    [storage]
  );

  const fetchTokens = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (network === NETWORK_SPARK) {
        const cacheKey = STORAGE_KEY_CACHED_TOKEN_LIST + network + accountNumber;

        if (!backgroundCaller.lazyInitWalletReady(network, accountNumber)) {
          // wallet not ready, definately can use cached tokens (if any)
          if (await restoreCachedTokens(cacheKey)) return;
        }

        // Lazy initialize Spark wallet
        const wallet = await backgroundCaller.lazyInitWallet(network, accountNumber);
        assert(wallet instanceof SparkWallet, 'Not a Spark wallet');

        // we do NOT fetch from network, we rely on cached value inside wallet internals

        if (!wallet._lastBalanceFetch) {
          // balance never fetched yet, so we can use cached tokens (if any)
          if (await restoreCachedTokens(cacheKey)) return;
        }

        const tokenInfos: CachedTokenInfo[] = [];

        for (const [, token] of wallet.getTokenBalances()) {
          tokenInfos.push({
            id: token.tokenMetadata.tokenPublicKey,
            chainId: 0, // SPARK doesn't have a traditional chainId
            name: token.tokenMetadata.tokenName,
            decimals: token.tokenMetadata.decimals,
            symbol: token.tokenMetadata.tokenTicker,
            balance: String(token.balance),
          });
        }

        if (tokenInfos.length > 0) await storage.setItem(cacheKey, JSON.stringify(tokenInfos)); // saving to cache

        setTokenList(tokenInfos);
      } else if (network === NETWORK_LIQUID || network === NETWORK_LIQUID_TESTNET) {
        const tokens = getTokenList(network).map((token) => ({
          ...token,
          balance: undefined,
        }));
        setTokenList(tokens);
      } else {
        // For all other networks, return the standard token list
        // Adapt TokenInfo[] to CachedTokenInfo[] by adding a default balance
        const tokens = getTokenList(network).map((token) => ({
          ...token,
          balance: undefined,
        }));
        setTokenList(tokens);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [network, accountNumber, backgroundCaller, restoreCachedTokens, storage]);

  useEffect(() => {
    // Initial fetch
    fetchTokens();

    // Set up periodic refresh only for NETWORK_SPARK
    if (network === NETWORK_SPARK) {
      intervalRef.current = setInterval(fetchTokens, refreshInterval);
    }

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchTokens, refreshInterval, network]);

  return {
    tokenList,
    isLoading,
    error,
  };
}
