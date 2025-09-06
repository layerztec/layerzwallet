import { NETWORK_BITCOIN, Networks } from './types/networks';

export const DEFAULT_NETWORK: Networks = NETWORK_BITCOIN;

// Lightning payment configuration
export const LIGHTNING_MAX_FEE_PERCENT = 5; // Maximum fee percentage for Lightning payments
export const LIGHTNING_MIN_FEE_SATS = 2; // Minimum fee in satoshis for Lightning payments
