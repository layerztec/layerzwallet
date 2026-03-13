import { getAssetInfo } from '../models/asset-info';
import { AssetId } from '../types/asset';
import { IBackgroundCaller } from '../types/IBackgroundCaller';
import { useBalance } from './useBalance';
import { useTokenBalance } from './useTokenBalance';

export function useAssetBalance(assetId: AssetId | undefined, accountNumber: number, backgroundCaller: IBackgroundCaller) {
  const info = assetId ? getAssetInfo(assetId) : undefined;
  const isToken = !!info?.tokenId;

  const native = useBalance(info?.network ?? 'bitcoin', accountNumber, backgroundCaller);
  const token = useTokenBalance(info?.network ?? 'bitcoin', accountNumber, info?.tokenId ?? '', backgroundCaller);

  if (!assetId) return { balance: undefined, isLoading: false };
  return isToken ? token : native;
}
