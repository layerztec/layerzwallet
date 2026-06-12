import { LayerzStorage } from './layerz-storage';

/**
 * Same as LayerzStorage on desktop (and ext). A separate secure store is only meaningful on mobile.
 */
export const SecureStorage = LayerzStorage;
