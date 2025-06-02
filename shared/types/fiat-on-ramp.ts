import { Networks } from './networks';

export interface CoinBuySupport {
  canBuyWithFiat: boolean;
  // partner: FiatOnRampPartner;
}

export type BuySupportMap = Record<Networks, CoinBuySupport>;
