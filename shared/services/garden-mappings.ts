/**
 * Bidirectional mapping between AssetId and Garden Finance asset identifiers.
 * Garden format: "chain:token" (e.g., "bitcoin:btc", "botanix:btc")
 */

const ASSET_ID_TO_GARDEN: Record<string, string> = {
  'native:bitcoin': 'bitcoin:btc',
  'native:botanix': 'botanix:btc',
};

export function toGardenAsset(assetId: string): string {
  const mapping = ASSET_ID_TO_GARDEN[assetId];
  if (!mapping) {
    throw new Error(`Asset ${assetId} not supported by Garden`);
  }
  return mapping;
}

export function isGardenSupported(assetId: string): boolean {
  return assetId in ASSET_ID_TO_GARDEN;
}
