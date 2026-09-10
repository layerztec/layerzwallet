import { ArkadeSwaps, BoltzSwapProvider, PendingSwap, decodeInvoice } from '@arkade-os/boltz-swap';
import { ArkAddress, ArkTransaction, ExtendedCoin, ExtendedVirtualCoin, Ramps, SingleKey, TxType, VtxoManager, Wallet, type WalletBalance } from '@arkade-os/sdk';
import { ExpoArkProvider, ExpoIndexerProvider } from '@arkade-os/sdk/adapters/expo';
import ecc from '@bitcoinerlab/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { parseStoredTransactionList, parseStoredUtxoList, parseStoredVtxoList, stringifyTransactionList, stringifyUtxoList, stringifyVtxoList } from './ark-wallet-storage';
import assert from 'assert';
import BIP32Factory from 'bip32';
import * as bip39 from 'bip39';

import { IStorage } from '@shared/types/IStorage';
import { CommonSwap } from '@shared/types/common-swap';
import * as BlueElectrum from '../../blue_modules/BlueElectrum';
import { sleep } from '../../modules/sleep';
import { CommonTokenTransfer, CommonTransaction } from '../../types/common-transaction';
import { NETWORK_ARK, NETWORK_ARK_MUTINYNET } from '../../types/networks';
import { CachedTokenInfo } from '../../types/token-info';
import { AbstractHDElectrumWallet } from './abstract-hd-electrum-wallet';
import { createLightningInvoiceResponse, InterfaceLightningWallet, LightningPaymentLimitsResponse } from './interface-lightning-wallet';
import { InterfaceAccountBasedWallet } from './interface-account-based-wallet';
import { InterfaceCanHaveTokens } from './interface-can-have-tokens';

const bip32 = BIP32Factory(ecc);

const ARK_STORAGE_PREFIX = 'ark-sdk-v2';

type StoredContract = {
  label?: string;
  type: string;
  params: Record<string, string>;
  script: string;
  address: string;
  state: 'active' | 'inactive';
  createdAt: number;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
};

type ContractFilter = {
  script?: string | string[];
  state?: StoredContract['state'] | StoredContract['state'][];
  type?: string | string[];
};

type WalletState = {
  lastSyncTime?: number;
  settings?: Record<string, any>;
};

type PendingSwapFilter = {
  id?: string | string[];
  status?: PendingSwap['status'] | PendingSwap['status'][];
  type?: PendingSwap['type'] | PendingSwap['type'][];
  orderBy?: 'createdAt';
  orderDirection?: 'asc' | 'desc';
};

/**
 * Merge persisted and freshly fetched SDK records without creating duplicates.
 *
 * the SDK writes data over time as wallet state changes. We need one place that
 * says "keep the latest value for each logical record" so our simple storage
 * does not accumulate duplicate VTXOs, UTXOs or transactions forever.
 */
const mergeByKey = <T>(existing: T[], incoming: T[], toKey: (value: T) => string): T[] => {
  const next = new Map<string, T>();

  existing.forEach((value) => next.set(toKey(value), value));
  incoming.forEach((value) => next.set(toKey(value), value));

  return [...next.values()];
};

/**
 * Small helper that scopes app storage to one Ark wallet instance.
 *
 * the same app can hold multiple Ark accounts and even different Ark servers.
 * This wrapper prevents their persisted SDK state from overwriting each other.
 */
class NamespacedStorage {
  private readonly namespace: string;

  constructor(
    private readonly storage: IStorage,
    serverUrl: string,
    accountNumber: number
  ) {
    const networkId = bytesToHex(sha256(serverUrl)).slice(0, 16);
    this.namespace = `${ARK_STORAGE_PREFIX}:${networkId}:account_${accountNumber}`;
  }

  private key(suffix: string) {
    return `${this.namespace}:${suffix}`;
  }

