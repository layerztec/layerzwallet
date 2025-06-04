import { Networks } from './networks';

export interface NetworkBuySupport {
  canBuyWithFiat: boolean;
}

export type BuySupportMap = Record<Networks, NetworkBuySupport>;
