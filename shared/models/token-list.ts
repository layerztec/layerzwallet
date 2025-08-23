import { Networks } from '../types/networks';
import { TokenInfo, EVMTokenInfo, LiquidTokenInfo } from '../types/token-info';
import { getChainIdByNetwork } from './network-getters';
import { hexToDec } from '../modules/string-utils';

// kept as a separate json just because in evm world token list is standard by itself and
// json files can be shared, imported etc
const evmList: EVMTokenInfo[] = require('./tokenlist.json');
const liquidList: LiquidTokenInfo[] = require('./tokenlist-liquid.json');

export function evmToCommonTokenInfo(token: EVMTokenInfo): TokenInfo {
  return {
    id: token.address,
    chainId: token.chainId,
    name: token.name,
    decimals: token.decimals,
    symbol: token.symbol,
    logoURI: token.logoURI,
    tags: token.tags,
    extensions: token.extensions,
  };
}

function liquidToCommonTokenInfo(token: LiquidTokenInfo): TokenInfo {
  return {
    id: token.assetId,
    chainId: token.chainId,
    name: token.name,
    decimals: token.decimals,
    symbol: token.symbol,
  };
}

const list: TokenInfo[] = [...evmList.map(evmToCommonTokenInfo), ...liquidList.map(liquidToCommonTokenInfo)];

export function getTokenList(network: Networks): TokenInfo[] {
  let ret: TokenInfo[] = [];

  for (const token of list) {
    if (token.chainId === hexToDec(getChainIdByNetwork(network))) {
      ret.push(token);
    }
  }

  return ret;
}

export function getTokenInfo(id: string | undefined): TokenInfo {
  const token = list.find((t) => t.id === id);
  if (token) {
    return token;
  }
  // if token is not found, we return something
  return {
    id: String(id),
    name: 'Unknown Token',
    decimals: 8,
    symbol: String(id).substring(0, 8),
    chainId: 99999,
  };
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