  async readJson<T>(suffix: string, fallback: T): Promise<T> {
    const raw = await this.storage.getItem(this.key(suffix));
    if (!raw) return fallback;

    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed === null) return fallback;
      return parsed as T;
    } catch (error) {
      console.error('ARK storage: failed to read', this.key(suffix), error);
      return fallback;
    }
  }

  async writeJson(suffix: string, value: unknown): Promise<void> {
    await this.storage.setItem(this.key(suffix), JSON.stringify(value));
  }

  async clearCoinCacheForAddresses(addresses: string[]): Promise<void> {
    await Promise.all(addresses.flatMap((address) => [this.storage.setItem(this.key(`wallet:vtxos:${address}`), '[]'), this.storage.setItem(this.key(`wallet:utxos:${address}`), '[]')]));
  }

  async readVtxos(address: string): Promise<ExtendedVirtualCoin[]> {
    const raw = await this.storage.getItem(this.key(`wallet:vtxos:${address}`));
    if (!raw) return [];
    try {
      return parseStoredVtxoList(raw);
    } catch (error) {
      console.error('ARK storage: failed to parse vtxos for', address, error);
      return [];
    }
  }

  async writeVtxos(address: string, vtxos: ExtendedVirtualCoin[]): Promise<void> {
    await this.storage.setItem(this.key(`wallet:vtxos:${address}`), stringifyVtxoList(vtxos));
  }

  async readUtxos(address: string): Promise<ExtendedCoin[]> {
    const raw = await this.storage.getItem(this.key(`wallet:utxos:${address}`));
    if (!raw) return [];
    try {
      return parseStoredUtxoList(raw);
    } catch (error) {
      console.error('ARK storage: failed to parse utxos for', address, error);
      return [];
    }
  }

  async writeUtxos(address: string, utxos: ExtendedCoin[]): Promise<void> {
    await this.storage.setItem(this.key(`wallet:utxos:${address}`), stringifyUtxoList(utxos));
  }

  async readTransactions(address: string): Promise<ArkTransaction[]> {
    const raw = await this.storage.getItem(this.key(`wallet:txs:${address}`));
    if (!raw) return [];
    try {
      return parseStoredTransactionList(raw);
    } catch (error) {
      console.error('ARK storage: failed to parse transactions for', address, error);
      return [];
    }
  }

  async writeTransactions(address: string, txs: ArkTransaction[]): Promise<void> {
    await this.storage.setItem(this.key(`wallet:txs:${address}`), stringifyTransactionList(txs));
  }
}

/**
 * Minimal wallet repository implementation expected by the Ark SDK.
 *
 * the SDK wants repository objects, while this app stores data in a simpler
 * key-value backend. This class bridges that mismatch just enough for the SDK
 * to persist new wallet state going forward.
 */
class LayerzWalletRepository {
  readonly version = 1 as const;

  constructor(private readonly storage: NamespacedStorage) {}

  /**
   * Clear all cached SDK wallet state for this Ark wallet only.
   *
   * a reset should wipe just this account/server combination, not unrelated
   * wallets stored elsewhere in the app.
   */
  async clear(): Promise<void> {
    const addresses = await this.getTrackedAddresses();
    await Promise.all(addresses.flatMap((address) => [this.storage.writeVtxos(address, []), this.storage.writeUtxos(address, []), this.storage.writeTransactions(address, [])]));
    await this.storage.writeJson('wallet:addresses', []);
    await this.storage.writeJson('wallet:state', null);
  }

  async getVtxos(address: string): Promise<ExtendedVirtualCoin[]> {
    return this.storage.readVtxos(address);
  }

  async saveVtxos(address: string, vtxos: ExtendedVirtualCoin[]): Promise<void> {
    const existing = await this.getVtxos(address);
    await this.trackAddress(address);
    await this.storage.writeVtxos(
      address,
      mergeByKey(existing, vtxos, (item) => `${item.txid}:${item.vout}`)
    );
  }

  async deleteVtxos(address: string): Promise<void> {
    await this.storage.writeVtxos(address, []);
  }

  async getUtxos(address: string): Promise<ExtendedCoin[]> {
    return this.storage.readUtxos(address);
  }

  async saveUtxos(address: string, utxos: ExtendedCoin[]): Promise<void> {
    const existing = await this.getUtxos(address);
    await this.trackAddress(address);
    await this.storage.writeUtxos(
      address,
      mergeByKey(existing, utxos, (item) => `${item.txid}:${item.vout}`)
    );
  }

  async deleteUtxos(address: string): Promise<void> {
    await this.storage.writeUtxos(address, []);
  }

  async getTransactionHistory(address: string): Promise<ArkTransaction[]> {
    return this.storage.readTransactions(address);
  }

  /**
   * Merge new transaction snapshots into persisted history for one address.
   *
   * the same Ark transaction may be seen many times as its status evolves.
   * We want an upsert behavior, not duplicate entries in local history.
   */
  async saveTransactions(address: string, txs: ArkTransaction[]): Promise<void> {
    const existing = await this.getTransactionHistory(address);
    await this.trackAddress(address);
    await this.storage.writeTransactions(
      address,
      mergeByKey(existing, txs, (tx) => `${tx.key.boardingTxid}:${tx.key.commitmentTxid}:${tx.key.arkTxid}`)
    );
  }

