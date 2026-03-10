import { Networks } from './networks';

export const ASSET_IDS = [
  'native:arkade',
  'native:bitcoin',
  'native:botanix',
  'native:botanix_testnet',
  'native:citrea',
  'native:liquid',
  'native:liquid_testnet',
  'native:rootstock',
  'native:spark',
  'token:liquid:usdt',
  'token:spark:usdb',
  'token:stacks:stx',
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
