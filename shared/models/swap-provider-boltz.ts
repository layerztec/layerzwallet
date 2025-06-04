import assert from 'assert';
import { SwapPair, SwapProvider } from '../types/swap';
import { NETWORK_BITCOIN, NETWORK_ROOTSTOCK, Networks } from '@shared/types/networks';
import BigNumber from 'bignumber.js';

/**
 * @see https://docs.boltz.exchange/web-app/urlparams
 */
export class SwapProviderBoltz implements SwapProvider {
  name = 'Boltz';

  getSupportedPairs(): SwapPair[] {
    return [
      { from: NETWORK_BITCOIN, to: NETWORK_ROOTSTOCK },
      { from: NETWORK_ROOTSTOCK, to: NETWORK_BITCOIN },
    ];
  }

  async swap(from: Networks, setNetwork: (network: Networks) => void, to: Networks, amountIn: number, userWalletAddress: string): Promise<string> {
    const supportedPairs = this.getSupportedPairs();
    const isSupported = supportedPairs.some((pair) => pair.from === from && pair.to === to);
    assert(isSupported, `Swap pair ${from}->${to} not supported by ${this.name}`);

    let sendAsset;
    switch (from) {
      case NETWORK_BITCOIN:
        sendAsset = 'BTC';
        break;
      case NETWORK_ROOTSTOCK:
        sendAsset = 'RBTC';
        // correction as boltz widget expects it
        amountIn = new BigNumber(amountIn).dividedBy(new BigNumber(10).pow(10)).toNumber();
        break;
      default:
        throw new Error(`Swap from ${from} not supported by ${this.name}`);
    }

    let receiveAsset;
    switch (to) {
      case NETWORK_BITCOIN:
        receiveAsset = 'BTC';
        break;
      case NETWORK_ROOTSTOCK:
        receiveAsset = 'RBTC';
        setNetwork(NETWORK_ROOTSTOCK); // switching network, otherwise boltz web app will ask it anyway and will lose data
        await new Promise((resolve) => setTimeout(resolve, 500)); // sleep to propagate
        break;
      default:
        throw new Error(`Swap to ${to} not supported by ${this.name}`);
    }

    let uri = `https://boltz.exchange/?embed=1&sendAsset=${sendAsset}&receiveAsset=${receiveAsset}&sendAmount=${amountIn}`;

    if (to !== NETWORK_ROOTSTOCK) {
      // widget breaks if you pass destination address for rsk, it probably wants only walletconnect
      uri += `&destination=${userWalletAddress}`;
    }
    uri += `&ref=lzw`;

    console.log('uri', uri);
    return Promise.resolve(uri);
  }
}
