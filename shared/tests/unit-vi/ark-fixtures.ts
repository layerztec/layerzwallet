import { vi } from 'vitest';

/**
 * Shared Ark test fixtures. Single source of truth for the SDK surfaces our
 * tests fake, so an SDK shape change breaks every dependent test at once.
 */

/** The minimal @arkade-os/sdk Wallet + VtxoManager surface that init()/_bootstrapWalletState touches. */
export const makeMockArkadeSdkWallet = () => {
  const manager = { getDeprecatedSignerStatus: vi.fn().mockResolvedValue([]) };
  const wallet = {
    restore: vi.fn().mockResolvedValue(undefined),
    clearSyncCursor: vi.fn().mockResolvedValue(undefined),
    getVtxoManager: vi.fn().mockResolvedValue(manager),
  };
  return { wallet, manager };
};
