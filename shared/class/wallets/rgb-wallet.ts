import assert from 'assert';

import { AllNetworkInfos } from '../../models/all-network-infos';
import { CommonTokenTransfer, CommonTransaction } from '../../types/common-transaction';
import { Networks, NETWORK_RGB, NETWORK_RGB_TESTNET } from '../../types/networks';
import { CachedTokenInfo } from '../../types/token-info';
import { IRgbAdapter, IRgbWallet, RgbLnReceiveResult, RgbLnSendResult, RgbLnSettlementOutcome, RgbNetwork } from '../../types/rgb-adapter';
import { getRgbBackupStateStorageKey, getRgbInitializedStorageKey, getRgbUseLspStorageKey, IStorage } from '../../types/IStorage';
import { AbstractWallet } from './abstract-wallet';
import { InterfaceAccountBasedWallet } from './interface-account-based-wallet';
import { InterfaceCanHaveTokens } from './interface-can-have-tokens';

type AnyAsset = {
  assetId: string;
  ticker?: string;
  name: string;
  precision: number;
  balance: { settled: number; future: number; spendable: number };
  media?: { filePath?: string; mime?: string } | null;
};

type SdkTransfer = Awaited<ReturnType<IRgbWallet['listTransfers']>>[number];
type AnnotatedTransfer = SdkTransfer & { assetId?: string };

export type RgbUnspent = Awaited<ReturnType<IRgbWallet['listUnspents']>>[number];

export interface DecodedInvoice {
  assetId?: string;
  amount?: number;
  expirationTimestamp: number | null;
  recipientId: string;
}

/**
 * Error classes for VSS backup edge cases. Callers (lazyInitWallet, the
 * restore-from-seed gate) match on `instanceof` to decide whether to retry,
 * surface a "server unreachable" UI, or refuse to proceed because a backup we
 * previously had has gone missing. See tasks/ship-rgb.md.
 */
export class RgbBackupServerUnreachableError extends Error {
  constructor(message = 'RGB backup server is unreachable') {
    super(message);
    this.name = 'RgbBackupServerUnreachableError';
  }
}

/**
 * Thrown when this device previously initialized RGB successfully (the
 * `STORAGE_KEY_RGB_INITIALIZED_<network>` flag is set) but VSS now reports the
 * backup as missing. Means either the user nuked their VSS account, or
 * something is very wrong on the server. Either way, we don't silently
 * recreate — that would overwrite a real backup with empty state.
 */
export class RgbBackupLostError extends Error {
  constructor(message = 'RGB backup unexpectedly missing on a wallet that was previously initialized') {
    super(message);
    this.name = 'RgbBackupLostError';
  }
}

export type RgbBackupErrorKind = 'network' | 'auth' | 'unknown';

/** Persisted shape (storage key from getRgbBackupStateStorageKey). */
export interface RgbBackupPersistedState {
  pendingMutations: number;
  lastBackupAt: number | null;
  lastBackupError: { kind: RgbBackupErrorKind; at: number; message: string } | null;
}

export class RgbWallet extends AbstractWallet implements InterfaceAccountBasedWallet, InterfaceCanHaveTokens {
  static readonly type = 'rgb';
  static readonly typeReadable = 'RGB';
  // @ts-ignore: override
  public readonly type = RgbWallet.type;
  // @ts-ignore: override
  public readonly typeReadable = RgbWallet.typeReadable;

  protected adapter: IRgbAdapter;
  private readonly _network: Networks;
  private readonly _sdkNetwork: RgbNetwork;
  private _accountNumber: number = 0;
  private _sdkWallet: IRgbWallet | undefined;
  private _tokens: CachedTokenInfo[] = [];
  private _receiveAddress: string | undefined;
  public _lastTokensFetch: number = 0;
  /** Dedupes concurrent `fetchTokenBalances` calls from different hooks. */
  private _tokensFetchInFlight: Promise<void> | undefined;
  /** Window for skipping a redundant chain sync (ms). */
  private static readonly SYNC_COOLDOWN_MS = 10_000;
  private _lastSync: number = 0;
  private _syncInFlight: Promise<void> | undefined;
  /** The most recent sync promise (in-flight or completed). Returned from the
   *  cooldown branch so a `sync()` short-circuit still chains correctly with
   *  callers that `await` it before reading state. */
  private _lastSyncPromise: Promise<void> = Promise.resolve();
  /** Auto-UTXO prep tunables. Top up colorable slots so the user doesn't have
   *  to wait through a chain confirmation the moment they hit Issue / Receive. */
  private static readonly UTXO_PREPARE_DELAY_MS = 1_000;
  private static readonly UTXO_PREPARE_MIN_FREE = 1; // (re)fill when free slots ≤ this
  private static readonly UTXO_PREPARE_TARGET = 5;
  private static readonly UTXO_PREPARE_SIZE_SATS = 1_000;
  private static readonly UTXO_PREPARE_FEE_GATE_SAT_VB = 3; // mainnet only
  private _preparingWallet = false;
  /** Timer id for the deferred `prepareWallet` kick-off. Cleared in
   *  `dispose()` so a logout / network switch within the prep delay can't
   *  fire SDK calls against an evicted instance. */
  private _prepareTimer: ReturnType<typeof setTimeout> | undefined;
  private _disposed = false;
  /**
   * Backup ledger. See tasks/ship-rgb.md.
   * `_pendingMutationsSinceBackup` is bumped before every `tryBackup` and
   * decremented on success; the persisted shape mirrors what the UI hook
   * surfaces. `_storage` is captured during `init()` so `tryBackup` can persist
   * without callers having to thread the IStorage through every mutation.
   */
  private _storage: IStorage | undefined;
  private _pendingMutationsSinceBackup: number = 0;
  private _lastBackupAt: number | null = null;
  private _lastBackupError: { kind: RgbBackupErrorKind; at: number; message: string } | null = null;

  constructor(network: Networks = NETWORK_RGB) {
    super();
    assert(network === NETWORK_RGB || network === NETWORK_RGB_TESTNET, `Unsupported RGB network: ${network}`);
    this._network = network;
    this._sdkNetwork = network === NETWORK_RGB_TESTNET ? 'testnet' : 'mainnet';
    assert(globalThis.rgbAdapter, 'RGB adapter not installed on globalThis.rgbAdapter');
    this.adapter = globalThis.rgbAdapter;
  }

  setAccountNumber(n: number): void {
    this._accountNumber = n;
  }

  getAccountNumber(): number {
    return this._accountNumber;
  }

  getNetwork(): Networks {
    return this._network;
  }

