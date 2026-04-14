import {
  NETWORK_ALPEN_TESTNET,
  NETWORK_ARK,
  NETWORK_ARK_MUTINYNET,
  NETWORK_BITCOIN,
  NETWORK_BOTANIX,
  NETWORK_BOTANIX_TESTNET,
  NETWORK_CITREA,
  NETWORK_CITREA_TESTNET,
  NETWORK_LIGHTNING,
  NETWORK_LIGHTNING_TESTNET,
  NETWORK_LIQUID,
  NETWORK_LIQUID_TESTNET,
  NETWORK_ROOTSTOCK,
  NETWORK_SEPOLIA,
  NETWORK_SPARK,
  NETWORK_STACKS,
  NETWORK_USDT,
  Networks,
} from './networks';

export const ASSET_IDS = [
  `native:${NETWORK_ALPEN_TESTNET}`,
  `native:${NETWORK_ARK}`,
  `native:${NETWORK_ARK_MUTINYNET}`,
  `native:${NETWORK_BITCOIN}`,
  `native:${NETWORK_BOTANIX}`,
  `native:${NETWORK_BOTANIX_TESTNET}`,
  `native:${NETWORK_CITREA}`,
  `native:${NETWORK_CITREA_TESTNET}`,
  `native:${NETWORK_LIQUID}`,
  `native:${NETWORK_LIQUID_TESTNET}`,
  `native:${NETWORK_ROOTSTOCK}`,
  `native:${NETWORK_SEPOLIA}`,
  `native:${NETWORK_SPARK}`,
  `native:${NETWORK_STACKS}`,
  // we are keeping these meta networks to make TS happy,
  // even though they are incorrect
  `native:${NETWORK_LIGHTNING}`,
  `native:${NETWORK_LIGHTNING_TESTNET}`,
  `native:${NETWORK_USDT}`,
  `token:${NETWORK_LIQUID}:usdt`,
  `token:${NETWORK_SPARK}:usdb`,
  `token:${NETWORK_STACKS}:stx`,
  `token:${NETWORK_ROOTSTOCK}:usdt0`,
] as const;

/** Strict asset identity — used as a universal identifier across the app */
export type AssetId = (typeof ASSET_IDS)[number];

/** Fully resolved metadata for an asset */
export interface AssetInfo {
  id: AssetId;
  network: Networks;
  name: string;
  ticker: string;
  decimals: number;
  tokenId?: string;
  networkDisplayName: string;
}
