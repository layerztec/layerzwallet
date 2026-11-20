import { beforeEach, describe, expect, it, vi } from 'vitest';

import { lazyInitWallet, setMasterSeed } from '../../modules/wallet-utils';
import { IStorage } from '../../types/IStorage';
import { NETWORK_RGB_TESTNET } from '../../types/networks';
import type { IRgbAdapter, IRgbWallet } from '../../types/rgb-adapter';

/**
 * The RLN node derives its keys from the whole mnemonic — rgb-sdk-rn has no
 * account parameter anywhere, so every accountNumber reaches the same node and
 * funds. lazyInitWallet therefore pins RGB to account 0 (same policy as
 * Liquid): one cache/lock entry, one backup-ledger storage key, no split-brain
 * between the account the UI shows and the account the ledger writes.
 */

function makeMemoryStorage(): IStorage & { _data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    _data: data,
    getItem: async (k: string) => data[k] ?? '',
    setItem: async (k: string, v: string) => {
      data[k] = v;
    },
  } as IStorage & { _data: Record<string, string> };
}

function installAdapter(): void {
  const sdkWallet = {
    vssBackupInfo: vi.fn().mockResolvedValue({ backupExists: false, backupRequired: false, serverVersion: null }),
    listAssets: vi.fn().mockResolvedValue({ nia: [], uda: [], cfa: [], ifa: [] }),
    listUnspents: vi.fn().mockResolvedValue([]),
  } as unknown as IRgbWallet;
  const adapter: Partial<IRgbAdapter> = {
    capabilities: { lightning: false },
    createWallet: vi.fn().mockResolvedValue(sdkWallet),
    restoreFromVss: vi.fn().mockResolvedValue(sdkWallet),
  };
  (globalThis as any).rgbAdapter = adapter;
}

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('lazyInitWallet RGB account pinning', () => {
  beforeEach(() => {
    installAdapter();
    setMasterSeed(MNEMONIC);
  });

  it('returns the same wallet instance for every accountNumber', async () => {
    const storage = makeMemoryStorage();
    const w0 = await lazyInitWallet(NETWORK_RGB_TESTNET, 0, storage, storage);
    const w1 = await lazyInitWallet(NETWORK_RGB_TESTNET, 1, storage, storage);
    const w7 = await lazyInitWallet(NETWORK_RGB_TESTNET, 7, storage, storage);
    expect(w1).toBe(w0);
    expect(w7).toBe(w0);
  });

  it('persists the backup ledger under the account-0 key only', async () => {
    const storage = makeMemoryStorage();
    await lazyInitWallet(NETWORK_RGB_TESTNET, 3, storage, storage);
    const keys = Object.keys(storage._data);
    // Whatever RGB state got persisted during init must be keyed to account 0;
    // nothing may be written under the caller's account 3.
    expect(keys.some((k) => k.includes('3'))).toBe(false);
  });
});
