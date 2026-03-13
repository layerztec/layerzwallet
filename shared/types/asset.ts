import {
  NETWORK_ARK,
  NETWORK_BITCOIN,
  NETWORK_BOTANIX,
  NETWORK_BOTANIX_TESTNET,
  NETWORK_CITREA,
  NETWORK_LIQUID,
  NETWORK_LIQUID_TESTNET,
  NETWORK_ROOTSTOCK,
  NETWORK_SPARK,
  NETWORK_STACKS,
  Networks,
} from './networks';

export const ASSET_IDS = [
  `native:${NETWORK_ARK}`,
  `native:${NETWORK_BITCOIN}`,
  `native:${NETWORK_BOTANIX}`,
  `native:${NETWORK_BOTANIX_TESTNET}`,
  `native:${NETWORK_CITREA}`,
  `native:${NETWORK_LIQUID}`,
  `native:${NETWORK_LIQUID_TESTNET}`,
  `native:${NETWORK_ROOTSTOCK}`,
  `native:${NETWORK_SPARK}`,
  `token:${NETWORK_LIQUID}:usdt`,
  `token:${NETWORK_SPARK}:usdb`,
  `token:${NETWORK_STACKS}:stx`,
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
