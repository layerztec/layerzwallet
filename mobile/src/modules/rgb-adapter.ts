import { sha256 } from '@noble/hashes/sha256';
import { UTEXOWallet } from '@utexo/rgb-sdk';
import { accountXpubsFromMnemonic } from '@utexo/rgb-sdk-core';
import { RgbLibRn, restoreBackupFromFile } from '@utexo/rgb-sdk-rn';
import { Directory, File, Paths } from 'expo-file-system';

import { proxyRgbFacade } from '@shared/modules/rgb-facade-proxy';
import type { IRgbAdapter, IRgbAdapterCreateParams, IRgbWallet, RgbNetwork } from '@shared/types/rgb-adapter';

const RGB_DATA_ROOT = 'rgb';
// The L1 engine (rgb-lib) refuses a directory that holds another profile's
// data, so it gets its own subtree next to whatever the retired RLN node left
// under `rgb/<network>/`. `wipeAllRgbData` removes the whole root.
const RGB_ENGINE_DIR = 'l1';

/**
 * Debug tracing for the RGB integration. Prints only in dev builds so
 * invoices and allocation dumps never reach production logs; errors still go
 * through `globalThis.handleError`.
 */
function rgbLog(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  if ((globalThis as { __DEV__?: boolean }).__DEV__) console.log(...args);
}

// Must be `'utexo'`, NOT `'signet'`: the SDK ships separate defaults for each
// and the faucet + USDT asset live on the UTEXO chain.
function toEngineNetwork(network: RgbNetwork): 'utexo' | 'mainnet' {
  return network === 'testnet' ? 'utexo' : 'mainnet';
}

