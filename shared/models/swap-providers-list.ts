import { SwapProvider } from '../types/swap';
import { SwapProviderBoltz } from './swap-provider-boltz';
import { SwapProviderOnramper } from './swap-provider-onramper';
import { Networks } from '@shared/types/networks';

const swapPartnersList: SwapProvider[] = [new SwapProviderOnramper(), new SwapProviderBoltz()];

/**
 * @returns list of swap providers that can swap FROM provided network (to smth else)
 */
export function getSwapProvidersList(network: Networks): SwapProvider[] {
  return swapPartnersList.filter((partner) => partner.getSupportedPairs().some((pair) => pair.from === network));
}
