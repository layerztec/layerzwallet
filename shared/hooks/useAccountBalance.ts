import { useSWRConfig } from 'swr';
import { NETWORK_BITCOIN, NETWORK_LIGHTNING, Networks } from '../types/networks';
import { getDecimalsByNetwork, getIsTestnet } from '../models/network-getters';
import { StringNumber } from '../types/string-number';

/**
 * a bit hacky hook to get whole account balance from the SWR cache.
 * accessing SWR cache is legit, through the official SWR api.
 * as a sideeffect, we can also get _cached_ balance for a single network (that wont trigger network fetch)
 *
 * @param accountNumber - the account number
 * @param availableNetworks - array of networks for which we want to get the balance (since user might
 *                            disable showing some networks in the UI)
 *
 * @returns the account balance in **sats** (as a StringNumber), networks with higher denomination
 *          will be truncated (aka precision dropped)
 */
export const useAccountBalance = (accountNumber: number, availableNetworks: Networks[]): { accountBalance: StringNumber } => {
  const { cache } = useSWRConfig();

  let sumSats = 0;

  for (const key of cache.keys()) {
    for (const network of availableNetworks) {
      if (network === NETWORK_LIGHTNING) continue; // its an "aggregated" network, we don't need to count it

      if (getIsTestnet(network)) continue; // we don't count testnet networks, they are worthless

      if (key.includes(`balanceFetcher`) && key.includes(`accountNumber:${accountNumber}`) && key.includes(`network:"${network}"`)) {
        const balance = cache.get(key);
        let networkBalance = parseInt(balance?.data);
        const defaultDecimals = getDecimalsByNetwork(NETWORK_BITCOIN);
        const decimals = getDecimalsByNetwork(network);

        if (balance?.data && networkBalance) {
          if (decimals > defaultDecimals) {
            // droping extra precision for networks that have more decimals than bitcoin,
            // but still peg 1 to 1 with btc
            networkBalance = Math.floor(networkBalance / 10 ** (decimals - defaultDecimals));
          }

          sumSats += networkBalance;
        }
      }
    }
  }

  return {
    accountBalance: String(sumSats),
  };
};
