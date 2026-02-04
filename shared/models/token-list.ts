import { NETWORK_LIQUID, NETWORK_ROOTSTOCK, NETWORK_SPARK, Networks } from '../types/networks';
import { TokenInfo, EVMTokenInfo, LiquidTokenInfo, SparkTokenInfo } from '../types/token-info';
import { getChainIdByNetwork } from './network-getters';
import { hexToDec } from '../modules/string-utils';
import { overlayBackground } from '../constants/Colors';

// kept as a separate json just because in evm world token list is standard by itself and
// json files can be shared, imported etc
const evmList: EVMTokenInfo[] = require('./tokenlist.json');
const liquidList: LiquidTokenInfo[] = require('./tokenlist-liquid.json');
const sparkList: SparkTokenInfo[] = require('./tokenlist-spark.json');

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
    logoURI: token.logoURI,
  };
}

function sparkToCommonTokenInfo(token: SparkTokenInfo): TokenInfo {
  return {
    id: token.tokenIdentifier,
    chainId: token.chainId,
    name: token.name,
    decimals: token.decimals,
    symbol: token.symbol,
    logoURI: token.logoURI,
  };
}

const list: TokenInfo[] = [...evmList.map(evmToCommonTokenInfo), ...liquidList.map(liquidToCommonTokenInfo), ...sparkList.map(sparkToCommonTokenInfo)];

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
  const token = list.find((t) => t.id.toLowerCase() === id?.toLowerCase());
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
    USDB: '#26A17B', // USDB green (stablecoin)
    USDC: '#2775CA', // USD Coin blue
  };

  if (!name) {
    return overlayBackground; // Default overlay
  }

  const key = name.toUpperCase();
  return colorMap[key] || overlayBackground; // Default overlay
};

export const USDT_TOKENS = {
  [NETWORK_ROOTSTOCK]: [
    '0xAF368c91793cb22739386DFCBbB2f1A9E4bcBEBf', // USDT
    '0x779dED0C9e1022225F8e0630b35A9B54Be713736', // USDT0
    '0xEf213441a85DF4d7acBdAe0Cf78004E1e486BB96', // rUSDT
  ],
  [NETWORK_LIQUID]: [
    'ce091c998b83c78bb71a632313ba3760f1763d9cfcffae02258ffa9865a37bd2', // USDT
  ],
  [NETWORK_SPARK]: [
    'btkn1xgrvjwey5ngcagvap2dzzvsy4uk8ua9x69k82dwvt5e7ef9drm9qztux87', // USDB
  ],
} as const;
