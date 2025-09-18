import assert from 'assert';
import { DoSwapResponse, SwapPair, SwapPlatform, SwapProvider } from '../types/swap';
import { NETWORK_BITCOIN, NETWORK_BOTANIX, Networks } from '../types/networks';
import BigNumber from 'bignumber.js';
import { getDecimalsByNetwork } from '../models/network-getters';

/**
 * handles Botanix swaps.
 * we currently take no commission on them.
 */
export class SwapProviderGardenFinance implements SwapProvider {
  name = 'Garden Finance';

  getSupportedPairs(): SwapPair[] {
    return [
      // btc <-> botanix
      { from: NETWORK_BITCOIN, to: NETWORK_BOTANIX, platform: SwapPlatform.EXT },
      { from: NETWORK_BOTANIX, to: NETWORK_BITCOIN, platform: SwapPlatform.EXT },
      { from: NETWORK_BITCOIN, to: NETWORK_BOTANIX, platform: SwapPlatform.MOBILE },
      { from: NETWORK_BOTANIX, to: NETWORK_BITCOIN, platform: SwapPlatform.MOBILE },
    ];
  }

  async swap(from: Networks, setNetwork: (network: Networks) => void, to: Networks, amountIn: number, userWalletAddress: string): Promise<DoSwapResponse> {
    const supportedPairs = this.getSupportedPairs();
    const isSupported = supportedPairs.some((pair) => pair.from === from && pair.to === to);
    assert(isSupported, `Swap pair ${from}->${to} not supported by ${this.name}`);

    const openInDappBrowser = true;
    let sendAsset;
    switch (from) {
      case NETWORK_BITCOIN:
        sendAsset = 'bitcoin';
        break;
      case NETWORK_BOTANIX:
        sendAsset = 'botanix';
        break;
      default:
        throw new Error(`Swap from ${from} not supported by ${this.name}`);
    }

    let receiveAsset;
    switch (to) {
      case NETWORK_BITCOIN:
        receiveAsset = 'bitcoin';
        break;
      case NETWORK_BOTANIX:
        receiveAsset = 'botanix';
        break;
      default:
        throw new Error(`Swap to ${to} not supported by ${this.name}`);
    }

    // correction as dapp expects it (not sats)
    amountIn = new BigNumber(amountIn).dividedBy(new BigNumber(10).pow(getDecimalsByNetwork(from))).toNumber();

    let uri = `https://app.garden.finance/?input-chain=${sendAsset}&input-asset=BTC&output-chain=${receiveAsset}&output-asset=BTC&value=${amountIn}`;

    uri += `&ref=lzw`;

    console.log('uri', uri);

    return Promise.resolve({
      uri,
      action: openInDappBrowser ? 'DAPP_BROWSER' : 'EXTERNAL_BROWSER',
    });
  }
}