  /**
   * Bring the SDK wallet online.
   *
   * The decision tree below exists to defend against silently overwriting a
   * real VSS backup with empty local state — the worst possible failure mode
   * for this wallet. See tasks/ship-rgb.md for the full
   * model. Short version:
   *
   *   1. Try `restoreFromVss`. Happy path: backup exists, we restore, done.
   *   2. If it throws something `isVssBackupMissing` recognizes (404 / parse
   *      error / "not found"), we still don't trust that classification on
   *      its own — a confused server could report 404 for a transient
   *      database hiccup. We probe `vssBackupInfo` to confirm.
   *      • Probe says exists → original error was real, rethrow.
   *      • Probe throws → server is genuinely unreachable, throw
   *        `RgbBackupServerUnreachableError` so the unlock flow can show a
   *        "try again later / skip RGB" UI instead of creating a ghost wallet.
   *      • Probe says missing AND we previously initialized RGB on this
   *        device → backup vanished, throw `RgbBackupLostError`.
   *      • Probe says missing AND no prior init → genuine first-creation,
   *        fall through to `createWallet`.
   *   3. If `restoreFromVss` throws something we *don't* recognize, rethrow
   *      verbatim — same posture as before.
   *
   * The `STORAGE_KEY_RGB_INITIALIZED_<network>` flag is set after every
   * successful init; it's the device-local "I've been here before" signal
   * that turns "backup missing" from expected into a red flag.
   */
  async init(storage: IStorage): Promise<void> {
    assert(this.secret, 'Cant init RGB wallet: secret is not set.');
    this._storage = storage;
    await this.loadBackupState();

    // Read the per-network "use LSP" preference (see STORAGE_KEY_RGB_USE_LSP).
    // Missing / anything other than 'false' preserves the historical LSP-attached
    // behavior; 'false' disables LSP so `enableVirtualChannelsV0` stays off and
    // manually-opened channels can actually route HTLCs. Toggle lives in Tools.
    // Guard the call — some unit tests hand in `{} as any` for storage, and a
    // bare `.getItem(...)` there throws before `.catch` can see it.
    const useLspRaw = await (typeof storage?.getItem === 'function' ? storage.getItem(getRgbUseLspStorageKey(this._network)).catch(() => '') : Promise.resolve(''));
    const useLsp = useLspRaw !== 'false';
    const params = { mnemonic: this.secret, network: this._sdkNetwork, useLsp };
    try {
      this._sdkWallet = await this.adapter.restoreFromVss(params);
    } catch (e) {
      if (!isVssBackupMissing(e)) {
        globalThis.handleError?.(e, 'rgb-wallet.ts:init:vss');
        throw e;
      }
      // The "missing" classification is a hint, not a verdict — confirm with a
      // dedicated probe before doing anything destructive. The probe creates
      // the candidate wallet itself; on success we keep it instead of
      // creating a second one.
      this._sdkWallet = await this.acquireFreshWalletAfterProbe(e);
    }

    await this.markRgbInitialized();

    // Pre-warm colorable UTXOs in the background so Issue / blind-Receive
    // don't have to detour through a UTXO-creation tx the moment the user
    // taps them. Deferred so it never blocks first paint. Cancelled on
    // dispose so a logout / network switch within UTXO_PREPARE_DELAY_MS
    // can't run SDK calls against an evicted wallet.
    this._prepareTimer = setTimeout(() => {
      this._prepareTimer = undefined;
      if (this._disposed) return;
      this.prepareWallet().catch((e) => globalThis.handleError?.(e, 'rgb-wallet.ts:prepareWallet:scheduled'));
    }, RgbWallet.UTXO_PREPARE_DELAY_MS);
  }

  /**
   * Releases scheduled work tied to this instance. Idempotent. Called by
   * `clearWalletCache()` on logout / wipe so the deferred `prepareWallet`
   * timer can't fire against a wallet whose underlying storage is gone.
   */
  dispose(): void {
    this._disposed = true;
    if (this._prepareTimer !== undefined) {
      clearTimeout(this._prepareTimer);
      this._prepareTimer = undefined;
    }
  }

  /**
   * Probe-then-keep flow. Called only when `restoreFromVss` failed in a way
   * `isVssBackupMissing` recognized — we still don't trust that on its own,
   * so we create a candidate wallet locally and call `vssBackupInfo` on it.
   * The candidate is *local-only* until the first `vssBackup` call, so
   * disposing it on a probe-disagree is safe and non-destructive.
   *
   * Returns the kept wallet on success; throws `RgbBackupServerUnreachableError`,
   * `RgbBackupLostError`, or the original restore error otherwise. See
   * tasks/ship-rgb.md.
   */
  private async acquireFreshWalletAfterProbe(originalError: unknown): Promise<IRgbWallet> {
    const useLspRaw = await (typeof this._storage?.getItem === 'function' ? this._storage.getItem(getRgbUseLspStorageKey(this._network)).catch(() => '') : Promise.resolve(''));
    const useLsp = useLspRaw !== 'false';
    const candidate = await this.adapter.createWallet({ mnemonic: this.secret!, network: this._sdkNetwork, useLsp });

    let info: Awaited<ReturnType<IRgbWallet['vssBackupInfo']>>;
    try {
      info = await candidate.vssBackupInfo();
    } catch (probeErr) {
      // The web SDK throws on a 404 from `getObject` rather than returning
      // `{ backupExists: false }`, and additionally throws "VSS backup not
      // configured" when called on a candidate that hasn't yet been restored
      // (no pre-restore probe API exists on web). If the throw matches our
      // "missing" detector, treat it as a confirmed "no backup" answer — same
      // outcome as the success branch with `info.backupExists === false`.
      // Anything else is treated as unreachable — the alternative is silently
      // overwriting a real backup with empty state, which is unrecoverable.
      // Tracked upstream: https://github.com/UTEXO-Protocol/rgb-sdk-web/issues/6
      if (isVssBackupMissing(probeErr)) {
        info = { backupExists: false } as Awaited<ReturnType<IRgbWallet['vssBackupInfo']>>;
      } else {
        await disposeQuiet(candidate);
        globalThis.handleError?.(probeErr, 'rgb-wallet.ts:init:vssBackupInfoProbe');
        throw new RgbBackupServerUnreachableError();
      }
    }

    if (info.backupExists) {
      // Server says a backup is here, but `restoreFromVss` couldn't load it.
      // That's a real, non-"missing" failure — surface the original error.
      await disposeQuiet(candidate);
      throw originalError;
    }

    if (await this.hasInitializedBefore()) {
      // Probe confirmed no backup. If we've initialized RGB on this device
      // before, the backup vanished — refuse to silently recreate.
      await disposeQuiet(candidate);
      throw new RgbBackupLostError();
    }

    // Genuine first-creation on this device.
    return candidate;
  }

  private sdk(): IRgbWallet {
    assert(this._sdkWallet, 'RGB wallet not initialized');
    return this._sdkWallet;
  }

  /**
   * Pulls fresh chain state into the SDK's local store. The rgb-lib wallet
   * holds a sled DB that only reflects what has been explicitly synced — so
   * `getBtcBalance` / `listTransactions` / `listAssets` all return stale
   * (often zero) data until this runs. We call both the BDK UTXO sync
   * (`syncWallet`) and the RGB transfer-state refresh (`refreshWallet`);
   * transient indexer errors are logged but swallowed so a degraded network
   * still produces a readable (stale) balance instead of an empty screen.
   */
  private async sync(): Promise<void> {
    if (this._syncInFlight) return this._syncInFlight;
    if (Date.now() - this._lastSync < RgbWallet.SYNC_COOLDOWN_MS) return this._lastSyncPromise;
    const p = (async () => {
      try {
        await this.sdk().syncWallet();
      } catch (e) {
        globalThis.handleError?.(e, 'rgb-wallet.ts:syncWallet');
      }
      try {
        await this.sdk().refreshWallet();
      } catch (e) {
        globalThis.handleError?.(e, 'rgb-wallet.ts:refreshWallet');
      }
      this._lastSync = Date.now();
    })().finally(() => {
      if (this._syncInFlight === p) this._syncInFlight = undefined;
    });
    this._syncInFlight = p;
    this._lastSyncPromise = p;
    return p;
  }

