import { AssetId } from '../types/asset';

/**
 * Bidirectional mapping between AssetId and Garden Finance asset identifiers.
 * Garden uses its own "chain:token" format (e.g., "bitcoin:btc", "botanix:btc")
 * which is unrelated to our AssetId format.
 * @see https://docs.garden.finance
 */
const ASSET_ID_TO_GARDEN: Partial<Record<AssetId, string>> = {
  'native:bitcoin': 'bitcoin:btc',
  'native:botanix': 'botanix:btc',
};

export function toGardenAsset(assetId: AssetId): string {
  const mapping = ASSET_ID_TO_GARDEN[assetId];
  if (!mapping) {
    throw new Error(`Asset ${assetId} not supported by Garden`);
  }
  return mapping;
}

export function isGardenSupported(assetId: AssetId): boolean {
  return assetId in ASSET_ID_TO_GARDEN;
}