function hex(bytes: Uint8Array, length = bytes.length): string {
  let out = '';
  for (let i = 0; i < length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

function mnemonicFingerprint(mnemonic: string): string {
  return hex(sha256(new TextEncoder().encode(mnemonic)), 8);
}

// Backup files are encrypted with a key derived from the seed, so "seed +
// file" is all a user needs to recover — no extra password to lose.
function backupPassword(mnemonic: string): string {
  return hex(sha256(new TextEncoder().encode(`rgb-backup-v1\0${mnemonic}`)));
}

/** sha256 of the RGB (colored) account xpub — public, deterministic per seed. */
async function accountIdFor(mnemonic: string, network: RgbNetwork): Promise<string> {
  const xpubs = await accountXpubsFromMnemonic(toEngineNetwork(network), mnemonic);
  return hex(sha256(new TextEncoder().encode(xpubs.account_xpub_colored)));
}

function dataDirFor(mnemonic: string, network: RgbNetwork): Directory {
  const root = new Directory(Paths.document, RGB_DATA_ROOT, RGB_ENGINE_DIR, network, mnemonicFingerprint(mnemonic));
  if (!root.exists) root.create({ intermediates: true });
  return root;
}

function dataDirSdkPath(dir: Directory): string {
  return dir.uri.replace(/^file:\/\//, '').replace(/\/$/, '');
}

const NOOP_VSS_BACKUP_INFO = { backupExists: false, backupRequired: false, serverVersion: null };

// Mirrors VSS_UNAVAILABLE in shared/class/wallets/rgb-wallet.ts (not imported —
// the adapter deliberately has no dependency on the wallet class). tryBackup
// classifies this as 'unavailable': the ledger records it (banner shows "No
// cloud backup yet") but critical paths don't throw for it.
function vssUnavailableError(): Error {
  const e = new Error('Cloud backup is not available: the RGB engine has no VSS support on this platform yet');
  e.name = 'VssUnavailable';
  return e;
}

/**
 * The shared wallet still speaks the older `IRgbWallet` names (the extension
 * adapter implements them natively). Map the few that differ on the
 * `UTEXOWallet` facade; everything else passes straight through, including
 * facade-only members the WebRGB provider reads.
 *
 * Cloud backup: `RgbLibRn` implements file/bytes export only (no VSS
 * extension as of rgb-sdk-rn beta.41), so the VSS calls report "unavailable"
 * rather than pretending — see tasks/rgb-l1-migration.md, phase 3.
 */
function adapt(wallet: UTEXOWallet<RgbLibRn>, accountId: string): IRgbWallet {
  return proxyRgbFacade(wallet, {
    send: (params: Parameters<typeof wallet.onchainSend>[0]) => wallet.onchainSend(params),
    estimateFeeRate: async (blocks: number) => (await wallet.estimateFeeRate(blocks)).feeRate,
    // Stable public id for dApp sessions (WalletConnect account). The
    // engine's own identity id is per-installation, so it can't be used.
    getAccountId: () => accountId,
    vssBackup: async () => {
      throw vssUnavailableError();
    },
    vssBackupInfo: async () => NOOP_VSS_BACKUP_INFO,
    configureVssBackup: async () => {},
    disableVssAutoBackup: async () => {},
    getDefaultVssConfig: async () => null,
  });
}

// One engine per (mnemonic, network): rgb-lib locks its directory while a
// session is open, so a second open of the same wallet in this process would
// fail with WALLET_STORAGE_IN_USE. Promises are cached so concurrent callers
// share the same init.
const walletByKey = new Map<string, Promise<IRgbWallet>>();

const walletKey = (mnemonic: string, network: RgbNetwork) => `${network}:${mnemonicFingerprint(mnemonic)}`;

/**
 * Write an encrypted backup of the wallet's RGB state to the cache dir and
 * return its uri (for the share sheet). Interim recovery path until the
 * engine supports cloud backup: without this file, a lost device loses the
 * RGB assets even though the seed is known.
 */
export async function exportRgbBackupFile(mnemonic: string, network: RgbNetwork): Promise<string> {
  const wallet = (await globalThis.rgbAdapter.createWallet({ mnemonic, network })) as unknown as { exportBackupToFile(p: { filePath: string; password: string }): Promise<unknown> };
  const file = new File(Paths.cache, `layerz-rgb-${network}-${mnemonicFingerprint(mnemonic)}.rgbbackup`);
  if (file.exists) file.delete();
  await wallet.exportBackupToFile({ filePath: file.uri.replace(/^file:\/\//, ''), password: backupPassword(mnemonic) });
  return file.uri;
}

/**
 * Replace the wallet's local RGB state with a backup file made by
 * `exportRgbBackupFile` for the SAME seed. The current state is moved aside
 * and put back if the restore fails. Caller must relaunch the app afterwards:
 * live RgbWallet instances still hold the disposed engine.
 */
export async function importRgbBackupFile(mnemonic: string, network: RgbNetwork, fileUri: string): Promise<void> {
  const key = walletKey(mnemonic, network);
  const open = walletByKey.get(key);
  walletByKey.delete(key);
  if (open) await (await open).dispose();

  const dir = dataDirFor(mnemonic, network);
  const aside = new Directory(dir.parentDirectory, `${dir.name}.pre-import`);
  if (aside.exists) aside.delete();
  dir.move(aside);
  const fresh = dataDirFor(mnemonic, network);
  try {
    await restoreBackupFromFile({ filePath: fileUri.replace(/^file:\/\//, ''), password: backupPassword(mnemonic), dataDir: dataDirSdkPath(fresh) });
  } catch (e) {
    if (fresh.exists) fresh.delete();
    aside.move(new Directory(aside.parentDirectory, fresh.name));
    throw e;
  }
  aside.delete();
}

class RgbAdapter implements IRgbAdapter {
  readonly capabilities = { lightning: false };

  createWallet(params: IRgbAdapterCreateParams): Promise<IRgbWallet> {
    const key = walletKey(params.mnemonic, params.network);
    const cached = walletByKey.get(key);
    if (cached) return cached;
    const created = (async () => {
      const dir = dataDirFor(params.mnemonic, params.network);
      rgbLog('[rgb-adapter] opening RGB_L1 wallet at', dir.uri);
      const engine = new RgbLibRn({ network: toEngineNetwork(params.network), storageDirPath: dataDirSdkPath(dir) }, params.mnemonic);
      const wallet = new UTEXOWallet({ engine });
      await wallet.init();
      return adapt(wallet, await accountIdFor(params.mnemonic, params.network));
    })();
    walletByKey.set(key, created);
    // A failed open must not poison the cache — the next call retries.
    created.catch(() => {
      if (walletByKey.get(key) === created) walletByKey.delete(key);
    });
    return created;
  }

  // No cloud restore on this engine yet: a "restore" opens (or creates) the
  // local wallet, exactly like createWallet.
  restoreFromVss(params: IRgbAdapterCreateParams): Promise<IRgbWallet> {
    return this.createWallet(params);
  }
}

globalThis.rgbAdapter = new RgbAdapter();

/**
 * Nuke ALL on-disk RGB SDK state (all mnemonic × network dirs under
 * `Documents/rgb`) and drop the in-memory wallet cache. Called from the
 * "Clear All Data" tool because `AsyncStorage.clear()` only wipes the JS
 * side — the RLN node's LDK state and RGB registrar DB live on the
 * filesystem outside AsyncStorage's reach, so without this the next
 * import against the same mnemonic re-inits on top of stale native state
 * and every subsequent op throws "conflict with current node state".
 */
const RGB_SNAPSHOT_ROOT = 'rgb-snapshot';

/**
 * Dev-only: copy `Documents/rgb/` → `Documents/rgb-snapshot/`. Lets a QA flow
 * roundtrip through Clear All Data (currently VSS-less on beta.20+; see
 * `shimVssMethods`) without re-requesting assets from the faucet each time.
 * Overwrites any previous snapshot. Also snapshots the on-disk state exactly
 * as-is — if the RLN node has open channels or pending transfers, restoring
 * back into that state after a Rust process kill may or may not work; use
 * against a quiescent wallet only.
 */
export async function snapshotAllRgbData(): Promise<{ snapshottedPath: string; empty: boolean }> {
  const src = new Directory(Paths.document, RGB_DATA_ROOT);
  const dst = new Directory(Paths.document, RGB_SNAPSHOT_ROOT);
  if (dst.exists) {
    try {
      dst.delete();
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.warn('[rgb-adapter] snapshotAllRgbData: failed to clear prior snapshot', e?.message ?? e);
    }
  }
  if (!src.exists) {
    return { snapshottedPath: dst.uri, empty: true };
  }
  dst.create({ intermediates: true });
  // expo-file-system's Directory.copy copies the source directory *into* the
  // destination (creates `<dst>/rgb`). We want the contents at the root of
  // the snapshot dir instead, so walk one level and copy each child.
  for (const child of src.list()) {
    child.copy(dst);
  }
  rgbLog('[rgb-adapter] snapshotAllRgbData: snapshotted to', dst.uri);
  return { snapshottedPath: dst.uri, empty: false };
}

/**
 * Dev-only companion to `snapshotAllRgbData`. Tears down cached wallets +
 * wipes live `Documents/rgb/`, then copies from the snapshot dir back.
 * Caller must force-kill the app afterwards (see
 * https://github.com/UTEXO-Protocol/rgb-sdk-rn/issues/47 — the native
 * binding doesn't release its per-process registration for the storage
 * dir on dispose, so a fresh init in the same process throws
 * "conflict with current node state" regardless of on-disk state).
 */
export async function restoreAllRgbData(): Promise<{ restored: boolean; reason?: string }> {
  const src = new Directory(Paths.document, RGB_SNAPSHOT_ROOT);
  if (!src.exists) return { restored: false, reason: 'no snapshot on disk' };
  await wipeAllRgbData();
  const dst = new Directory(Paths.document, RGB_DATA_ROOT);
  dst.create({ intermediates: true });
  for (const child of src.list()) {
    child.copy(dst);
  }
  rgbLog('[rgb-adapter] restoreAllRgbData: restored from', src.uri);
  return { restored: true };
}

export async function wipeAllRgbData(): Promise<void> {
  rgbLog('[rgb-adapter] wipeAllRgbData start');
  // Tear down every live SDK wallet BEFORE removing the on-disk data — the
  // native RLN binding is per-process, and if we skip destroy() the binding
  // keeps the old `rlnNodeId` cached against a storageDirPath we just
  // deleted. The next `createWallet` for the same mnemonic then races
  // between the stale in-memory node and a fresh on-disk shell, and every
  // op throws "conflict with current node state" / "RLN node is not created".
  const pending = Array.from(walletByKey.values());
  rgbLog('[rgb-adapter] wipeAllRgbData: cached wallet count =', pending.length);
  walletByKey.clear();
  for (const p of pending) {
    try {
      const w: any = await p;
      if (typeof w?.dispose === 'function') {
        rgbLog('[rgb-adapter] wipeAllRgbData: calling sdk.dispose on wallet');
        await w.dispose();
      }
    } catch (e: any) {
      rgbLog('[rgb-adapter] wipeAllRgbData: dispose failed', e?.message ?? e);
    }
  }
  const root = new Directory(Paths.document, RGB_DATA_ROOT);
  if (root.exists) {
    // Deliberately NOT swallowed: Clear All Data's success alert promises
    // "all app data has been cleared", and a leftover `Documents/rgb/`
    // makes the next same-seed import init on top of stale native state
    // ("conflict with current node state" on every op). Let the caller
    // surface the failure instead of lying.
    root.delete();
    rgbLog('[rgb-adapter] wipeAllRgbData: deleted', root.uri);
  } else {
    rgbLog('[rgb-adapter] wipeAllRgbData: rgb dir did not exist');
  }
}
