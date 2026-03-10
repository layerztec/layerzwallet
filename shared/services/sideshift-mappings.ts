/**
 * Bidirectional mapping between TransferAsset.id and SideShift coin+network identifiers.
 * @see https://sideshift.ai/api/v2/coins
 */
export interface SideshiftAssetMapping {
  coin: string;
  network: string;
}

const ASSET_ID_TO_SIDESHIFT: Record<string, SideshiftAssetMapping> = {
  'native:bitcoin': { coin: 'BTC', network: 'bitcoin' },
  'native:liquid': { coin: 'BTC', network: 'liquid' },
  'token:liquid:usdt': { coin: 'USDT', network: 'liquid' },
  'native:rootstock': { coin: 'RBTC', network: 'rootstock' },
  'token:stacks:stx': { coin: 'STX', network: 'stacks' },
};

export function toSideshiftAsset(assetId: string): SideshiftAssetMapping {
  const mapping = ASSET_ID_TO_SIDESHIFT[assetId];
  if (!mapping) {
    throw new Error(`Asset ${assetId} not supported by SideShift`);
  }
  return mapping;
}

export function isSideshiftSupported(assetId: string): boolean {
  return assetId in ASSET_ID_TO_SIDESHIFT;
}

/**
 * Format a SideShift method ID from coin+network.
 * SideShift pair endpoint uses format: {coin}-{network} (e.g., "BTC-bitcoin", "RBTC-rootstock")
 */
export function toSideshiftMethodId(mapping: SideshiftAssetMapping): string {
  return `${mapping.coin}-${mapping.network}`;
}