  async deleteTransactions(address: string): Promise<void> {
    await this.storage.writeTransactions(address, []);
  }

  async getWalletState(): Promise<WalletState | null> {
    return this.storage.readJson<WalletState | null>('wallet:state', null);
  }

  async saveWalletState(state: WalletState): Promise<void> {
    await this.storage.writeJson('wallet:state', state);
  }

  async [Symbol.asyncDispose](): Promise<void> {
    // no-op
  }

  private async getTrackedAddresses(): Promise<string[]> {
    return this.storage.readJson<string[]>('wallet:addresses', []);
  }

  private async trackAddress(address: string): Promise<void> {
    const addresses = await this.getTrackedAddresses();
    if (addresses.includes(address)) return;
    await this.storage.writeJson('wallet:addresses', [...addresses, address]);
  }
}

/**
 * Minimal swap repository for Ark <-> Lightning swap state.
 *
 * the Boltz swap library needs persistence for in-flight swaps.
 */
class LayerzSwapRepository {
  readonly version = 1 as const;

  constructor(private readonly storage: NamespacedStorage) {}

  /**
   * Save or update a swap in the bucket that matches its type.
   *
   * swap records change status over time, so later writes should replace the
   * earlier version with the same id instead of appending duplicates.
   */
  async saveSwap<T extends PendingSwap>(swap: T): Promise<void> {
    const swaps = await this.readSwaps<T>(swap.type);
    const index = swaps.findIndex((existingSwap) => existingSwap.id === swap.id);

    if (index === -1) {
      swaps.push(swap);
    } else {
      swaps[index] = swap;
    }

    await this.writeSwaps(swap.type, swaps);
  }

  /**
   * Delete a swap by id without requiring the caller to know its type first.
   *
   * many call sites only know the id and should not need extra bookkeeping for
   * whether the swap was reverse, submarine or chain.
   */
  async deleteSwap(id: string): Promise<void> {
    for (const type of this.allSwapTypes()) {
      const swaps = await this.readSwaps(type);
      await this.writeSwaps(
        type,
        swaps.filter((swap) => swap.id !== id)
      );
    }
  }

  /**
   * Recreate the small subset of query behavior the swap SDK expects.
   *
   * we replaced a heavier repository implementation with key-value storage, so
   * this method preserves only the filtering/sorting behavior the wallet uses.
   */
  async getAllSwaps<T extends PendingSwap>(filter?: PendingSwapFilter): Promise<T[]> {
    let swaps: PendingSwap[] = [...(await this.readSwaps('reverse')), ...(await this.readSwaps('submarine')), ...(await this.readSwaps('chain'))];

    if (filter?.id) {
      const ids = Array.isArray(filter.id) ? filter.id : [filter.id];
      swaps = swaps.filter((swap) => ids.includes(swap.id));
    }

    if (filter?.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      swaps = swaps.filter((swap) => statuses.includes(swap.status));
    }

    if (filter?.type) {
      const types = Array.isArray(filter.type) ? filter.type : [filter.type];
      swaps = swaps.filter((swap) => types.includes(swap.type));
    }

    if (filter?.orderBy === 'createdAt') {
      swaps.sort((a, b) => a.createdAt - b.createdAt);
      if (filter.orderDirection !== 'asc') swaps.reverse();
    }

    return swaps as T[];
  }

  async clear(): Promise<void> {
    for (const type of this.allSwapTypes()) {
      await this.writeSwaps(type, []);
    }
  }

  async [Symbol.asyncDispose](): Promise<void> {
    // no-op
  }

  /**
   * Read one swap bucket and discard anything that does not look like a swap.
   *
   * bad persisted data should not crash swap recovery or invoice checks.
   */
  private async readSwaps<T extends PendingSwap>(type: PendingSwap['type']): Promise<T[]> {
    const parsed = await this.storage.readJson<PendingSwap[]>(`swaps:${type}`, []);
    return parsed.filter((swap): swap is T => !!swap && typeof swap === 'object' && 'id' in swap && 'type' in swap);
  }

  private async writeSwaps(type: PendingSwap['type'], swaps: PendingSwap[]): Promise<void> {
    await this.storage.writeJson(`swaps:${type}`, swaps);
  }

  private allSwapTypes(): PendingSwap['type'][] {
    return ['reverse', 'submarine', 'chain'];
  }
}

/**
 * Small contract repository used by the Ark SDK contract manager.
 *
 * Ark Lightning and contract watching rely on persisted contracts, but this
 * project does not use the SDK's heavier storage backends here.
 */
class LayerzContractRepository {
  readonly version = 1 as const;

