import { useSWRConfig } from 'swr';
import { NETWORK_ARK, NETWORK_LIGHTNING, NETWORK_LIGHTNING_TESTNET, NETWORK_LIQUID, NETWORK_LIQUID_TESTNET, NETWORK_ROOTSTOCK, NETWORK_SPARK, NETWORK_USDT, Networks } from '../types/networks';
import { StringNumber } from '../types/string-number';
import { USDT_TOKENS, getTokenInfo } from '@shared/models/token-list';

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
  // because tokens are sometimes exists in different keys, we need to only check one
  const checked = new Set<string>();

  for (const key of cache.keys()) {
    if (key.includes(`balanceFetcher`) && key.includes(`accountNumber:${accountNumber}`) && key.includes(`network:"${network}"`)) {
      const balance = cache.get(key);
      sum += parseInt(balance?.data ?? 0);
      cacheHit = true;
    }

    if (network === NETWORK_LIGHTNING) {
      // special case, lightning balance consists of several balances (currently spark, ark, and liquid)

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

      if (key.includes(`balanceFetcher`) && key.includes(`accountNumber:${accountNumber}`) && key.includes(`network:"${NETWORK_ARK}"`)) {
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

    if (network === NETWORK_USDT) {
      // special case, usdt balance consists of several token balances (rootstock: usdt, usdt0, rusdt; liquid: usdt)

      for (const token of USDT_TOKENS[NETWORK_LIQUID]) {
        if (key.includes(`tokenBalanceFetcher`) && key.includes(`accountNumber:${accountNumber}`) && key.includes(`network:"${NETWORK_LIQUID}"`) && key.includes(`tokenContractAddress:"${token}"`)) {
          if (checked.has(token)) continue;
          const { decimals } = getTokenInfo(token);
          const balance = cache.get(key);
          sum += parseInt(balance?.data ?? 0) / 10 ** decimals;
          cacheHit = true;
          checked.add(token);
        }
      }

      if (key.includes(`tokenBalanceFetcher`) && key.includes(`accountNumber:${accountNumber}`) && key.includes(`network:"${NETWORK_ROOTSTOCK}"`)) {
      }

      for (const token of USDT_TOKENS[NETWORK_ROOTSTOCK]) {
        if (
          key.includes(`tokenBalanceFetcher`) &&
          key.includes(`accountNumber:${accountNumber}`) &&
          key.includes(`network:"${NETWORK_ROOTSTOCK}"`) &&
          key.includes(`tokenContractAddress:"${token}"`)
        ) {
          if (checked.has(token)) continue;
          const { decimals } = getTokenInfo(token);
          const balance = cache.get(key);
          sum += parseInt(balance?.data ?? 0) / 10 ** decimals;
          cacheHit = true;
          checked.add(token);
        }
      }
    }
  }

  return {
    balance: cacheHit ? String(sum) : undefined,
  };
}
