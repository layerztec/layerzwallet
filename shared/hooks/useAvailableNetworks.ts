import { useMemo } from 'react';
import { getAvailableNetworks, Networks } from '../types/networks';
import { getIsTestnet } from '../models/network-getters';
import { useSetting } from './useSettings';

/**
 * Hook that returns available networks filtered by testnet settings
 * Filters out testnet networks if showTestnets is set to 'OFF'
 */
export const useAvailableNetworks = (): Networks[] => {
  const showTestnets = useSetting('showTestnets');

  return useMemo(() => {
    const allNetworks = getAvailableNetworks();

    if (showTestnets === 'ON') {
      return allNetworks;
    }

    // Filter out testnet networks when showTestnets is 'OFF'
    return allNetworks.filter((network) => !getIsTestnet(network));
  }, [showTestnets]);
};