  constructor(private readonly storage: NamespacedStorage) {}

  async clear(): Promise<void> {
    await this.writeContracts([]);
  }

  /**
   * Return saved contracts with optional filtering.
   *
   * the SDK contract manager loads all contracts at startup and also asks for
   * narrower subsets when updating or deleting specific entries.
   */
  async getContracts(filter?: ContractFilter): Promise<StoredContract[]> {
    const contracts = await this.readContracts();
    if (!filter) return contracts;

    return contracts.filter((contract) => {
      return this.matches(contract.script, filter.script) && this.matches(contract.state, filter.state) && this.matches(contract.type, filter.type);
    });
  }

  /**
   * Upsert a contract using its script as the stable identifier.
   *
   * scripts uniquely identify contracts in the SDK, so updates need to replace
   * by script rather than creating multiple copies of the same contract.
   */
  async saveContract(contract: StoredContract): Promise<void> {
    const contracts = await this.readContracts();
    const nextContracts = contracts.filter((existingContract) => existingContract.script !== contract.script);
    nextContracts.push(contract);
    await this.writeContracts(nextContracts);
  }

  async deleteContract(script: string): Promise<void> {
    const contracts = await this.readContracts();
    await this.writeContracts(contracts.filter((contract) => contract.script !== script));
  }

  async [Symbol.asyncDispose](): Promise<void> {
    // no-op
  }

  private matches<T>(value: T, criterion?: T | T[]): boolean {
    if (criterion === undefined) return true;
    return Array.isArray(criterion) ? criterion.includes(value) : value === criterion;
  }

  /**
   * Read all persisted contracts and keep only structurally valid entries.
   *
   * if cached storage contains junk, we prefer to skip it and let the wallet
   * rebuild useful state rather than fail during startup.
   */
  private async readContracts(): Promise<StoredContract[]> {
    const parsed = await this.storage.readJson<StoredContract[]>('contracts', []);
    return parsed.filter(
      (contract): contract is StoredContract =>
        !!contract &&
        typeof contract === 'object' &&
        typeof contract.script === 'string' &&
        typeof contract.address === 'string' &&
        typeof contract.type === 'string' &&
        typeof contract.createdAt === 'number'
    );
  }

  private async writeContracts(contracts: StoredContract[]): Promise<void> {
    await this.storage.writeJson('contracts', contracts);
  }
}

export class ArkWallet extends AbstractHDElectrumWallet implements InterfaceLightningWallet, InterfaceAccountBasedWallet, InterfaceCanHaveTokens {
  private _wallet: Wallet | undefined = undefined;
  private _arkadeLightning: ArkadeSwaps | undefined = undefined;
  private _arkServerUrl: string = 'https://mutinynet.arkade.sh';
  private _boltzApiUrl: string = '';
  protected _accountNumber: number = 0;
  private _manager: VtxoManager | undefined = undefined;
  private _arkStorage: IStorage | undefined = undefined;
  private _arkTokenBalances: CachedTokenInfo[] = [];
  _lastTokensFetch: number = 0;

  setAccountNumber(value: number) {
    this._accountNumber = value;
  }

  setArkServerUrl(url: string) {
    assert(!this._wallet, 'Wallet already initialized');
    this._arkServerUrl = url;
  }

  setBoltzApiUrl(url: string) {
    assert(!this._arkadeLightning, 'Already initialized');
    this._boltzApiUrl = url;
  }

  _getIdentity() {
    assert(this.secret, 'No secret provided');
    const mnemonic = this.secret;
    const passphrase = this.passphrase;
    const seed = bip39.mnemonicToSeedSync(mnemonic, passphrase);

    const index = 0;
    const internal = 0;
    const accountNumber = this._accountNumber;
    const root = bip32.fromSeed(seed);
    const path = `m/86'/0'/${accountNumber}'/${internal}/${index}`;
    const child = root.derivePath(path);
    assert(child.privateKey, 'Internal error: no private key for child');

    return SingleKey.fromPrivateKey(child.privateKey);
  }

  async init(layerzStorage: IStorage) {
    this._arkStorage = layerzStorage;
    this._arkadeLightning = undefined;

    const identity = this._getIdentity();
    const storage = new NamespacedStorage(layerzStorage, this._arkServerUrl, this._accountNumber);
    const walletRepository = new LayerzWalletRepository(storage);
    const contractRepository = new LayerzContractRepository(storage);

    const wallet = await Wallet.create({
      identity,
      storage: {
        walletRepository,
        contractRepository,
      },
      arkProvider: new ExpoArkProvider(this._arkServerUrl),
      indexerProvider: new ExpoIndexerProvider(this._arkServerUrl),
    });
    this._wallet = wallet;

    this._manager = await wallet.getVtxoManager();

    await this._runOneTimeVtxoRecovery(storage);
    await this._runDeprecatedSignerMigration();
  }

