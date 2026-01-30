import assert from 'assert';
import { DoSwapResponse, SwapPair, SwapPlatform, SwapProvider } from '../types/swap';
import { NETWORK_BITCOIN, NETWORK_CITREA, Networks } from '../types/networks';
import BigNumber from 'bignumber.js';
import { getDecimalsByNetwork } from '../models/network-getters';

/**
 * handles Citrea swaps.
 * we currently take no commission on them.
 */
export class SwapProviderSymbiosis implements SwapProvider {
  name = 'Symbiosis';

  getSupportedPairs(): SwapPair[] {
    return [
      // btc <-> citrea
      { from: NETWORK_BITCOIN, to: NETWORK_CITREA, platform: SwapPlatform.ALL },
      { from: NETWORK_CITREA, to: NETWORK_BITCOIN, platform: SwapPlatform.ALL },
    ];
  }

  async swap(from: Networks, setNetwork: (network: Networks) => void, to: Networks, amountIn: number, userWalletAddress: string): Promise<DoSwapResponse> {
    const supportedPairs = this.getSupportedPairs();
    const isSupported = supportedPairs.some((pair) => pair.from === from && pair.to === to);
    assert(isSupported, `Swap pair ${from}->${to} not supported by ${this.name}`);

    const openInDappBrowser = true;
    let sendAsset;
    let tokenIn;
    let tokenOut;
    switch (from) {
      case NETWORK_BITCOIN:
        sendAsset = 'Bitcoin';
        tokenIn = 'BTC';
        break;
      case NETWORK_CITREA:
        sendAsset = 'Citrea';
        tokenIn = 'CBTC';
        break;
      default:
        throw new Error(`Swap from ${from} not supported by ${this.name}`);
    }

    let receiveAsset;
    switch (to) {
      case NETWORK_BITCOIN:
        receiveAsset = 'Bitcoin';
        tokenOut = 'BTC';
        break;
      case NETWORK_CITREA:
        receiveAsset = 'Citrea';
        tokenOut = 'CBTC';
        break;
      default:
        throw new Error(`Swap to ${to} not supported by ${this.name}`);
    }

    setNetwork(NETWORK_CITREA); // DAPP expects that we are already on this chain, otherwise it will break. so we switch in advance
    await new Promise((resolve) => setTimeout(resolve, 100)); // sleep to propagate

    // correction as dapp expects it (not sats)
    amountIn = new BigNumber(amountIn).dividedBy(new BigNumber(10).pow(getDecimalsByNetwork(from))).toNumber();

    // let uri = `https://app.garden.finance/?input-chain=${sendAsset}&input-asset=BTC&output-chain=${receiveAsset}&output-asset=BTC&value=${amountIn}`;
    let uri = `https://app.symbiosis.finance/swap?amountIn=${amountIn}&chainIn=${sendAsset}&chainOut=${receiveAsset}&tokenIn=${tokenIn}&tokenOut=${tokenOut}`;

    uri += `&ref=lzw`;

    console.log('uri', uri);

    return Promise.resolve({
      uri,
      action: openInDappBrowser ? 'DAPP_BROWSER' : 'EXTERNAL_BROWSER',
    });
  }
}
