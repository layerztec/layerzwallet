import assert from 'assert';
import { SwapPair, SwapPlatform, SwapProvider } from '../types/swap';
import { NETWORK_BITCOIN, NETWORK_LIQUID, NETWORK_ROOTSTOCK, Networks } from '@shared/types/networks';

/**
 * @see https://docs.sideshift.ai/
 * @see https://sideshift.ai/embed
 */
export class SwapProviderSideshift implements SwapProvider {
  name = 'SideShift';

  getSupportedPairs(): SwapPair[] {
    return [
      // btc <-> rsk
      { from: NETWORK_BITCOIN, to: NETWORK_ROOTSTOCK, platform: SwapPlatform.EXT },
      { from: NETWORK_ROOTSTOCK, to: NETWORK_BITCOIN, platform: SwapPlatform.EXT },
      { from: NETWORK_BITCOIN, to: NETWORK_ROOTSTOCK, platform: SwapPlatform.MOBILE },
      { from: NETWORK_ROOTSTOCK, to: NETWORK_BITCOIN, platform: SwapPlatform.MOBILE },
      // btc <-> liquid
      { from: NETWORK_BITCOIN, to: NETWORK_LIQUID, platform: SwapPlatform.EXT },
      { from: NETWORK_LIQUID, to: NETWORK_BITCOIN, platform: SwapPlatform.EXT },
      { from: NETWORK_BITCOIN, to: NETWORK_LIQUID, platform: SwapPlatform.MOBILE },
      { from: NETWORK_LIQUID, to: NETWORK_BITCOIN, platform: SwapPlatform.MOBILE },
      // rsk <-> liquid
      { from: NETWORK_ROOTSTOCK, to: NETWORK_LIQUID, platform: SwapPlatform.EXT },
      { from: NETWORK_LIQUID, to: NETWORK_ROOTSTOCK, platform: SwapPlatform.EXT },
      { from: NETWORK_ROOTSTOCK, to: NETWORK_LIQUID, platform: SwapPlatform.MOBILE },
      { from: NETWORK_LIQUID, to: NETWORK_ROOTSTOCK, platform: SwapPlatform.MOBILE },
    ];
  }

  swap(from: Networks, setNetwork: (network: Networks) => void, to: Networks, amountIn: number, userWalletAddress: string): Promise<string> {
    const supportedPairs = this.getSupportedPairs();
    const isSupported = supportedPairs.some((pair) => pair.from === from && pair.to === to);
    assert(isSupported, `Swap pair ${from}->${to} not supported by ${this.name}`);

    let defaultDepositMethodId = '';
    switch (from) {
      case NETWORK_BITCOIN:
        defaultDepositMethodId = 'btc';
        break;
      case NETWORK_LIQUID:
        defaultDepositMethodId = 'liquid';
        break;
      case NETWORK_ROOTSTOCK:
        defaultDepositMethodId = 'rbtc';
        break;
      default:
        throw new Error(`Swap from ${from} not supported by ${this.name}`);
    }

    let defaultSettleMethodId = '';
    switch (to) {
      case NETWORK_BITCOIN:
        defaultSettleMethodId = 'btc';
        break;
      case NETWORK_LIQUID:
        defaultSettleMethodId = 'liquid';
        break;
      case NETWORK_ROOTSTOCK:
        defaultSettleMethodId = 'rbtc';
        break;
      default:
        throw new Error(`Swap to ${to} not supported by ${this.name}`);
    }

    return Promise.resolve(
      `https://layerztec.github.io/website/swap/?defaultDepositMethodId=${defaultDepositMethodId}&defaultSettleMethodId=${defaultSettleMethodId}&settleAddress=${userWalletAddress}`
    );
  }
}