  async getOffchainReceiveAddress(): Promise<string> {
    if (!this._receiveAddress) this._receiveAddress = await this.sdk().getAddress();
    return this._receiveAddress;
  }

  /**
   * Returns the spendable **vanilla** BTC balance. Colored sats (the 1000-sat
   * commitment outputs bound to each RGB allocation) are excluded: the user
   * can't actually spend them as BTC without destroying an asset allocation.
   *
   * Kicks off an opportunistic asset-list refresh but does not await it — a
   * transient indexer failure on the asset side must not fail the BTC balance.
   */
  async getOffchainBalance(): Promise<number> {
    await this.sync();
    const bal = await this.sdk().getBtcBalance();
    this._lastBalanceFetch = Date.now();
    this.fetchTokenBalances().catch((e) => globalThis.handleError?.(e, 'rgb-wallet.ts:fetchTokens'));
    return Number(bal.vanilla.spendable);
  }

  /**
   * Background top-up of colorable UTXO slots. Called once after `init()` via a
   * 1-second `setTimeout`, so first paint isn't blocked. Skips entirely when the
   * wallet has plenty of free slots, or — on mainnet — when fees are above
   * `UTXO_PREPARE_FEE_GATE_SAT_VB`. Testnet bypasses the fee gate entirely
   * because we have no reliable testnet electrum fee estimate (and it's free
   * sats anyway). Errors are logged but never thrown — this is best-effort.
   */
  async prepareWallet(): Promise<void> {
    if (this._preparingWallet) return;
    this._preparingWallet = true;
    try {
      if (this._sdkNetwork === 'mainnet') {
        try {
          // The SDK returns either a bare sat/vB number or `{ <blocks>: rate, … }`
          // depending on indexer; pick the requested target if it's an object.
          // Tracked upstream: https://github.com/UTEXO-Protocol/rgb-sdk-rn/issues/23
          const raw = await this.sdk().estimateFeeRate(6);
          const feeRate = typeof raw === 'number' ? raw : Number(raw[6] ?? Object.values(raw)[0] ?? NaN);
          if (!Number.isFinite(feeRate) || feeRate > RgbWallet.UTXO_PREPARE_FEE_GATE_SAT_VB) return;
        } catch (e) {
          // No fee estimate → don't risk an expensive top-up.
          globalThis.handleError?.(e, 'rgb-wallet.ts:prepareWallet:estimateFee');
          return;
        }
      }
      const unspents = await this.sdk().listUnspents();
      if (!unspents || unspents.length === 0) return;
      const free = unspents.filter((u) => u.utxo.colorable && !u.pendingBlinded && (u.rgbAllocations?.length ?? 0) === 0);
      if (free.length > RgbWallet.UTXO_PREPARE_MIN_FREE) return;
      await this.sdk().createUtxos({
        upTo: true,
        num: RgbWallet.UTXO_PREPARE_TARGET,
        size: RgbWallet.UTXO_PREPARE_SIZE_SATS,
        feeRate: await this.defaultFeeRate(),
      });
      await this.tryBackup();
    } catch (e) {
      globalThis.handleError?.(e, 'rgb-wallet.ts:prepareWallet');
    } finally {
      this._preparingWallet = false;
    }
  }

  /**
   * Allocates colorable UTXOs so the wallet can hold/issue RGB assets. Issuance
   * (`issueAssetNia`) and receive (`blindReceive`) both require at least one
   * unspent allocation slot; rgb-lib otherwise throws `InsufficientAllocationSlots`.
   * Defaults: one slot at the network's default fee rate, `upTo: true` so the
   * SDK skips creation when the target is already covered. `size` is forwarded
   * verbatim — `undefined` lets rgb-lib pick its built-in default.
   */
  async createUtxos(opts: { num?: number; size?: number; feeRate?: number; upTo?: boolean } = {}): Promise<number> {
    const num = await this.sdk().createUtxos({
      upTo: opts.upTo ?? true,
      num: opts.num ?? 1,
      size: opts.size,
      feeRate: opts.feeRate ?? (await this.defaultFeeRate()),
    });
    await this.tryBackup();
    return num;
  }

  /**
   * Returns the SDK's UTXO list verbatim. Syncs first so colorable status,
   * `pendingBlinded`, and `rgbAllocations` reflect chain truth. Used by the
   * UTXO-manager debug screen.
   */
  async listUnspents(): Promise<RgbUnspent[]> {
    await this.sync();
    return this.sdk().listUnspents();
  }

  /**
   * Fails all pending RGB transfers — frees up the colorable UTXOs they were
   * holding. Used by the UTXO-manager debug screen to recover from a stuck
   * `WaitingCounterparty` blind invoice that's locking an allocation slot.
   * Returns `true` if at least one transfer was failed.
   */
  async failTransfers(): Promise<boolean> {
    await this.sync();
    const result = await this.sdk().failTransfers({});
    await this.tryBackup();
    return result;
  }

  /**
   * Generates an RGB receive invoice. Defaults to a **blind** invoice (better
   * privacy: the sender doesn't learn which UTXO the asset lands on), and
   * transparently falls back to **witness** if the wallet has no free
   * colorable allocation slot. Caller learns which type was generated via the
   * returned `type` field so it can label the UI.
   *
   * `assetId` and `amount` are both optional — omit `assetId` for an
   * "any asset" invoice, omit `amount` to let the sender pay any amount.
   */
  async requestReceive(
    params: { assetId?: string; amount?: number; durationSeconds?: number; minConfirmations?: number } = {}
  ): Promise<{ invoice: string; type: 'blind' | 'witness'; recipientId: string; expirationTimestamp: number | null }> {
    try {
      const r = await this.sdk().blindReceive(params);
      return { invoice: r.invoice, type: 'blind', recipientId: r.recipientId, expirationTimestamp: r.expirationTimestamp };
    } catch (e) {
      // Only fall through for the specific "no slots" error — anything else is
      // a real failure (network, validation, etc.) and should propagate.
      if (!isInsufficientAllocationSlots(e)) throw e;
      const r = await this.sdk().witnessReceive(params);
      return { invoice: r.invoice, type: 'witness', recipientId: r.recipientId, expirationTimestamp: r.expirationTimestamp };
    }
  }

