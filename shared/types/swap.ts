import { Networks } from './networks';

export enum SwapPlatform {
  MOBILE,
  EXT,
}

export interface SwapPair {
  from: Networks;
  to: Networks;
  platform: SwapPlatform;
}

/**
 * Interface to configure each swap provider
 */
export interface SwapProvider {
  name: string;

  /**
   * @returns the list of supported swap pairs (fromCoin -> toCoin)
   */
  getSupportedPairs(): SwapPair[];

  /**
   * Performs a swap from one coin to another for a specified amount (in smallest units)
   *
   * @returns string url to redirect to the swap partner's website (either in webview or in new tab)
   */
  swap(from: Networks, setNetwork: (network: Networks) => void, to: Networks, amountIn: number, userWalletAddress: string): Promise<string>;
}
