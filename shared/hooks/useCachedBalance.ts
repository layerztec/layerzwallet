import { useSWRConfig } from 'swr';
import { Networks } from '../types/networks';
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

  for (const key of cache.keys()) {
    if (key.includes(`balanceFetcher`) && key.includes(`accountNumber:${accountNumber}`) && key.includes(`network:"${network}"`)) {
      const balance = cache.get(key);
      if (balance?.data) {
        return {
          balance: balance.data,
        };
      }
    }
  }

  return {
    balance: undefined,
  };
}
