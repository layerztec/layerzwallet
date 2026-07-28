import { vi } from 'vitest';
import type { ExtendedVirtualCoin } from '@arkade-os/sdk';

/**
 * Shared Ark test fixtures. Single source of truth for the SDK surfaces and
 * shapes our tests fake, so an SDK change breaks every dependent test at once.
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

export const minimalTapLeaf = (): ExtendedVirtualCoin['forfeitTapLeafScript'] => {
  const internalKey = new Uint8Array(32).fill(9);
  const cb = { version: 192, internalKey, merklePath: [] as Uint8Array[] };
  const script = new Uint8Array([0x51, 0x20, ...internalKey]);
  return [cb, script];
};

export const minimalVtxo = (overrides: Partial<ExtendedVirtualCoin> = {}): ExtendedVirtualCoin =>
  ({
    txid: 'a'.repeat(64),
    vout: 0,
    value: 2100,
    createdAt: new Date(1756199879000),
    tapTree: new Uint8Array([1, 2, 3, 255]),
    forfeitTapLeafScript: minimalTapLeaf(),
    intentTapLeafScript: minimalTapLeaf(),
    script: '5120' + '00'.repeat(32),
    status: { confirmed: true, block_time: 1756199879 },
    virtualStatus: { state: 'preconfirmed', commitmentTxIds: [] },
    isSpent: false,
    isUnrolled: false,
    isRecoverable: false,
    isSwept: false,
    isPreconfirmed: true,
    isPending: false,
    isLeaf: false,
    settledBy: undefined,
    arkTxId: undefined,
    assets: [{ assetId: 'token-1', amount: 12345678901234567890n }],
    ...overrides,
  }) as ExtendedVirtualCoin;
