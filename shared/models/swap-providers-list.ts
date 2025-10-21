import { SO_LIQUID_USDT, SwapOptions, SwapPair, SwapPlatform, SwapProvider } from '../types/swap';
import { SwapProviderBoltz } from './swap-provider-boltz';
import { SwapProviderOnramper } from './swap-provider-onramper';
import { SwapProviderSideshift } from './swap-provider-sideshift';
import { SwapProviderGardenFinance } from './swap-provider-gardenfinance';
import { SwapProviderXArk } from './swap-provider-xark';
import { capitalizeFirstLetter } from '@shared/modules/string-utils';

const swapPartnersList: SwapProvider[] = [new SwapProviderOnramper(), new SwapProviderSideshift(), new SwapProviderBoltz(), new SwapProviderGardenFinance(), new SwapProviderXArk()];

/**
 * @returns list of swap providers that can swap FROM provided network (to smth else)
 */
export function getSwapProvidersList(network: SwapOptions): SwapProvider[] {
  return swapPartnersList.filter((partner) => partner.getSupportedPairs().some((pair) => pair.from === network));
}

/**
 * @returns list of possible swap pairs where source network matches provided network
 */
export function getSwapPairs(network: SwapOptions, swapPlatform: SwapPlatform): SwapPair[] {
  const providers = getSwapProvidersList(network);
  let allPairs = providers.flatMap((provider) => provider.getSupportedPairs());

  // Filter pairs to only include those where source network matches current network
  allPairs = allPairs.filter((pair) => pair.from === network);

  // Filter pairs to only include those matching the requested platform
  allPairs = allPairs.filter((pair) => pair.platform === swapPlatform || pair.platform === SwapPlatform.ALL);

  // Deduplicate pairs by converting to string for comparison
  const uniquePairs = allPairs.filter((pair, index) => {
    const pairString = `${pair.from}-${pair.to}`;
    return allPairs.findIndex((p) => `${p.from}-${p.to}` === pairString) === index;
  });

  return uniquePairs;
}

export function getSwapTargetName(target: SwapOptions): string {
  switch (target) {
    case SO_LIQUID_USDT:
      return 'USDT on Liquid';
    default:
      return capitalizeFirstLetter(target);
  }
}
