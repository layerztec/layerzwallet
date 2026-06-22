import { sha256 } from '@noble/hashes/sha256';
import { PasswordRLNSigner, UTEXOWallet, resolveUnlockParams, type UTEXOWalletNodeParams, type UtexoLsp } from '@utexo/rgb-sdk-rn';
import { Directory, File, Paths } from 'expo-file-system';

import { RGB_LSP_BASE_URL } from '../constants/rgb-lsp';
import type { IRgbAdapter, IRgbAdapterCreateParams, IRgbWallet, RgbLnReceiveResult, RgbLnSendResult, RgbLnSettlementOutcome, RgbNetwork } from '@shared/types/rgb-adapter';

const RGB_DATA_ROOT = 'rgb';

// rgb-sdk-rn maps RGB network names to the RLN node's `network` string. We
// must use `'utexo'`, NOT `'signet'`: the SDK ships separate defaults for
// each (`DEFAULT_INDEXER_URLS.signet → iriswallet electrum`,
// `DEFAULT_INDEXER_URLS.utexo → esplora-api.utexo.com`). The faucet, LSP and
// USDT asset all live on the UTEXO chain — pointing the wallet at iriswallet
// signet leaves it scanning a different ledger entirely (balance stays at 0
// even after on-chain confirmation, JIT channel for the UTST asset id never
// opens). Mainnet is still flag-gated; the network string there will be
// `'mainnet'` once UTEXO publishes prod endpoints.
function toRlnNetwork(network: RgbNetwork): string {
  return network === 'testnet' ? 'utexo' : 'mainnet';
}

// Base ports for the on-device RLN node. The actual ports are offset per
// mnemonic so two simulators (different wallets) on the same dev host don't
// collide on loopback when running side-by-side. On a real device this just
// shifts the port within a deterministic range; one wallet per device means
// no in-process clash.
const DAEMON_LISTENING_PORT_BASE = 3001;
const LDK_PEER_LISTENING_PORT_BASE = 9736;
// 997 keeps the result < 4998 / < 10733, well clear of the next protocol port.
const PORT_OFFSET_MOD = 997;

function mnemonicFingerprint(mnemonic: string): string {
  const digest = sha256(new TextEncoder().encode(mnemonic));
  let hex = '';
  for (let i = 0; i < 8; i++) hex += digest[i].toString(16).padStart(2, '0');
  return hex;
}

function portOffset(mnemonic: string): number {
  const digest = sha256(new TextEncoder().encode(mnemonic));
  // First 4 bytes as uint32 → mod ⇒ stable per-mnemonic offset.
  const n = (digest[0] << 24) | (digest[1] << 16) | (digest[2] << 8) | digest[3];
  return Math.abs(n) % PORT_OFFSET_MOD;
}

// Password protects the RLN node's on-disk encrypted key store. We don't have
// the user's wallet password in this layer, so derive deterministically from
// the mnemonic — same-strength secret, unlocks the same wallet across restarts.
function rlnPassword(mnemonic: string): string {
  const digest = sha256(new TextEncoder().encode(`rgb-rln-password-v1\0${mnemonic}`));
  let hex = '';
  for (let i = 0; i < digest.length; i++) hex += digest[i].toString(16).padStart(2, '0');
  return hex;
}

function dataDirFor(mnemonic: string, network: RgbNetwork): Directory {
  const root = new Directory(Paths.document, RGB_DATA_ROOT, network, mnemonicFingerprint(mnemonic));
  if (!root.exists) root.create({ intermediates: true });
  return root;
}