  /**
   * Issues a Non-Inflationary Asset (NIA) — fungible, single-issuance.
   * Caller is responsible for ensuring an allocation slot exists; if not, the
   * SDK throws `InsufficientAllocationSlots` and the caller should run
   * `createUtxos()` and retry.
   *
   * The return shape is intentionally narrow (just the fields the UI needs)
   * so we don't leak the SDK's `AssetNIA` type into shared/.
   */
  async issueAssetNia(params: { ticker: string; name: string; precision: number; amounts: number[] }): Promise<{ assetId: string; ticker: string; name: string; precision: number }> {
    const asset = await this.sdk().issueAssetNia(params);
    // Critical: a freshly-issued asset that isn't backed up is invisible after
    // a reinstall. See tasks/ship-rgb.md.
    await this.tryBackup({ critical: true });
    return { assetId: asset.assetId, ticker: asset.ticker, name: asset.name, precision: asset.precision };
  }

  /**
   * Asset-aware Lightning receive via the LSP composed flow. Returns both the
   * BOLT11 (sats payer route) and the RGB invoice (on-chain asset route) that
   * settle the same logical receive.
   *
   * Throws if the underlying SDK has no LN surface (extension uses
   * rgb-sdk-web, which is still on a pre-LSP build) or if the LSP base URL /
   * asset id constants haven't been populated for the active network yet
   * (see `mobile/src/constants/rgb-lsp.ts`).
   */
  async lightningReceiveAsset(params: { assetId: string; amountSats: number; amountRgb: number; expirySeconds?: number }): Promise<RgbLnReceiveResult> {
    const sdk = this.sdk();
    if (!sdk.lightningReceiveAsset) {
      throw new Error('Lightning receive is not supported by this build');
    }
    return sdk.lightningReceiveAsset(params);
  }

  /** P2P-friendly alternative: generate a BOLT11 via the wallet's own node
   *  instead of via `UtexoLsp.receiveAsset`. Route hints then point at the
   *  wallet's existing channel peer (e.g. the faucet bot), which is required
   *  when the payer has no channel to the LSP. */
  async createNativeLnInvoice(params: { amountSats: number; expirySeconds?: number; assetId?: string; assetAmount?: number }) {
    const sdk = this.sdk();
    if (!sdk.createNativeLnInvoice) throw new Error('createNativeLnInvoice is not supported by this build');
    return sdk.createNativeLnInvoice(params);
  }

  /** Raw ledger of every LN payment the RLN node has tracked (outgoing
   *  attempts + incoming HTLCs). Used by the Send screen to poll for a
   *  final status after an initially-Pending pay so the UI doesn't leave
   *  the user staring at "Payment pending" forever. */
  async listLnPayments() {
    const sdk = this.sdk();
    if (!sdk.listPaymentsRaw) throw new Error('listPaymentsRaw is not supported by this build');
    return sdk.listPaymentsRaw();
  }

  /**
   * Asset-aware Lightning send via the LSP. Caller passes the recipient's
   * `rgb:` invoice; LSP fronts a BOLT11, the local node pays it, and the LSP
   * forwards the RGB asset on settle.
   */
  async lightningSendAsset(params: { rgbInvoice: string; amountSats?: number }): Promise<RgbLnSendResult> {
    const sdk = this.sdk();
    if (!sdk.lightningSendAsset) {
      throw new Error('Lightning send is not supported by this build');
    }
    const r = await sdk.lightningSendAsset(params);
    // LN sends mutate channel/allocation state exactly like an on-chain
    // transfer — keep the backup ledger's "critical backup after every
    // user-initiated mutation" invariant (same as pay/transferToken).
    await this.tryBackup({ critical: true });
    return r;
  }

  /** Pay a BOLT11 directly from this wallet's LN node. Used for the
   *  asset-LN P2P path where we already hold a usable channel. */
  async payLightningInvoice(params: { lnInvoice: string; assetId?: string; assetAmount?: number; maxFee?: number; amountSats?: number }): Promise<RgbLnSendResult> {
    const sdk = this.sdk();
    if (!sdk.payLightningInvoice) {
      throw new Error('Lightning pay is not supported by this build');
    }
    const r = await sdk.payLightningInvoice(params);
    await this.tryBackup({ critical: true });
    return r;
  }

  /**
   * Polls the LSP until the receive settles or the wait deadline elapses.
   * Resolves with `'settled'` once payment + RGB transfer both confirm,
   * `'timed_out'` if the deadline passed without a terminal status. Throws
   * (via the SDK's LspSettlementError) on Failed / Expired.
   */
  async awaitLightningReceiveSettlement(params: { lnInvoice: string; timeoutMs?: number; signal?: AbortSignal }): Promise<RgbLnSettlementOutcome> {
    const sdk = this.sdk();
    if (!sdk.awaitLightningReceiveSettlement) {
      throw new Error('Lightning settlement polling is not supported by this build');
    }
    return sdk.awaitLightningReceiveSettlement(params);
  }

  /** Wait for the LSP's JIT channel carrying `assetId` to become usable.
   *  Debug/recovery: the LSP only pushes the channel while the wallet is
   *  connected and actively waiting. */
  async waitForLspChannel(params: { assetId: string; timeoutMs?: number }) {
    const sdk = this.sdk();
    if (!sdk.waitForLspChannel) throw new Error('waitForLspChannel is not supported by this build');
    return sdk.waitForLspChannel(params);
  }

  /** Decode a BOLT11 via the SDK — pulls the RGB asset tags (assetId,
   *  assetAmount) that pure-JS bolt11 libs miss. Used by Send RGB LN to
   *  preview what the invoice will actually route (plain sats vs asset). */
  async decodeLnInvoice(invoice: string) {
    const sdk = this.sdk();
    if (!sdk.decodeLnInvoice) throw new Error('decodeLnInvoice is not supported by this build');
    return sdk.decodeLnInvoice(invoice);
  }

  /** Direct LN channel management (debug/tools flow — not user-facing on normal
   *  send/receive paths). Used to open a channel with a specific peer (e.g. the
   *  RGB faucet bot's node) when the canonical LSP-JIT path doesn't fit. */
  async openLnChannel(request: Parameters<NonNullable<IRgbWallet['openChannel']>>[0]) {
    const sdk = this.sdk();
    if (!sdk.openChannel) throw new Error('openChannel is not supported by this build');
    // Verbose logging so a Metro tail can attribute an "no available utxos"
    // failure to the actual allocation state rather than guessing.
    try {
      const unspents = await sdk.listUnspents();
      // eslint-disable-next-line no-console
      console.log('[rgb][openLnChannel] request:', JSON.stringify(request));
      // eslint-disable-next-line no-console
      console.log('[rgb][openLnChannel] unspents count:', unspents.length);
      for (const u of unspents) {
        // eslint-disable-next-line no-console
        console.log('[rgb][openLnChannel] utxo:', JSON.stringify(u));
      }
    } catch (probeErr: any) {
      // eslint-disable-next-line no-console
      console.log('[rgb][openLnChannel] pre-probe failed:', probeErr?.message ?? String(probeErr));
    }
    try {
      const r = await sdk.openChannel(request);
      // eslint-disable-next-line no-console
      console.log('[rgb][openLnChannel] response:', JSON.stringify(r));
      return r;
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.log('[rgb][openLnChannel] FAIL:', e?.name, e?.message, JSON.stringify(e));
      throw e;
    }
  }

