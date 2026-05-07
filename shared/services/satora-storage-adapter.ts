import type { GetSwapResponse } from '@lendasat/lendaswap-sdk-pure';
import type { StoredSwap, SwapStorage, WalletStorage } from '@lendasat/lendaswap-sdk-pure';

import { IStorage, STORAGE_KEY_SATORA_SWAPS, STORAGE_KEY_SATORA_WALLET } from '../types/IStorage';

interface PersistedWallet {
  keyIndex: number;
}

const EMPTY_WALLET: PersistedWallet = { keyIndex: 0 };

/**
 * Backs the Satora SDK's WalletStorage with our IStorage.
 *
 * We hand the SDK an xprv derived from the wallet's master seed (see
 * `transfer-service-satora.ts`), so the mnemonic methods on this interface
 * are never called by the SDK. Only the per-swap key index counter is persisted.
 */
export class SatoraWalletStorageAdapter implements WalletStorage {
  constructor(private readonly storage: IStorage) {}

  private async load(): Promise<PersistedWallet> {
    const raw = await this.storage.getItem(STORAGE_KEY_SATORA_WALLET);
    if (!raw) return { ...EMPTY_WALLET };
    try {
      const parsed = JSON.parse(raw) as Partial<PersistedWallet>;
      return { keyIndex: typeof parsed.keyIndex === 'number' ? parsed.keyIndex : 0 };
    } catch {
      return { ...EMPTY_WALLET };
    }
  }

  private async save(value: PersistedWallet): Promise<void> {
    await this.storage.setItem(STORAGE_KEY_SATORA_WALLET, JSON.stringify(value));
  }

  // The SDK's xprv path never reads/writes a mnemonic — see Client.builder().build().
  // These remain only to satisfy the WalletStorage interface;
  async getMnemonic(): Promise<string | null> {
    throw new Error('SatoraWalletStorageAdapter: mnemonic methods not used in xprv mode');
  }
  async setMnemonic(_mnemonic: string): Promise<void> {
    throw new Error('SatoraWalletStorageAdapter: mnemonic methods not used in xprv mode');
  }

  async getKeyIndex(): Promise<number> {
    return (await this.load()).keyIndex;
  }

  async setKeyIndex(index: number): Promise<void> {
    await this.save({ keyIndex: index });
  }

  async incrementKeyIndex(): Promise<number> {
    const current = await this.load();
    const used = current.keyIndex;
    await this.save({ keyIndex: used + 1 });
    return used;
  }

  async clear(): Promise<void> {
    await this.save({ ...EMPTY_WALLET });
  }
}

/** Backs the Satora SDK's SwapStorage with a JSON blob in IStorage. */
export class SatoraSwapStorageAdapter implements SwapStorage {
  constructor(private readonly storage: IStorage) {}

  private async loadAll(): Promise<Record<string, StoredSwap>> {
    const raw = await this.storage.getItem(STORAGE_KEY_SATORA_SWAPS);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, StoredSwap>) : {};
    } catch {
      return {};
    }
  }

  private async saveAll(map: Record<string, StoredSwap>): Promise<void> {
    await this.storage.setItem(STORAGE_KEY_SATORA_SWAPS, JSON.stringify(map));
  }

  async get(swapId: string): Promise<StoredSwap | null> {
    const all = await this.loadAll();
    return all[swapId] ?? null;
  }

  async store(swap: StoredSwap): Promise<void> {
    const all = await this.loadAll();
    all[swap.swapId] = swap;
    await this.saveAll(all);
  }

  async update(swapId: string, response: GetSwapResponse): Promise<void> {
    const all = await this.loadAll();
    const existing = all[swapId];
    if (!existing) {
      throw new Error(`Satora swap not found: ${swapId}`);
    }
    all[swapId] = { ...existing, response, updatedAt: Date.now() };
    await this.saveAll(all);
  }

  async delete(swapId: string): Promise<void> {
    const all = await this.loadAll();
    delete all[swapId];
    await this.saveAll(all);
  }

  async list(): Promise<string[]> {
    return Object.keys(await this.loadAll());
  }

  async getAll(): Promise<StoredSwap[]> {
    return Object.values(await this.loadAll());
  }

  async clear(): Promise<void> {
    await this.saveAll({});
  }
}
