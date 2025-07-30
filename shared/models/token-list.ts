import { Networks } from '../types/networks';
import { TokenInfo } from '../types/token-info';
import { getChainIdByNetwork } from './network-getters';
import { hexToDec } from '../modules/string-utils';

// kept as a separate json just because in evm world token list is standard by itself and
// json files can be shared, imported etc
const list: TokenInfo[] = require('./tokenlist.json');

export function getTokenList(network: Networks): TokenInfo[] {
  let ret: TokenInfo[] = [];

  for (const token of list) {
    if (token.chainId === hexToDec(getChainIdByNetwork(network))) {
      ret.push(token);
    }
  }

  return ret;
}

// Unified function for getting token/asset icon colors
export const getTokenIconColor = (name?: string): string => {
  const colorMap: { [key: string]: string } = {
    // Bitcoin variants
    BTC: '#F7931A', // Bitcoin orange
    BTCC: '#F7931A', // Bitcoin orange
    LBTC: '#F7931A', // Liquid Bitcoin orange

    // Stablecoins
    USDT: '#26A17B', // Tether green
    RUSDT: '#26A17B', // Tether green
    USDC: '#2775CA', // USD Coin blue
  };

  if (!name) {
    return '#8A92B2'; // Default gray
  }

  const key = name.toUpperCase();
  return colorMap[key] || '#8A92B2'; // Default gray
};