  async listLnChannels() {
    const sdk = this.sdk();
    if (!sdk.listChannels) throw new Error('listChannels is not supported by this build');
    return sdk.listChannels();
  }

  async closeLnChannel(channelId: string, peerPubkey: string, force: boolean) {
    const sdk = this.sdk();
    if (!sdk.closeChannel) throw new Error('closeChannel is not supported by this build');
    return sdk.closeChannel(channelId, peerPubkey, force);
  }

  async pay(receiverAddress: string, amountSats: number): Promise<string> {
    const txid = await this.sdk().sendBtc({
      address: receiverAddress,
      amount: amountSats,
      feeRate: await this.defaultFeeRate(),
    });
    // Critical: a sent-on-chain payment changed the wallet's UTXO set; a
    // recovery without this backup would think those UTXOs are still
    // spendable. See tasks/ship-rgb.md.
    await this.tryBackup({ critical: true });
    return txid;
  }

  /**
   * `invoice` must be a full `rgb:`/`utxob:` invoice. `tokenId` is the RGB asset id.
   * Amount is in the asset's base units; the `_memo` parameter is accepted to
   * satisfy InterfaceCanHaveTokens but is ignored — the RGB send API has no memo
   * field.
   *
   * `amount`: RGB invoices can carry an embedded amount. When they do, the
   * SDK's `sendBegin` returns an empty PSBT if we *also* pass `amount` —
   * downstream `signPsbt` then rejects with `psbtBase64 must be a non-empty
   * string`. So we decode the invoice first and only forward `amount` for
   * invoices that don't have one baked in.
   *
   * `assetId`: always forwarded. The web SDK extracts it from the invoice
   * data when omitted, but the RN binding's `sendBegin` throws
   * `ValidationError: asset_id is required for send operation` if the param
   * is missing — even when the invoice clearly has it. Forwarding the id
   * unconditionally is a no-op on web (the invoice's id wins) and required
   * on mobile. Tracking upstream:
   * https://github.com/UTEXO-Protocol/rgb-sdk-rn/issues/25
   */
  async transferToken(tokenId: string, amount: bigint, invoice: string, _memo?: string): Promise<string> {
    // The SDK's send API takes `amount: number`. High-precision assets (e.g.
    // precision 18 + a large holding) can exceed JS's safe-integer range; the
    // error surfaces here rather than producing a silently rounded send.
    assert(amount <= BigInt(Number.MAX_SAFE_INTEGER), `RGB send amount ${amount} exceeds Number.MAX_SAFE_INTEGER (2^53). ` + 'Reduce the amount or wait for SDK bigint support.');
    const decoded = await this.sdk().decodeRGBInvoice({ invoice });
    const invoiceHasAmount = typeof decoded.assignment?.amount === 'number';
    const params: Parameters<IRgbWallet['send']>[0] = {
      invoice,
      assetId: tokenId,
      feeRate: await this.defaultFeeRate(),
    };
    if (!invoiceHasAmount) params.amount = Number(amount);
    const result = await this.sdk().send(params);
    // Critical: an asset transfer changed colorable UTXO bindings; a recovery
    // without this backup would have the wrong allocation map and could even
    // double-spend the now-consumed slot. See
    // tasks/ship-rgb.md.
    await this.tryBackup({ critical: true });
    return result.txid;
  }

  /**
   * Returns invoice metadata (assetId, embedded amount, expiration, …) so the
   * UI can pre-fill / lock the amount field before reaching the send-confirm
   * step. Returns null on decode failure (caller can fall back to manual
   * entry).
   */
  async decodeInvoice(invoice: string): Promise<DecodedInvoice | null> {
    try {
      const d = await this.sdk().decodeRGBInvoice({ invoice });
      return {
        assetId: d.assetId,
        amount: typeof d.assignment?.amount === 'number' ? d.assignment.amount : undefined,
        expirationTimestamp: d.expirationTimestamp,
        recipientId: d.recipientId,
      };
    } catch (e) {
      globalThis.handleError?.(e, 'rgb-wallet.ts:decodeInvoice');
      return null;
    }
  }

  async fetchTokenBalances(): Promise<void> {
    // Dedupes concurrent callers (useBalance + useTransactions + useTokenDiscovery
    // can all fire at once on cold start) and returns the same in-flight promise.
    if (this._tokensFetchInFlight) return this._tokensFetchInFlight;
    this._tokensFetchInFlight = (async () => {
      try {
        await this.sync();
        const sdk = this.sdk();
        const list = await sdk.listAssets();
        const assets: AnyAsset[] = [...(list.nia ?? []), ...(list.cfa ?? []), ...(list.ifa ?? []), ...(list.uda ?? [])];

        // Opening a channel with `assetAmount` moves that many base units
        // OUT of on-chain UTXO allocations and INTO the channel commitment.
        // `listAssets` only sees on-chain balance, so a wallet with all its
        // asset locked in LN would show 0 in the Home token list — very
        // confusing ("where did my USDT go?"). Fold the local-side channel
        // amounts back in per asset id.
        const lnByAssetId = new Map<string, number>();
        if (sdk.listChannels) {
          try {
            const channels = await sdk.listChannels();
            for (const c of channels) {
              const aid = c.assetId ?? c.asset_id;
              if (!aid) continue;
              const local = Number(c.assetLocalAmount ?? c.asset_local_amount ?? 0);
              if (!Number.isFinite(local) || local <= 0) continue;
              lnByAssetId.set(aid, (lnByAssetId.get(aid) ?? 0) + local);
            }
          } catch (e: any) {
            // eslint-disable-next-line no-console
            console.log('[rgb][fetchTokenBalances] listChannels failed:', e?.message ?? e);
          }
        }

        this._tokens = assets.map((a) => {
          const lnLocal = lnByAssetId.get(a.assetId) ?? 0;
          const totalSpendable = a.balance.spendable + lnLocal;
          return {
            id: a.assetId,
            chainId: AllNetworkInfos[this._network].chainId,
            name: a.name,
            symbol: a.ticker ?? a.name,
            decimals: a.precision,
            balance: String(totalSpendable),
            logoURI: a.media?.filePath,
          };
        });
        this._lastTokensFetch = Date.now();
      } finally {
        this._tokensFetchInFlight = undefined;
      }
    })();
    return this._tokensFetchInFlight;
  }

  getTokenBalances(): CachedTokenInfo[] {
    return this._tokens;
  }