  /**
   * Discover VTXOs under rotated server signers and migrate them to the
   * current signer before the operator cutoff closes cooperative spending.
   */
  private async _runDeprecatedSignerMigration(): Promise<void> {
    assert(this._wallet, 'Ark wallet not initialized');
    assert(this._manager, 'VtxoManager not initialized');

    try {
      await this._wallet.restore();
      const managerWithMigration = this._manager as typeof this._manager & {
        migrateDeprecatedSignerVtxos?: () => Promise<{ rotated?: boolean; vtxos?: { txid?: string }; boarding?: { txid?: string } }>;
      };
      const migrateDeprecatedSignerVtxos = managerWithMigration.migrateDeprecatedSignerVtxos;
      if (typeof migrateDeprecatedSignerVtxos !== 'function') {
        return;
      }

      const report = await migrateDeprecatedSignerVtxos();
      if (report.rotated || report.vtxos?.txid || report.boarding?.txid) {
        console.log('ARK deprecated-signer migration:', report);
      }
    } catch (error) {
      globalThis.handleError?.(error, 'ark-wallet.ts');
      console.log('ARK deprecated-signer migration error:', error);
    }

    // Runs regardless of migration success: a failed/partial migration is exactly
    // when the wallet is most likely to still hold funds under a rotated signer.
    await this._resyncIfDeprecatedSignerContracts();
  }

  /** Drop the incremental sync cursor when this wallet still has active contracts under a deprecated server signer. */
  private async _resyncIfDeprecatedSignerContracts(): Promise<void> {
    assert(this._wallet, 'Ark wallet not initialized');

    try {
      const info = await this._wallet.arkProvider.getInfo();
      if (!info.deprecatedSigners?.length) return;

      const normalizeKey = (pubkey: string) => {
        const hex = pubkey.toLowerCase();
        return hex.length === 66 ? hex.slice(2) : hex;
      };

      const deprecatedKeys = new Set(info.deprecatedSigners.map((s) => normalizeKey(s.pubkey)));

      // Only active contracts can still hold spendable funds; inactive/completed
      // ones lingering in storage must not force a re-bootstrap on every init.
      const contracts = await (await this._wallet.getContractManager()).getContracts({ state: 'active' });
      const hasDeprecatedContract = contracts.some((c) => {
        const pk = c.params?.serverPubKey;
        return typeof pk === 'string' && deprecatedKeys.has(normalizeKey(pk));
      });

      if (hasDeprecatedContract) {
        await this._wallet.clearSyncCursor();
      }
    } catch (error) {
      globalThis.handleError?.(error, 'ark-wallet.ts');
      console.log('ARK deprecated-signer resync check error:', error);
    }
  }

  /**
   * One-time recovery for wallets whose local VTXO cache was corrupted by older
   * code. Clears the SDK sync cursor so the next balance/history fetch
   * re-bootstraps from the indexer and re-persists with the corrected codec.
   */
  private async _runOneTimeVtxoRecovery(storage: NamespacedStorage): Promise<void> {
    const RECOVERY_FLAG = 'recovery:vtxoStorageV1';

    try {
      if (await storage.readJson<boolean>(RECOVERY_FLAG, false)) return;

      const addresses = await storage.readJson<string[]>('wallet:addresses', []);
      if (addresses.length > 0) {
        await storage.clearCoinCacheForAddresses(addresses);
      }
      await this._wallet?.clearSyncCursor();
      await storage.writeJson(RECOVERY_FLAG, true);
    } catch (error) {
      globalThis.handleError?.(error, 'ark-wallet.ts');
    }
  }

  async initLightningSwaps() {
    assert(this._wallet, 'Ark wallet must be initialized first');
    assert(this._arkStorage, 'Ark wallet storage is not initialized');
    assert(this._boltzApiUrl, 'Boltz Api Url is not set');

    const swapProvider = new BoltzSwapProvider({
      apiUrl: this._boltzApiUrl,
      network: this._arkServerUrl.includes('mutiny') ? 'mutinynet' : 'bitcoin',
    });

    this._arkadeLightning = await ArkadeSwaps.create({
      wallet: this._wallet,
      swapProvider,
      swapRepository: new LayerzSwapRepository(new NamespacedStorage(this._arkStorage, this._arkServerUrl, this._accountNumber)),
      swapManager: false,
    });
  }

