import assert from 'assert';
import { DoSwapResponse, SwapPair, SwapPlatform, SwapProvider, SwapOptions, SO_LIQUID_USDT, SO_STACKS_STX } from '../types/swap';
import { NETWORK_BITCOIN, NETWORK_LIQUID, NETWORK_ROOTSTOCK, Networks } from '../types/networks';

/**
 * @see https://docs.sideshift.ai/
 * @see https://sideshift.ai/embed
 */
export class SwapProviderSideshift implements SwapProvider {
  name = 'SideShift';

  getSupportedPairs(): SwapPair[] {
    return [
      // btc <-> rsk
      { from: NETWORK_BITCOIN, to: NETWORK_ROOTSTOCK, platform: SwapPlatform.ALL },
      { from: NETWORK_ROOTSTOCK, to: NETWORK_BITCOIN, platform: SwapPlatform.ALL },
      // btc <-> liquid
      { from: NETWORK_BITCOIN, to: NETWORK_LIQUID, platform: SwapPlatform.ALL },
      { from: NETWORK_LIQUID, to: NETWORK_BITCOIN, platform: SwapPlatform.ALL },
      // btc <-> USDT on liquid
      { from: NETWORK_BITCOIN, to: SO_LIQUID_USDT, platform: SwapPlatform.ALL },
      { from: SO_LIQUID_USDT, to: NETWORK_BITCOIN, platform: SwapPlatform.ALL },
      // btc --> STX on stacks
      { from: NETWORK_BITCOIN, to: SO_STACKS_STX, platform: SwapPlatform.ALL },
      // rsk <-> liquid
      { from: NETWORK_ROOTSTOCK, to: NETWORK_LIQUID, platform: SwapPlatform.ALL },
      { from: NETWORK_LIQUID, to: NETWORK_ROOTSTOCK, platform: SwapPlatform.ALL },
      // liquid <-> USDT on liquid
      { from: NETWORK_LIQUID, to: SO_LIQUID_USDT, platform: SwapPlatform.ALL },
      { from: SO_LIQUID_USDT, to: NETWORK_LIQUID, platform: SwapPlatform.ALL },
      // rsk <-> USDT on liquid
      { from: NETWORK_ROOTSTOCK, to: SO_LIQUID_USDT, platform: SwapPlatform.ALL },
      { from: SO_LIQUID_USDT, to: NETWORK_ROOTSTOCK, platform: SwapPlatform.ALL },
    ];
  }

  swap(from: SwapOptions, setNetwork: (network: Networks) => void, to: SwapOptions, amountIn: number, userWalletAddress: string): Promise<DoSwapResponse> {
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
      case SO_LIQUID_USDT:
        defaultDepositMethodId = 'usdtla';
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
      case SO_LIQUID_USDT:
        defaultSettleMethodId = 'usdtla';
        break;
      case SO_STACKS_STX:
        defaultSettleMethodId = 'stx';
        break;
      default:
        throw new Error(`Swap to ${to} not supported by ${this.name}`);
    }

    const uri = `https://layerztec.github.io/website/swap/?defaultDepositMethodId=${defaultDepositMethodId}&defaultSettleMethodId=${defaultSettleMethodId}&settleAddress=${userWalletAddress}`;

    return Promise.resolve({
      uri,
      action: 'EXTERNAL_BROWSER', // SIDESHIFT does not require smart contract interaction, so we can open in default browser
    });
  }
}
