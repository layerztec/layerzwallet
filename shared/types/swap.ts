import { NETWORK_LIQUID, NETWORK_ROOTSTOCK, NETWORK_USDT, Networks } from './networks';

export enum SwapPlatform {
  MOBILE,
  EXT,
  ALL,
}

export const SO_LIQUID_USDT = `${NETWORK_USDT}_${NETWORK_LIQUID}` as const;
export const SO_ROOTSTOCK_USDT = `${NETWORK_USDT}_${NETWORK_ROOTSTOCK}` as const;

type NetworksWithTokens = typeof SO_LIQUID_USDT | typeof SO_ROOTSTOCK_USDT;

export type SwapOptions = Networks | NetworksWithTokens;

export interface SwapPair {
  from: SwapOptions;
  to: SwapOptions;
  platform: SwapPlatform;
}

interface URIResponse {
  uri: string;
  action: 'DAPP_BROWSER' | 'EXTERNAL_BROWSER';
}

interface InternalScreenResponse {
  screen: string;
  params: Record<string, string>;
  action: 'INTERNAL_SCREEN';
}

export type DoSwapResponse = URIResponse | InternalScreenResponse;

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
  swap(from: SwapOptions, setNetwork: (network: Networks) => void, to: SwapOptions, amountIn: number, userWalletAddress: string): Promise<DoSwapResponse>;
}