  async getCommonTransactions(): Promise<CommonTransaction[]> {
    const sdk = this.sdk();
    await this.sync();
    // Get on-chain tx metadata (fee, confirmation) and per-asset transfers.
    // `listTransfers()` without an assetId yields transfers with no asset id
    // attached, which is useless for UI attribution — we iterate the known
    // assets and annotate each transfer with its assetId at the source.
    const [txs, assetIds] = await Promise.all([sdk.listTransactions(), this.knownAssetIds()]);
    const perAssetTransfers = await Promise.all(assetIds.map(async (aid) => (await sdk.listTransfers(aid)).map((t) => ({ ...t, assetId: aid }) as AnnotatedTransfer)));
    const transfers: AnnotatedTransfer[] = perAssetTransfers.flat();

    const transfersByTxid = new Map<string, AnnotatedTransfer[]>();
    for (const t of transfers) {
      if (!t.txid) continue;
      const arr = transfersByTxid.get(t.txid) ?? [];
      arr.push(t);
      transfersByTxid.set(t.txid, arr);
    }

    const explorerBase = AllNetworkInfos[this._network].explorerUrl;
    const common: CommonTransaction[] = [];
    const seenTxids = new Set<string>();
    const seenTransferIds = new Set<string>();

    for (const tx of txs) {
      seenTxids.add(tx.txid);
      const netSats = tx.received - tx.sent;
      const related = transfersByTxid.get(tx.txid) ?? [];
      const tokenTransfers = this.annotatedTransfersToCommon(related);
      const hasTokens = tokenTransfers.length > 0;
      const direction: CommonTransaction['direction'] = hasTokens ? (related.some((r) => r.kind === 'Send') ? 'send' : 'receive') : netSats > 0 ? 'receive' : 'send';
      // For token transactions the on-chain BTC delta is just dust + fee —
      // not what the user moved. Leave `amount` undefined so the UI renders
      // the token amount as the primary figure (Transaction.tsx and
      // TransactionDetails.tsx both gate their "token-as-primary" branch on
      // `!transaction.amount`). `fee` is preserved separately for the
      // details sheet.
      const sendCounterparty = direction === 'send' ? related.find((r) => r.kind === 'Send')?.recipientId : undefined;
      common.push({
        network: this._network,
        txid: tx.txid,
        timestamp: tx.confirmationTime?.timestamp ?? Math.floor(Date.now() / 1000),
        direction,
        amount: hasTokens ? undefined : Math.abs(netSats),
        fee: tx.fee,
        status: tx.confirmationTime ? 'confirmed' : 'pending',
        blockHeight: tx.confirmationTime?.height,
        tokenTransfers: hasTokens ? tokenTransfers : undefined,
        counterparty: sendCounterparty,
        explorerUrl: explorerBase ? `${explorerBase}/tx/${tx.txid}` : undefined,
      });
    }

    // Pending / failed transfers without a mined txid (blind-receive awaiting
    // counterparty, etc.) — surface separately, keyed in a distinct namespace
    // so we can't collide with raw txids.
    for (const t of transfers) {
      if (t.txid && seenTxids.has(t.txid)) continue;
      const key = `transfer:${t.txid ?? t.invoiceString ?? `idx-${t.idx}`}`;
      if (seenTransferIds.has(key)) continue;
      seenTransferIds.add(key);
      const tokenTransfers = this.annotatedTransfersToCommon([t]);
      const direction: CommonTransaction['direction'] = t.kind === 'Send' ? 'send' : 'receive';
      // Transfer timestamps: the RN native binding hands back unix SECONDS
      // (10 digits) — matches `RlnPayment`. The core SDK types don't
      // specify the unit and older test fixtures used ms (13 digits), so
      // handle both: if the value looks like ms, scale down; otherwise
      // keep as-is. Getting this wrong on either branch used to render
      // the receive as "January 21, 1970" on the details sheet.
      // Drop the heuristic once the SDK settles the unit:
      // https://github.com/UTEXO-Protocol/rgb-sdk-rn/issues/48
      const rawTs = t.updatedAt || t.createdAt;
      const timestamp = rawTs > 1e12 ? Math.floor(rawTs / 1000) : rawTs;
      // eslint-disable-next-line no-console
      console.log(
        '[rgb][getCommonTransactions] transfer:',
        JSON.stringify({ idx: t.idx, kind: t.kind, status: t.status, createdAt: t.createdAt, updatedAt: t.updatedAt, resolvedTimestamp: timestamp })
      );
      common.push({
        network: this._network,
        txid: t.txid ?? key,
        timestamp,
        direction,
        status: transferStatusToCommon(t.status),
        tokenTransfers: tokenTransfers.length > 0 ? tokenTransfers : undefined,
        counterparty: direction === 'send' ? t.recipientId : undefined,
        explorerUrl: explorerBase && t.txid ? `${explorerBase}/tx/${t.txid}` : undefined,
      });
    }

    // LN payments (both outgoing and incoming HTLCs) live in a different
    // SDK ledger — `rlnListPayments` — and were previously invisible to the
    // UI. Fold them in as CommonTransactions keyed by `ln:<paymentHash>` so
    // they can't collide with real on-chain txids. Missing entirely on
    // builds where the SDK doesn't expose the method (extension web build).
    if (sdk.listPaymentsRaw) {
      try {
        const payments = await sdk.listPaymentsRaw();
        // eslint-disable-next-line no-console
        console.log('[rgb][getCommonTransactions] LN payments count:', payments.length);
        for (const p of payments) {
          // eslint-disable-next-line no-console
          console.log('[rgb][getCommonTransactions] LN payment:', JSON.stringify(p));
          const paymentType = (p.paymentType ?? '').toString().toLowerCase();
          const direction: CommonTransaction['direction'] = paymentType.includes('in') ? 'receive' : 'send';
          const amountSats = typeof p.amtMsat === 'number' ? Math.round(p.amtMsat / 1000) : undefined;
          // RlnPayment.updatedAt / createdAt are unix SECONDS. Was
          // undocumented; fixed in beta.26 by documenting the unit in the
          // SDK types (values unchanged), so this passthrough stays correct:
          // https://github.com/UTEXO-Protocol/rgb-sdk-rn/issues/48
          // If the payment moved an asset (colored channel routing), attach
          // it as a CommonTokenTransfer so the details sheet renders the
          // asset row alongside the sat amount — otherwise a "3000 sat"
          // send row hides the fact that 1 UTST also left the channel.
          const tokenTransfers: CommonTokenTransfer[] = [];
          if (p.assetId && typeof p.assetAmount === 'number' && p.assetAmount > 0) {
            const meta = this._tokens.find((t) => t.id === p.assetId);
            tokenTransfers.push({
              tokenId: p.assetId,
              amount: p.assetAmount,
              symbol: meta?.symbol,
              decimals: meta?.decimals ?? 0,
              name: meta?.name,
            });
          }
          common.push({
            network: this._network,
            txid: `ln:${p.paymentHash}`,
            timestamp: p.updatedAt || p.createdAt,
            direction,
            amount: amountSats,
            status: paymentStatusToCommon(p.status),
            counterparty: p.payeePubkey,
            tokenTransfers: tokenTransfers.length > 0 ? tokenTransfers : undefined,
          });
        }
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.log('[rgb][getCommonTransactions] listPaymentsRaw failed:', e?.message ?? e);
      }
    } else {
      // eslint-disable-next-line no-console
      console.log('[rgb][getCommonTransactions] SDK has no listPaymentsRaw — LN history omitted');
    }

    common.sort((a, b) => b.timestamp - a.timestamp);
    return common;
  }

  /**
   * Returns asset ids known to the wallet. Populates `_tokens` as a side effect
   * if the cache is empty, so that transfer attribution has metadata to join
   * against.
   */
  private async knownAssetIds(): Promise<string[]> {
    if (this._tokens.length === 0) await this.fetchTokenBalances();
    return this._tokens.map((t) => t.id);
  }