  async getOffchainBalance() {
    assert(this._wallet, 'Ark wallet not initialized');
    assert(this._manager, 'this._manager is undefined');

    if (this._arkadeLightning) {
      await this._attemptToClaimPendingVHTLCs();
    }

    // renew VTXO:
    try {
      const expiringVtxos = await this._manager.getExpiringVtxos();
      if (expiringVtxos.length > 0) {
        console.log(`Renewing ${expiringVtxos.length} expiring VTXOs...`);
        const renewTxid = await this._manager.renewVtxos();
        console.log('Renewal transaction:', renewTxid);
      }
    } catch (error) {
      globalThis.handleError?.(error, 'ark-wallet.ts');
      console.log('ARK Error renewing VTXOs:', error);
    }

    const balance = await this._wallet.getBalance();
    await this._populateArkTokenCacheFromWalletBalance(balance);
    this._lastBalanceFetch = Date.now();
    return balance.available;
  }

  /** Force a full VTXO re-sync from the Ark indexer on the next balance fetch. */
  async resyncFromIndexer() {
    assert(this._wallet, 'Ark wallet not initialized');
    await this._wallet.clearSyncCursor();
    // the next balance fetch performs the full re-bootstrap and re-caches everything
    return this.getOffchainBalance();
  }

  private async _populateArkTokenCacheFromWalletBalance(balance: WalletBalance): Promise<void> {
    assert(this._wallet, 'Ark wallet not initialized');
    const assets = balance.assets ?? [];
    const cached: CachedTokenInfo[] = [];

    for (const { assetId, amount } of assets) {
      if (amount <= 0) continue;

      let name = `${assetId.slice(0, 16)}…`;
      let symbol = '';
      let decimals = 0;
      let logoURI: string | undefined;

      try {
        const details = await this._wallet.assetManager.getAssetDetails(assetId);
        const m = details?.metadata;
        if (m) {
          if (typeof m.name === 'string' && m.name.length > 0) name = m.name;
          if (typeof m.ticker === 'string' && m.ticker.length > 0) symbol = m.ticker;
          if (typeof m.decimals === 'number') decimals = m.decimals;
          if (typeof m.icon === 'string' && m.icon.length > 0) logoURI = m.icon;
        }
      } catch (error) {
        globalThis.handleError?.(error, 'ark-wallet.ts');
      }

      if (!symbol) symbol = 'ASSET';

      cached.push({
        id: assetId,
        chainId: 0,
        name,
        decimals,
        symbol,
        logoURI,
        balance: String(amount),
      });
    }

    this._arkTokenBalances = cached;
    this._lastTokensFetch = Date.now();
  }

  async fetchTokenBalances(): Promise<void> {
    if (this._lastBalanceFetch > 0 && Date.now() - this._lastBalanceFetch > 5_000) {
      // tokens are fetched in `getOffchainBalance`, but since it was called a long time ago lets call it again
      // so we wont have stale data
      await this.getOffchainBalance();
    }
  }

  getTokenBalances(): CachedTokenInfo[] {
    if (!this._wallet) throw new Error('Ark wallet not initialized');
    return this._arkTokenBalances;
  }

  async transferToken(tokenId: string, amount: bigint, address: string, _memo?: string): Promise<string> {
    assert(this._wallet, 'Ark wallet not initialized');
    if (amount < 0n) throw new Error('Invalid amount');

    return await this._wallet.send({
      address,
      assets: [{ assetId: tokenId, amount }],
    });
  }

  async _attemptToClaimPendingVHTLCs() {
    assert(this._wallet, 'Ark wallet not initialized');
    assert(this._arkadeLightning, 'Ark Lightning not initialized');

    const arkadeLightning = this._arkadeLightning;
    const pendingReverseSwaps = await arkadeLightning.getPendingReverseSwaps();
    if ((pendingReverseSwaps ?? []).length > 0) console.log('got', pendingReverseSwaps?.length ?? [], 'pending swaps');

    await Promise.allSettled(
      (pendingReverseSwaps ?? []).map(async (swap) => {
        console.log(`claiming ${swap.id}...`);
        try {
          await arkadeLightning.claimVHTLC(swap);
          console.log(`${swap.id} claimed!`);
        } catch (error: any) {
          globalThis.handleError?.(error, 'ark-wallet.ts');
          console.log(`could not claim ${swap.id}:`, error?.message ?? error);
        }
      })
    );
  }

  async pay(address: string, amount: number): Promise<string> {
    if (!this._wallet) throw new Error('Ark wallet not initialized');

    console.log(`paying ${amount} sat...`);
    return await this._wallet.send({
      address,
      amount,
    });
  }