function dataDirSdkPath(dir: Directory): string {
  return dir.uri.replace(/^file:\/\//, '');
}

// Sentinel file under the RGB data dir. Presence ⇒ RLN node already initialized
// at least once → call `unlock()`. Absence ⇒ first run → call `init()` then mark.
// Using a sentinel rather than introspecting the SDK's internal state keeps the
// init/unlock branch decision in our control across SDK upgrades.
const INIT_MARKER = '.rgb-rln-initialized';

function initMarker(dir: Directory): File {
  return new File(dir, INIT_MARKER);
}

// `IRgbWallet` (from shared/types) still references VSS methods that beta.14's
// `UTEXOWallet` no longer exposes — extension is on beta.9 and uses the real
// methods, so we can't drop them from the shape yet. Stub them here as no-ops:
// safe because mobile's beta.14 SDK handles VSS internally via `vssUrl` in the
// node params, and the shared backup-state ledger does not enforce these calls.
//
// TODO(rgb-backup): UTEXO confirmed cloud backup is coming back to the
// rgb-sdk-rn build. When it lands, rip out these shims and reconnect the
// shared backup-state ledger (probe / banner / "had backup, now missing"
// detection — see tasks/ship-rgb.md). Until then we ship without a real
// cloud safety net on mobile.
const NOOP_VSS_BACKUP_INFO = { backupExists: false, backupRequired: false, serverVersion: null };

function shimVssMethods(wallet: UTEXOWallet): IRgbWallet {
  return new Proxy(wallet, {
    get(target, prop, receiver) {
      switch (prop) {
        case 'vssBackup':
          return async () => 0;
        case 'vssBackupInfo':
          return async () => NOOP_VSS_BACKUP_INFO;
        case 'configureVssBackup':
        case 'disableVssAutoBackup':
          return async () => undefined;
        case 'getDefaultVssConfig':
          return async () => undefined;
        case 'lightningReceiveAsset':
          return (params: Parameters<typeof lightningReceiveAsset>[1]) => lightningReceiveAsset(target as UTEXOWallet, params);
        case 'lightningSendAsset':
          return (params: Parameters<typeof lightningSendAsset>[1]) => lightningSendAsset(target as UTEXOWallet, params);
        case 'payLightningInvoice':
          return (params: Parameters<typeof payLightningInvoice>[1]) => payLightningInvoice(target as UTEXOWallet, params);
        case 'awaitLightningReceiveSettlement':
          return (params: Parameters<typeof awaitLightningReceiveSettlement>[1]) => awaitLightningReceiveSettlement(target as UTEXOWallet, params);
        default:
          return Reflect.get(target, prop, receiver);
      }
    },
  }) as unknown as IRgbWallet;
}

function buildNodeParams(dir: Directory, mnemonic: string, network: RgbNetwork, vssServerUrl: string | undefined): UTEXOWalletNodeParams {
  const rlnNet = toRlnNetwork(network);
  const off = portOffset(mnemonic);
  return {
    storageDirPath: dataDirSdkPath(dir),
    daemonListeningPort: DAEMON_LISTENING_PORT_BASE + off,
    ldkPeerListeningPort: LDK_PEER_LISTENING_PORT_BASE + off,
    network: rlnNet,
    vssUrl: vssServerUrl ?? null,
    lspBaseUrl: RGB_LSP_BASE_URL[rlnNet === 'mainnet' ? 'mainnet' : 'signet'],
  };
}

/**
 * Lazily attach a UtexoLsp instance on first LN call. `createLsp()` reaches the
 * configured LSP HTTP endpoint to fetch its peer pubkey, then `connect()`
 * establishes the LDK P2P link — both can fail (network, misconfigured baseUrl)
 * and we surface the error to the caller verbatim. Cached per wallet so the
 * HTTP probe doesn't repeat for every receive.
 *
 * Failed promises are evicted from the cache so the next call retries from
 * scratch — otherwise a transient network blip during the first LN tap would
 * permanently poison the wallet's LSP slot until process restart.
 */
const lspByWallet = new WeakMap<UTEXOWallet, Promise<UtexoLsp>>();

function ensureLsp(wallet: UTEXOWallet): Promise<UtexoLsp> {
  let pending = lspByWallet.get(wallet);
  if (!pending) {
    pending = (async () => {
      const lsp = await wallet.createLsp();
      await lsp.connect();
      return lsp;
    })();
    lspByWallet.set(wallet, pending);
    pending.catch(() => {
      // Drop the rejected promise so the next caller gets a fresh attempt.
      // Only drop the entry if it's still ours — a successful retry could
      // have replaced it while this catch ran.
      if (lspByWallet.get(wallet) === pending) {
        lspByWallet.delete(wallet);
      }
    });
  }
  return pending;
}

async function lightningReceiveAsset(wallet: UTEXOWallet, params: { amountSats: number; amountRgb: number; assetId: string; expirySeconds?: number }): Promise<RgbLnReceiveResult> {
  const lsp = await ensureLsp(wallet);
  // Do NOT pre-call `waitForChannel(assetId)` here — JIT channels are opened
  // by the LSP *during* `receiveAsset` (server creates the invoice + opens
  // the inbound channel on-demand). Pre-waiting blocks indefinitely on a
  // fresh wallet because no channel exists yet and the LSP has no trigger
  // to open one without a payment request.
  return lsp.receiveAsset({
    assetId: params.assetId,
    amountSats: params.amountSats,
    amountRgb: params.amountRgb,
    expirySeconds: params.expirySeconds,
  });
}

async function awaitLightningReceiveSettlement(wallet: UTEXOWallet, params: { lnInvoice: string; timeoutMs?: number; signal?: AbortSignal }): Promise<RgbLnSettlementOutcome> {
  const lsp = await ensureLsp(wallet);
  return lsp.awaitReceiveSettlement(params.lnInvoice, { timeoutMs: params.timeoutMs, signal: params.signal });
}

async function lightningSendAsset(wallet: UTEXOWallet, params: { rgbInvoice: string }): Promise<RgbLnSendResult> {
  const lsp = await ensureLsp(wallet);
  const r = await lsp.sendAsset({ rgbInvoice: params.rgbInvoice });
  // The SDK returns SendAssetResult = LspOnchainSendResponse (rgb/ln
  // invoice echoes) + `sendResult: LightningSendRequest` which carries the
  // actual on-chain txid + optional status. Surface only what the UI needs.
  return { txid: r.sendResult.txid, status: r.sendResult.status };
}

async function payLightningInvoice(wallet: UTEXOWallet, params: { lnInvoice: string; assetId?: string; assetAmount?: number; maxFee?: number }): Promise<RgbLnSendResult> {
  // Direct LN pay (no LSP roundtrip — uses our own node's channel inventory).
  // For asset-tagged invoices the SDK validates `assetId` against the invoice.
  const r = await wallet.payLightningInvoice({
    lnInvoice: params.lnInvoice,
    assetId: params.assetId,
    assetAmount: params.assetAmount,
    maxFee: params.maxFee,
  });
  return { txid: r.txid, status: r.status };
}

// Dedupe wallet construction per (mnemonic, network). The native binding's
// `rlnCreateNode` registers nodes by storageDirPath — calling it twice
// against the same path (e.g. parallel `lazyInitWallet` requests for the
// same wallet) throws "RLN node already exists for storageDirPath". Cache
// the first promise so concurrent and subsequent callers reuse it. Drop on
// rejection so a transient failure doesn't poison the slot.
const walletByKey = new Map<string, Promise<IRgbWallet>>();

function walletKey(mnemonic: string, network: RgbNetwork): string {
  return `${network}|${mnemonicFingerprint(mnemonic)}`;
}

class RgbAdapter implements IRgbAdapter {
  // Mobile SDK has the LN surface (UtexoLsp / channels / invoices). Shared
  // code still gates UI on this flag plus per-network checks because LN is
  // only usable when an LSP base URL is configured (see rgb-lsp.ts).
  readonly capabilities = { lightning: true } as const;

  async createWallet({ mnemonic, network, vssServerUrl }: IRgbAdapterCreateParams): Promise<IRgbWallet> {
    const key = walletKey(mnemonic, network);
    const cached = walletByKey.get(key);
    if (cached) return cached;
    // `_createWallet` handles its own cleanup on failure: it calls
    // `wallet.destroy()` (which runs `rlnDestroyNode`) and removes its own
    // cache entry so the next caller gets a fresh attempt against a clean
    // binding registry. Without that teardown a follow-up
    // `new UTEXOWallet(...)` against the same storageDirPath throws
    // "RLN node already exists for storageDirPath".
    const pending = this._createWallet({ mnemonic, network, vssServerUrl });
    walletByKey.set(key, pending);
    return pending;
  }

  private async _createWallet({ mnemonic, network, vssServerUrl }: IRgbAdapterCreateParams): Promise<IRgbWallet> {
    const dir = dataDirFor(mnemonic, network);
    const marker = initMarker(dir);
    const rlnNet = toRlnNetwork(network);
    const password = rlnPassword(mnemonic);

    const params = buildNodeParams(dir, mnemonic, network, vssServerUrl);
    const signer = new PasswordRLNSigner(password, mnemonic);
    const wallet = new UTEXOWallet(params, signer);

    // `init()` writes the node keys to disk; only safe on the very first run.
    // On every later boot (cold app start, even when on-disk state exists),
    // the binding's internal RLN node table is empty — we still need
    // `rlnCreateNode` to associate the storage dir with a node id, otherwise
    // `unlock()` fails with "RLN node is not created". The SDK exposes that
    // path as `reinit()` (createNode without initNode).
    //
    // On any failure during init/unlock the binding may already have
    // registered the storageDirPath (createNode succeeded, later step
    // failed). Tear down with `destroy()` so the cache eviction in
    // `createWallet` can hand out a fresh wallet next time without the
    // "RLN node already exists for storageDirPath" guard tripping.
    try {
      if (!marker.exists) {
        await wallet.init();
        marker.create();
      } else {
        await wallet.reinit();
      }
      await wallet.unlock(resolveUnlockParams(rlnNet, {}));
    } catch (e) {
      try {
        await wallet.destroy();
      } catch {
        // best-effort cleanup; surface the original error
      }
      walletByKey.delete(walletKey(mnemonic, network));
      throw e;
    }
    return shimVssMethods(wallet);
  }

  // VSS restore is now driven by the SDK during `init()` / `unlock()` via
  // `vssUrl` + `vssAllowEmptyRestore`. Callers that asked for an explicit
  // restore get the same wallet `createWallet` would produce.
  async restoreFromVss(params: IRgbAdapterCreateParams): Promise<IRgbWallet> {
    return this.createWallet(params);
  }
}

globalThis.rgbAdapter = new RgbAdapter();
