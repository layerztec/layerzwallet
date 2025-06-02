import { NETWORK_BITCOIN } from '../types/networks';
import { BuySupportMap } from '../types/fiat-on-ramp';

export const fiatOnRamp: Partial<BuySupportMap> = {
  [NETWORK_BITCOIN]: {
    canBuyWithFiat: true,
  },
};