  async getOffchainReceiveAddress(): Promise<string> {
    if (!this._wallet) throw new Error('Ark wallet not initialized');

    const address = await this._wallet.getAddress();
    return address;
  }

  async getCommonTransactions(): Promise<CommonTransaction[]> {
    if (!this._wallet) throw new Error('Ark wallet not initialized');

    const transactions = await this._wallet.getTransactionHistory();

    const commonTransactions: CommonTransaction[] = [];

    for (const transaction of transactions) {
      if (!transaction.key.arkTxid) continue; // here we only show ark transactions

      const rawCreatedAt = transaction.createdAt ?? 0; // 0 when tx is still pending
      const isPending = rawCreatedAt === 0;
      const createdAt = isPending ? new Date().getTime() : rawCreatedAt;
      const timestamp = Math.floor(createdAt / 1000);

      const tokenTransfers: CommonTokenTransfer[] = [];

      for (const a of transaction.assets || []) {
        const aDetails = await this._wallet.assetManager.getAssetDetails(a.assetId);
        tokenTransfers.push({
          tokenId: a.assetId,
          amount: Number(a.amount),
          decimals: aDetails.metadata?.decimals || 0,
          name: aDetails.metadata?.name,
          symbol: aDetails.metadata?.ticker,
          logoURI: aDetails.metadata?.icon,
        });
      }

      commonTransactions.push({
        network: this._arkServerUrl.includes('mutiny') ? NETWORK_ARK_MUTINYNET : NETWORK_ARK, // hacky
        txid: transaction.key.arkTxid,
        timestamp,
        direction: transaction.type === TxType.TxSent ? 'send' : 'receive',
        amount: transaction.amount,
        tokenTransfers,
        status: isPending ? 'pending' : 'confirmed',
        confirmations: isPending ? 0 : 1,
      });
    }

    return commonTransactions;
  }

  async createLightningInvoice(amountSats: number, memo: string): Promise<createLightningInvoiceResponse> {
    assert(this._arkadeLightning, 'Ark Lightning not initialized');
    assert(amountSats > 333, 'Only invoices > 333 sat allowed');

    const result = await this._arkadeLightning.createLightningInvoice({
      amount: amountSats,
      description: memo,
    });

    console.log('Expiry (seconds):', result.expiry);
    console.log('Lightning Invoice:', result.invoice);
    console.log('Payment Hash:', result.paymentHash);
    console.log('Pending swap', result.pendingSwap);
    console.log('Preimage', result.preimage);

    return {
      invoice: result.invoice,
      serviceFeeSat: 1, // FIXME: hardcoded till Ark sdk provides actual number
    };
  }

  fetchLightningLimits(): Promise<LightningPaymentLimitsResponse> {
    // fixme
    return Promise.resolve({
      receive: {
        minSat: 333,
        maxSat: 100000000,
        maxZeroConfSat: 0,
      },
      send: {
        minSat: 333,
        maxSat: 100000000,
        maxZeroConfSat: 0,
      },
    });
  }

  async isInvoicePaid(invoice: string): Promise<boolean> {
    const { paymentHash } = decodeInvoice(invoice);
    if (!paymentHash) throw new Error('Payment hash not found in invoice');
    return this.isInvoicePaidByHash(paymentHash);
  }

  async isInvoicePaidByHash(preimageHash: string): Promise<boolean> {
    assert(this._arkadeLightning, 'Ark Lightning not initialized');
    if (!preimageHash) throw new Error('No preimage hash provided');

    await this._attemptToClaimPendingVHTLCs();

    const target = preimageHash.toLowerCase();
    for (const swap of (await this._arkadeLightning.getSwapHistory()) ?? []) {
      if (swap.status !== 'invoice.settled' || swap.type !== 'reverse') continue;
      try {
        const { paymentHash } = decodeInvoice(swap.response.invoice);
        if (paymentHash?.toLowerCase() === target) return true;
      } catch {
        // ignore malformed persisted invoices, dont let one bad record break the lookup
      }
    }
    return false;
  }

  async payLightningInvoice(invoice: string): Promise<boolean> {
    assert(this._arkadeLightning, 'Ark Lightning not initialized');
    const invoiceDetails = decodeInvoice(invoice);

    console.log('Invoice amount:', invoiceDetails.amountSats, 'sats');
    console.log('Description:', invoiceDetails.description);
    console.log('Payment Hash:', invoiceDetails.paymentHash);

    const paymentResult = await this._arkadeLightning.sendLightningPayment({ invoice });

    console.log('Payment successful!');
    console.log('Amount:', paymentResult.amount);
    console.log('Preimage:', paymentResult.preimage);
    console.log('Transaction ID:', paymentResult.txid);
    return true;
  }

