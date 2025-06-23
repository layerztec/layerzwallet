import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';

import { getAvailableNetworks, NETWORK_BITCOIN, Networks } from '../types/networks';
import { hexStr } from '../modules/string-utils';
import { AllNetworkInfos } from './all-network-infos';

/**
 * Returns hex ChainId for the network
 */
export function getChainIdByNetwork(network: Networks): string {
  if (!AllNetworkInfos[network]) {
    // safeguard
    throw new Error('Network not implemented');
  }

  // hexStr returns undefined only if input is undefined
  return hexStr(AllNetworkInfos[network].chainId)!;
}

export function getNetworkByChainId(chainId: string): Networks | undefined {
  for (const net of getAvailableNetworks()) {
    if (getChainIdByNetwork(net) === chainId) {
      return net;
    }
  }

  return undefined;
}

export function getTickerByNetwork(network: Networks): string {
  if (!AllNetworkInfos[network]) {
    // safeguard
    throw new Error('Network not implemented');
  }

  return AllNetworkInfos[network].ticker;
}

export function getDecimalsByNetwork(network: Networks): number {
  if (!AllNetworkInfos[network]) {
    // safeguard
    throw new Error('Network not implemented');
  }

  return AllNetworkInfos[network].decimals;
}

export function getExplorerUrlByNetwork(network: Networks): string {
  if (!AllNetworkInfos[network]) {
    // safeguard
    throw new Error('Network not implemented');
  }

  return AllNetworkInfos[network].explorerUrl;
}

export function getRpcProvider(network: Networks): ethers.JsonRpcProvider {
  if (network === NETWORK_BITCOIN) {
    throw new Error('You`re on the wrong network, switch to an EVM-compatible sidechain');
  }

  if (!AllNetworkInfos[network]) {
    // safeguard
    throw new Error('Network not implemented');
  }

  return new ethers.JsonRpcProvider(AllNetworkInfos[network].rpcUrl, new BigNumber(getChainIdByNetwork(network)).toNumber());
}

export function getIsTestnet(network: Networks): boolean {
  if (!AllNetworkInfos[network]) {
    // safeguard
    throw new Error(`Network not implemented: ${network}`);
  }

  return Boolean(AllNetworkInfos[network].isTestnet);
}

export function getKnowMoreUrl(network: Networks): string | undefined {
  if (!AllNetworkInfos[network]) {
    // safeguard
    throw new Error(`Network not implemented: ${network}`);
  }

  return AllNetworkInfos[network].knowMoreUrl;
}
