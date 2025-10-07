import assert from 'assert';

import { NETWORK_ARK, NETWORK_BITCOIN, NETWORK_SPARK, Networks } from '../types/networks';
import { DoSwapResponse, SwapPair, SwapPlatform, SwapProvider } from '../types/swap';

export class SwapProviderXArk implements SwapProvider {
  name = 'XArk';

  getSupportedPairs(): SwapPair[] {
    return [
      { from: NETWORK_BITCOIN, to: NETWORK_SPARK, platform: SwapPlatform.EXT },
      { from: NETWORK_BITCOIN, to: NETWORK_SPARK, platform: SwapPlatform.MOBILE },
      { from: NETWORK_BITCOIN, to: NETWORK_ARK, platform: SwapPlatform.EXT },
      { from: NETWORK_BITCOIN, to: NETWORK_ARK, platform: SwapPlatform.MOBILE },
    ];
  }

  swap(from: Networks, setNetwork: (network: Networks) => void, to: Networks, amountIn: number, userWalletAddress: string): Promise<DoSwapResponse> {
    const supportedPairs = this.getSupportedPairs();
    const isSupported = supportedPairs.some((pair) => pair.from === from && pair.to === to);
    assert(isSupported, `Swap pair ${from}->${to} not supported by ${this.name}`);

    return Promise.resolve({
      action: 'INTERNAL_SCREEN',
      screen: 'SwapXArkDeposit',
      params: {
        to,
        amountIn: amountIn.toString(),
      },
    });
  }
}
