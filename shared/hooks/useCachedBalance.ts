import { useSWRConfig } from 'swr';
import { NETWORK_LIGHTNING, NETWORK_LIGHTNING_TESTNET, NETWORK_LIQUID, NETWORK_LIQUID_TESTNET, NETWORK_SPARK, Networks } from '../types/networks';
import { StringNumber } from '../types/string-number';

/**
 * Hook to get cached balance for a specific network and account from the SWR cache.
 * This hook accesses the SWR cache directly without triggering network requests.
 *
 * @param network - the network for which to get the balance
 * @param accountNumber - the account number
 *
 * @returns the cached balance as a StringNumber, or undefined if not found in cache
 */
export function useCachedBalance(network: Networks, accountNumber: number): { balance: StringNumber | undefined } {
  const { cache } = useSWRConfig();

  let sum = 0;
  let cacheHit = false;

  for (const key of cache.keys()) {
    if (key.includes(`balanceFetcher`) && key.includes(`accountNumber:${accountNumber}`) && key.includes(`network:"${network}"`)) {
      const balance = cache.get(key);
      sum += parseInt(balance?.data ?? 0);
      cacheHit = true;
    }

    if (network === NETWORK_LIGHTNING) {
      // special case, lightning balance consists of several balances (currently spark and liquid)

      if (key.includes(`balanceFetcher`) && key.includes(`accountNumber:${accountNumber}`) && key.includes(`network:"${NETWORK_SPARK}"`)) {
        const balance = cache.get(key);
        sum += parseInt(balance?.data ?? 0);
        cacheHit = true;
      }

      if (key.includes(`balanceFetcher`) && key.includes(`accountNumber:${accountNumber}`) && key.includes(`network:"${NETWORK_LIQUID}"`)) {
        const balance = cache.get(key);
        sum += parseInt(balance?.data ?? 0);
        cacheHit = true;
      }
    }

    if (network === NETWORK_LIGHTNING_TESTNET) {
      // special case, like lightning, but only liquid supported

      if (key.includes(`balanceFetcher`) && key.includes(`accountNumber:${accountNumber}`) && key.includes(`network:"${NETWORK_LIQUID_TESTNET}"`)) {
        const balance = cache.get(key);
        sum += parseInt(balance?.data ?? 0);
        cacheHit = true;
      }
    }
  }

  return {
    balance: cacheHit ? String(sum) : undefined,
  };
}
