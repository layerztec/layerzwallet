import { TFiat } from '../types/fiat';
import { useSetting } from './useSettings';

export function useSelectedFiat(): TFiat {
  return useSetting('currency');
}
