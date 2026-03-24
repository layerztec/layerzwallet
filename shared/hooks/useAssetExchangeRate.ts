import { getAssetInfo } from '../models/asset-info';
import { AssetId } from '../types/asset';
import { NETWORK_BITCOIN, Networks } from '../types/networks';
import { useExchangeRate } from './useExchangeRate';
import { useSelectedFiat } from './useSelectedFiat';
import { useTokenExchangeRate } from './useTokenExchangeRate';

/**
 * Fetches the USD exchange rate for a transfer asset id.
 * Routes to useExchangeRate for native assets, useTokenExchangeRate for tokens.
 * Both hooks are called unconditionally (React rules); we return the appropriate one.
 */
export function useAssetExchangeRate(assetId: AssetId | undefined): { exchangeRate: number | undefined } {
  const assetInfo = assetId ? getAssetInfo(assetId) : undefined;
  const network: Networks = assetInfo?.network ?? NETWORK_BITCOIN;
  const isToken = !!assetInfo?.tokenId;
  const fiat = useSelectedFiat();

  const { exchangeRate: nativeRate } = useExchangeRate(network, fiat);
  const { tokenExchangeRate } = useTokenExchangeRate(network, assetInfo?.tokenId ?? '', fiat);

  if (!assetInfo) return { exchangeRate: undefined };

  const rate = isToken ? tokenExchangeRate : nativeRate;
  // Treat 0 as unavailable (testnet returns 0)
  return { exchangeRate: rate && rate > 0 ? rate : undefined };
}
