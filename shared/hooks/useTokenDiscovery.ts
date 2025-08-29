import { useState, useEffect, useCallback, useRef } from 'react';
import { Networks, NETWORK_SPARK } from '../types/networks';
import { TokenInfo } from '../types/token-info';
import { getTokenList } from '../models/token-list';
import { IBackgroundCaller } from '../types/IBackgroundCaller';
import { SparkWallet } from '../class/wallets/spark-wallet';
import assert from 'assert';

export function useTokenDiscovery(network: Networks, accountNumber: number, backgroundCaller: IBackgroundCaller, refreshInterval = 1_000) {
  const [tokenList, setTokenList] = useState<TokenInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | number | null>(null);

  const fetchTokens = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (network === NETWORK_SPARK) {
        // Lazy initialize Spark wallet
        const wallet = await backgroundCaller.lazyInitWallet(network, accountNumber);
        assert(wallet instanceof SparkWallet, 'Not a Spark wallet');

        // we do NOT fetch from network, we rely on cached value inside wallet internals

        const tokenInfos: TokenInfo[] = [];

        for (const [, token] of wallet.getTokenBalances()) {
          tokenInfos.push({
            id: token.tokenMetadata.tokenPublicKey,
            chainId: 0, // SPARK doesn't have a traditional chainId
            name: token.tokenMetadata.tokenName,
            decimals: token.tokenMetadata.decimals,
            symbol: token.tokenMetadata.tokenTicker,
          });
        }

        setTokenList(tokenInfos);
      } else {
        // For all other networks, return the standard token list
        setTokenList(getTokenList(network));
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [network, accountNumber, backgroundCaller]);

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
