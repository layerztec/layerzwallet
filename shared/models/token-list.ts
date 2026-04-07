import { NETWORK_LIQUID, NETWORK_ROOTSTOCK, NETWORK_SPARK, NETWORK_STACKS, Networks } from '../types/networks';
import { TokenInfo, EVMTokenInfo, LiquidTokenInfo, SparkTokenInfo } from '../types/token-info';
import { getChainIdByNetwork } from './network-getters';
import { hexToDec } from '../modules/string-utils';
import { overlayBackground } from '../constants/Colors';
import { CommonTokenTransfer } from '../types/common-transaction';

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

const manuallyDefinedTokens: TokenInfo[] = [
  {
    id: 'stx',
    chainId: hexToDec(getChainIdByNetwork(NETWORK_STACKS)),
    name: 'Stacks',
    decimals: 6,
    symbol: 'STX',
  },
];

const list: TokenInfo[] = [...evmList.map(evmToCommonTokenInfo), ...liquidList.map(liquidToCommonTokenInfo), ...sparkList.map(sparkToCommonTokenInfo), ...manuallyDefinedTokens];

export function getTokenList(network: Networks): TokenInfo[] {
  let ret: TokenInfo[] = [];

  for (const token of list) {
    if (token.chainId === hexToDec(getChainIdByNetwork(network))) {
      ret.push(token);
    }
  }

  return ret;
}

/**
 * tries to get token info from the Token Transfer object. If its populated in Token Transfer it will return it,
 * if not - will fallback to getting data from bundled token-list, if its absent - dummy data ("UNK" token)
 */
export function resolveTokenInfo(transfer: CommonTokenTransfer): TokenInfo {
  try {
    if (transfer.symbol) {
      return {
        symbol: transfer.symbol,
        decimals: transfer.decimals,
        name: transfer.name || transfer.symbol,
        chainId: 0,
        id: transfer.tokenId,
        logoURI: transfer.logoURI,
      };
    }

    return getTokenInfo(transfer.tokenId);
  } catch (error) {
    globalThis.handleError?.(error, 'token-list.ts');
    console.log('No info about the token in transaction, fallback to dummy data', error, 'transfer =', JSON.stringify(transfer));
    return {
      id: transfer.tokenId,
      chainId: 0,
      name: 'Unknown',
      decimals: 0,
      symbol: 'UNK',
    };
  }
}

export function getTokenInfo(id: string | undefined): TokenInfo {
  if (!id) {
    throw new Error('Token id is required');
  }
  const token = list.find((t) => t.id.toLowerCase() === id?.toLowerCase());
  if (token) {
    return token;
  }
  throw new Error(`Token not found: ${id}`);
}

export function shortenTokenId(id: string): string {
  const s = id.trim();
  if (s.length <= 14) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
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
    'USD₮0': '#26A17B', // Tether green
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
