import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';

import { hexStr } from '../modules/string-utils';
import { getAvailableNetworks, NETWORK_ARK, NETWORK_ARK_MUTINYNET, NETWORK_BITCOIN, NETWORK_RGB, NETWORK_RGB_TESTNET, NETWORK_SPARK, NETWORK_STACKS, Networks } from '../types/networks';
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
  // Only consider EVM networks: wallet_switchEthereumChain is EVM-only, and non-EVM
  // networks share placeholder chainIds (e.g. 0) that would cause false matches.
  for (const net of getAvailableNetworks()) {
    if (!AllNetworkInfos[net]?.isEVM) continue;
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

export function getIsEVM(network: Networks): boolean {
  if (!AllNetworkInfos[network]) {
    // safeguard
    throw new Error(`Network not implemented: ${network}`);
  }

  return Boolean(AllNetworkInfos[network].isEVM);
}

export function getIsAccountBased(network: Networks): boolean {
  return network === NETWORK_ARK || network === NETWORK_ARK_MUTINYNET || network === NETWORK_SPARK || network === NETWORK_STACKS || network === NETWORK_RGB || network === NETWORK_RGB_TESTNET;
}