  allowLightning() {
    return !!this._arkadeLightning;
  }

  async getOnchainDepositAddress(): Promise<string> {
    if (!this._wallet) throw new Error('Ark wallet not initialized');

    return await this._wallet.getBoardingAddress();
  }

  async getCommonSwaps(): Promise<CommonSwap[]> {
    if (!this._wallet) throw new Error('Ark wallet not initialized');
    if (!BlueElectrum.mainConnected) await BlueElectrum.connectMain();

    const swaps: CommonSwap[] = [];
    const network = this._arkServerUrl.includes('mutinynet') ? NETWORK_ARK_MUTINYNET : NETWORK_ARK;
    const transactions = await this._wallet.getTransactionHistory();

    // unclaimed swaps
    const unclaimedTxs = transactions.filter((tx) => tx.key.boardingTxid && !tx.settled);
    const txs1 = await BlueElectrum.multiGetTransactionByTxid([...unclaimedTxs.map((tx) => tx.key.boardingTxid)], true);
    const unclaimedSwaps: CommonSwap[] = unclaimedTxs.map((tx) => {
      const txDetails = txs1[tx.key.boardingTxid];
      const timestamp = tx.createdAt || new Date().getTime();
      const confirmations = txDetails.confirmations ?? 0;
      const claimable = confirmations >= 1; // can be claimed once it's unconfirmed
      return {
        network,
        id: tx.key.boardingTxid,
        status: claimable ? 'claimable' : 'pending',
        amount: tx.amount,
        timestamp,
        direction: 'receive',
        // we only want to show confirmations for 'pending' swaps
        confirmations: !claimable ? confirmations : undefined,
        targetConfirmations: !claimable ? 1 : undefined,
      };
    });
    swaps.push(...unclaimedSwaps);

    // claimed swaps
    const claimedTxs = transactions.filter((tx) => tx.key.boardingTxid && tx.settled);
    const claimedSwaps: CommonSwap[] = claimedTxs.map((tx) => {
      const timestamp = tx.createdAt || new Date().getTime();
      return {
        network,
        id: tx.key.boardingTxid,
        status: 'confirmed',
        timestamp,
        amount: tx.amount,
        direction: 'receive',
      };
    });
    swaps.push(...claimedSwaps);

    return swaps;
  }

  async getSettledBoardingAmount(boardingTxid: string): Promise<{ txid: string; creditAmountSats: number } | null> {
    if (!this._wallet) return null;
    const txs = await this._wallet.getTransactionHistory();
    const tx = txs.find((t) => t.key.boardingTxid === boardingTxid && t.settled);
    if (!tx) return null;
    return { txid: tx.key.arkTxid || tx.key.commitmentTxid, creditAmountSats: tx.amount };
  }

  async claimDepositArk(txid: string): Promise<{ txid: string; creditAmountSats?: number }> {
    if (!this._wallet) throw new Error('Ark wallet not initialized');

    const boardingUtxos = (await this._wallet.getBoardingUtxos()).filter((utxo) => utxo.txid === txid);
    const { fees } = await this._wallet.arkProvider.getInfo();

    const resultTxid = await new Ramps(this._wallet).onboard(fees, boardingUtxos);

    // Look up the post-fee credited amount from the resulting VTXO
    // Retry with delay — indexer may not have processed the new VTXO immediately
    let creditAmountSats: number | undefined;
    try {
      for (let i = 0; i < 5; i++) {
        await sleep(2000);
        const txs = await this._wallet.getTransactionHistory();
        const resultTx = txs.find((tx) => tx.key.arkTxid === resultTxid || tx.key.commitmentTxid === resultTxid);
        if (resultTx) {
          creditAmountSats = resultTx.amount;
          break;
        }
      }
    } catch (e) {
      // Non-critical — dedup will still work via receiveTransferId
      /* ignore */
    }

    return { txid: resultTxid, creditAmountSats };
  }

  /**
   * Static method to validate ARK addresses
   * Uses ArkAddress.decode from @arkade-os/sdk to validate the address format
   * @param address The address to validate
   * @returns true if the address is valid, false otherwise
   */
  static isAddressValid(address: string): boolean {
    try {
      ArkAddress.decode(address);
      return true;
    } catch (error) {
      return false;
    }
  }

  isAddressValid(address: string): boolean {
    return ArkWallet.isAddressValid(address);
  }
}
