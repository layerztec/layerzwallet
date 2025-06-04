import assert from 'assert';
import { SwapPair, SwapProvider } from '../types/swap';
import { Networks } from '@shared/types/networks';

export class SwapProviderOnramper implements SwapProvider {
  name = 'Onramper';

  getSupportedPairs(): SwapPair[] {
    // return [{ from: NETWORK_BITCOIN, to: NETWORK_ROOTSTOCK }];
    return [];
  }

  swap(from: Networks, setNetwork: (network: Networks) => void, to: Networks, amountIn: number, userWalletAddress: string): Promise<string> {
    const supportedPairs = this.getSupportedPairs();
    const isSupported = supportedPairs.some((pair) => pair.from === from && pair.to === to);
    assert(isSupported, `Swap pair ${from}->${to} not supported by ${this.name}`);

    return Promise.resolve('https://buy.onramper.com?apiKey=pk_prod_01JQ4HD3QF9BANEHNQMDT4F8ZT&supportSwap=true&mode=swap&swap_defaultSource=btc&swap_defaultTarget=rsk'); // TODO
  }
}
