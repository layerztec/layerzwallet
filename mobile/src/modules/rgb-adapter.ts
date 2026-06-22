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

// Ports the RLN node listens on locally. Fixed because every device only runs
// one RLN node at a time (one wallet active). If these ever clash with another
// process, the device-side bind would surface — we'll deal with conflict then.
const DAEMON_LISTENING_PORT = 3001;
const LDK_PEER_LISTENING_PORT = 9736;

function mnemonicFingerprint(mnemonic: string): string {
  const digest = sha256(new TextEncoder().encode(mnemonic));
  let hex = '';
  for (let i = 0; i < 8; i++) hex += digest[i].toString(16).padStart(2, '0');
  return hex;
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
        case 'awaitLightningReceiveSettlement':
          return (params: Parameters<typeof awaitLightningReceiveSettlement>[1]) => awaitLightningReceiveSettlement(target as UTEXOWallet, params);
        default:
          return Reflect.get(target, prop, receiver);
      }
    },
  }) as unknown as IRgbWallet;
}

function buildNodeParams(dir: Directory, network: RgbNetwork, vssServerUrl: string | undefined): UTEXOWalletNodeParams {
  const rlnNet = toRlnNetwork(network);
  return {
    storageDirPath: dataDirSdkPath(dir),
    daemonListeningPort: DAEMON_LISTENING_PORT,
    ldkPeerListeningPort: LDK_PEER_LISTENING_PORT,
    network: rlnNet,
    vssUrl: vssServerUrl ?? null,
    lspBaseUrl: RGB_LSP_BASE_URL[rlnNet === 'signet' ? 'signet' : 'mainnet'],
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
  // First-time receive for an asset requires a usable RGB channel — JIT opened
  // by the LSP after `connect()`. Subsequent receives reuse the existing
  // channel. `waitForChannel` no-ops fast when one is already ready.
  await lsp.waitForChannel(params.assetId);
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

class RgbAdapter implements IRgbAdapter {
  // Mobile SDK has the LN surface (UtexoLsp / channels / invoices). Shared
  // code still gates UI on this flag plus per-network checks because LN is
  // only usable when an LSP base URL is configured (see rgb-lsp.ts).
  readonly capabilities = { lightning: true } as const;

  async createWallet({ mnemonic, network, vssServerUrl }: IRgbAdapterCreateParams): Promise<IRgbWallet> {
    const dir = dataDirFor(mnemonic, network);
    const marker = initMarker(dir);
    const rlnNet = toRlnNetwork(network);
    const password = rlnPassword(mnemonic);

    const params = buildNodeParams(dir, network, vssServerUrl);
    const signer = new PasswordRLNSigner(password, mnemonic);
    const wallet = new UTEXOWallet(params, signer);

    // `init()` writes the node keys to disk; only safe on the very first run.
    // On every later boot (cold app start, even when on-disk state exists),
    // the binding's internal RLN node table is empty — we still need
    // `rlnCreateNode` to associate the storage dir with a node id, otherwise
    // `unlock()` fails with "RLN node is not created". The SDK exposes that
    // path as `reinit()` (createNode without initNode).
    if (!marker.exists) {
      await wallet.init();
      marker.create();
    } else {
      await wallet.reinit();
    }

    await wallet.unlock(resolveUnlockParams(rlnNet, {}));
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