  private annotatedTransfersToCommon(list: AnnotatedTransfer[]): CommonTokenTransfer[] {
    const out: CommonTokenTransfer[] = [];
    // Dedupe against the case where the SDK returns the same transfer (same
    // assignments) for multiple per-asset `listTransfers(aid)` calls — e.g. a
    // batch transfer that touches two assets might surface in both queries.
    // Keying by (tokenId, amount, recipientId, kind) collapses exact repeats
    // without masking legitimately-distinct assignments.
    const seen = new Set<string>();
    for (const t of list) {
      const metadata = t.assetId ? this._tokens.find((m) => m.id === t.assetId) : undefined;
      // For `Send` transfers, `assignments[]` reflects the sender's *change*
      // UTXO (the leftover that stayed in the wallet) — not the amount that
      // was transferred. The actual transferred amount lives on
      // `requestedAssignment` (set from the invoice). For Receive/Issuance,
      // `assignments[]` is the inbound delta and is correct.
      const sourceAssignments = t.kind === 'Send' && t.requestedAssignment ? [t.requestedAssignment] : (t.assignments ?? []);
      for (const a of sourceAssignments) {
        // The TS interface declares `Assignment.type: 'Fungible' | 'NonFungible' | …`,
        // but the iOS Swift binding emits `{Fungible: 100}` (raw enum case)
        // instead of `{type: "Fungible", amount: 100}` like Android does, so
        // `a.type` is undefined on iOS and this filter drops everything.
        // Tracking: https://github.com/UTEXO-Protocol/rgb-sdk-rn/issues/28
        if (a.type !== 'Fungible' && a.type !== 'NonFungible') continue;
        const key = `${t.assetId ?? ''}|${a.amount ?? ''}|${t.recipientId ?? ''}|${t.kind}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          tokenId: t.assetId ?? '',
          amount: a.amount,
          decimals: metadata?.decimals ?? 0,
          name: metadata?.name,
          symbol: metadata?.symbol,
          address: t.recipientId,
          logoURI: metadata?.logoURI,
        });
      }
    }
    return out;
  }

  private async defaultFeeRate(): Promise<number> {
    return this._sdkNetwork === 'testnet' ? 1 : 5;
  }

  /**
   * Backup ledger semantics. See tasks/ship-rgb.md.
   *
   * Every state-changing op increments `_pendingMutationsSinceBackup`, calls
   * `vssBackup`, and on success decrements back to zero (or whatever the
   * intervening mutations have stacked up). On failure the counter stays
   * elevated, the error is classified, and the persisted state is updated so
   * the warning survives a force-quit.
   *
   * `critical: true` is the right choice for user-initiated transfers /
   * issuance: if the backup fails for one of those, we'd rather throw than
   * pretend everything's fine — the caller (send-confirm screen) can show a
   * "your transfer happened but backup failed" dialog and offer a retry.
   * Background ops like `prepareWallet`'s `createUtxos` keep the default
   * non-throwing behavior.
   */
  private async tryBackup(opts: { critical?: boolean } = {}): Promise<boolean> {
    this._pendingMutationsSinceBackup += 1;
    await this.persistBackupState();
    try {
      await this.sdk().vssBackup();
      this._pendingMutationsSinceBackup = Math.max(0, this._pendingMutationsSinceBackup - 1);
      this._lastBackupAt = Date.now();
      this._lastBackupError = null;
      await this.persistBackupState();
      return true;
    } catch (e) {
      const kind = classifyBackupError(e);
      this._lastBackupError = { kind, at: Date.now(), message: errorMessage(e) };
      await this.persistBackupState();
      globalThis.handleError?.(e, 'rgb-wallet.ts:vssBackup');
      if (opts.critical) throw e;
      return false;
    }
  }

  /**
   * Snapshot of the backup ledger for the UI hook. Read-only — mutations
   * happen exclusively through `tryBackup` so the persisted state can't
   * drift from in-memory.
   */
  getBackupStatus(): RgbBackupPersistedState {
    return {
      pendingMutations: this._pendingMutationsSinceBackup,
      lastBackupAt: this._lastBackupAt,
      lastBackupError: this._lastBackupError,
    };
  }

  /** Re-attempt a backup outside any specific mutation. Used by the "Retry
   *  backup" CTA in the warning banner. */
  async retryBackup(): Promise<boolean> {
    if (!this._sdkWallet) return false;
    try {
      await this.sdk().vssBackup();
      this._pendingMutationsSinceBackup = 0;
      this._lastBackupAt = Date.now();
      this._lastBackupError = null;
      await this.persistBackupState();
      return true;
    } catch (e) {
      this._lastBackupError = { kind: classifyBackupError(e), at: Date.now(), message: errorMessage(e) };
      await this.persistBackupState();
      globalThis.handleError?.(e, 'rgb-wallet.ts:retryBackup');
      return false;
    }
  }

  // ── Persistence helpers for the backup ledger + the "initialized" flag. ──
  // See tasks/ship-rgb.md.

  /**
   * The `storage?.<method> ?? noop` shape below tolerates the test fixtures'
   * `init({} as any)` pattern. Persistence is best-effort by design: a broken
   * storage layer must not crash wallet init, since the in-memory ledger is
   * still authoritative for the lifetime of the process.
   */
  private async hasInitializedBefore(): Promise<boolean> {
    if (!this._storage || typeof this._storage.getItem !== 'function') return false;
    try {
      const v = await this._storage.getItem(getRgbInitializedStorageKey(this._network));
      return v === 'true';
    } catch (e) {
      globalThis.handleError?.(e, 'rgb-wallet.ts:hasInitializedBefore');
      return false;
    }
  }

  private async markRgbInitialized(): Promise<void> {
    if (!this._storage || typeof this._storage.setItem !== 'function') return;
    try {
      await this._storage.setItem(getRgbInitializedStorageKey(this._network), 'true');
    } catch (e) {
      globalThis.handleError?.(e, 'rgb-wallet.ts:markRgbInitialized');
    }
  }

  private async loadBackupState(): Promise<void> {
    if (!this._storage || typeof this._storage.getItem !== 'function') return;
    try {
      const raw = await this._storage.getItem(getRgbBackupStateStorageKey(this._network, this._accountNumber));
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<RgbBackupPersistedState>;
      if (typeof parsed.pendingMutations === 'number') this._pendingMutationsSinceBackup = parsed.pendingMutations;
      if (parsed.lastBackupAt === null || typeof parsed.lastBackupAt === 'number') this._lastBackupAt = parsed.lastBackupAt;
      if (parsed.lastBackupError === null || (parsed.lastBackupError && typeof parsed.lastBackupError === 'object')) this._lastBackupError = parsed.lastBackupError ?? null;
    } catch (e) {
      // Corrupt persisted state shouldn't brick init. Reset to a clean ledger
      // and let the next mutation re-establish it.
      globalThis.handleError?.(e, 'rgb-wallet.ts:loadBackupState');
    }
  }

  private async persistBackupState(): Promise<void> {
    if (!this._storage || typeof this._storage.setItem !== 'function') return;
    const state: RgbBackupPersistedState = {
      pendingMutations: this._pendingMutationsSinceBackup,
      lastBackupAt: this._lastBackupAt,
      lastBackupError: this._lastBackupError,
    };
    try {
      await this._storage.setItem(getRgbBackupStateStorageKey(this._network, this._accountNumber), JSON.stringify(state));
    } catch (e) {
      globalThis.handleError?.(e, 'rgb-wallet.ts:persistBackupState');
    }
  }

  /**
   * Cheap shape check: confirms the string *looks* like an RGB invoice or a
   * taproot address so we don't submit obvious garbage to the SDK. Deep
   * validation (invoice consistency, transport endpoint reachability,
   * checksum) happens inside `sdk().decodeRGBInvoice()` and bech32m decoding
   * at send time — there's no value in duplicating that here.
   */
  static isAddressValid(input: string): boolean {
    const s = input.trim();
    if (!s) return false;
    // RGB invoices: require the scheme prefix plus a reasonably-long payload.
    // Invoice payloads can contain any base64url-like or URL-safe chars
    // depending on encoding, so the permissive payload check is intentional.
    if (/^rgb:\S{10,}$/i.test(s)) return true;
    if (/^utxob:\S{10,}$/i.test(s)) return true;
    // Taproot p2tr: bc1p / tb1p / bcrt1p bech32m.
    return /^(bc1p|tb1p|bcrt1p)[0-9a-z]{40,}$/i.test(s);
  }

  isAddressValid(input: string): boolean {
    return RgbWallet.isAddressValid(input);
  }
}

/**
 * `blindReceive` requires a free colorable UTXO; without one rgb-lib raises
 * `InsufficientAllocationSlots`. Caller (e.g. `requestReceive`) treats this
 * as the signal to fall back to `witnessReceive`. The RN SDK exposes the
 * error name via `code`; the web SDK puts it in the message.
 */
function isInsufficientAllocationSlots(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  if (err?.code === 'InsufficientAllocationSlots') return true;
  return /InsufficientAllocationSlots|insufficient.*allocation/i.test(String(err?.message ?? e));
}

/**
 * Classify a backup failure for the UI ledger. The split exists so the
 * warning banner can say "we couldn't reach the server" vs "the server
 * rejected our credentials" — both are actionable, but in different ways.
 * See tasks/ship-rgb.md.
 */
function classifyBackupError(e: unknown): RgbBackupErrorKind {
  if (!e) return 'unknown';
  const err = e as { code?: string; name?: string; message?: string; statusCode?: number; status?: number };
  const text = typeof err.message === 'string' ? err.message : String(e);
  if (err.code === 'NetworkError' || err.name === 'NetworkError') return 'network';
  if (/network|fetch|timeout|connection|reachable|enotfound|econn/i.test(text)) return 'network';
  if (err.statusCode === 401 || err.statusCode === 403 || err.status === 401 || err.status === 403) return 'auth';
  if (/unauthor|forbidden|invalid\s+(?:token|credential)|signature/i.test(text)) return 'auth';
  return 'unknown';
}

function errorMessage(e: unknown): string {
  if (!e) return 'unknown';
  const err = e as { message?: string };
  if (typeof err.message === 'string' && err.message) return err.message;
  return String(e);
}

/** Best-effort dispose. Tolerates partial/test mocks that don't implement it. */
async function disposeQuiet(w: IRgbWallet): Promise<void> {
  try {
    const r = (w as { dispose?: () => unknown | Promise<unknown> }).dispose?.();
    if (r && typeof (r as Promise<unknown>).then === 'function') await r;
  } catch {
    // ignore
  }
}

function isVssBackupMissing(e: unknown): boolean {
  // Only treat "VSS has no backup for this mnemonic" — or "the backup we have
  // is unreadable" — as an expected path into fresh-wallet creation. Every
  // other error rethrows so we never silently overwrite a real remote backup
  // with an empty local state.
  //
  // Each platform SDK signals "missing" differently:
  //  • RN SDK throws an RgbError with `code === 'VssBackupNotFound'` and a
  //    message like `Rgb.RgbLibError.VssBackupNotFound`.
  //  • Web SDK throws a non-Error object whose `toString()` returns
  //    `"VSS backup not found"` — no `message` property, just a stringifier.
  //  • Node/HTTP paths tend to throw a NotFoundError or an HTTP 404.
  //
  // "Unreadable" shows up as bincode/parse errors when an older SDK wrote the
  // backup and the current one can't decode it. Beta-to-beta schema breaks
  // are routine; treat them as missing so the next mutation rewrites the
  // backup cleanly. Acceptable risk: a transient decoder bug could discard a
  // good remote backup on first unlock — but the alternative is a permanent
  // boot loop with no recovery path.
  //
  // The "VSS backup not configured" / "VSS not initialized" message is the
  // web SDK's response when `vssBackupInfo()` is called on a wallet that
  // hasn't run `restoreFromVss` first — i.e. exactly the candidate built in
  // `acquireFreshWalletAfterProbe`. The web wasm exposes no probe API that
  // works without prior VSS setup, so this throw means "probe unavailable,
  // fall back to the restore verdict (which was 'missing')." Same outcome as
  // a real "missing" answer, so we merge them here.
  // Tracked upstream: https://github.com/UTEXO-Protocol/rgb-sdk-web/issues/6
  //
  // Tracked upstream (RN): https://github.com/UTEXO-Protocol/rgb-sdk-rn/issues/20
  if (!e) return false;
  const err = e as { name?: string; message?: string; statusCode?: number; status?: number; code?: string };
  if (err.code === 'VssBackupNotFound') return true;
  if (err.name === 'NotFoundError') return true;
  if (err.statusCode === 404 || err.status === 404) return true;
  const text = typeof err.message === 'string' ? err.message : String(e);
  if (/VssBackupNotFound|backup\s*not\s*found|backup\s+(does\s+not\s+exist|missing)/i.test(text)) return true;
  if (/VSS\s+backup\s+not\s+configured|VSS\s+not\s+initialized/i.test(text)) return true;
  if (/bincode error while reading entry|failed to fill whole buffer/i.test(text)) return true;
  return false;
}

function transferStatusToCommon(status: string): CommonTransaction['status'] {
  switch (status) {
    case 'Settled':
      return 'confirmed';
    case 'Failed':
      return 'failed';
    case 'WaitingCounterparty':
    case 'WaitingConfirmations':
    default:
      return 'pending';
  }
}

function paymentStatusToCommon(status: string | undefined): CommonTransaction['status'] {
  // The RLN SDK types call these 'Succeeded' / 'Failed' / … but the actual
  // native binding hands back UPPERCASE strings ('SUCCEEDED', 'FAILED', …).
  // Normalize before matching so both spellings work — spec vs reality
  // divergence isn't something we want to re-debug every SDK bump.
  switch ((status ?? '').toString().toUpperCase()) {
    case 'SUCCEEDED':
      return 'confirmed';
    case 'FAILED':
    case 'CANCELLED':
      return 'failed';
    case 'PENDING':
    case 'CLAIMABLE':
    case 'CLAIMING':
    default:
      return 'pending';
  }
}
