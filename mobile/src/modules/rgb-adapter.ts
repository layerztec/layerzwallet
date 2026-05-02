import { sha256 } from '@noble/hashes/sha256';
import { UTEXOWallet } from '@utexo/rgb-sdk-rn';
import { Directory, Paths } from 'expo-file-system';

import type { IRgbAdapter, IRgbAdapterCreateParams, IRgbWallet } from '@shared/types/rgb-adapter';

const RGB_DATA_ROOT = 'rgb';

/**
 * Hashes the raw mnemonic — no trim/lowercase — to match the normalization used
 * by `mobile/src/modules/breeze-adapter.ts` (`sha256(mnemonic)`). Upstream,
 * `sanitizeAndValidateMnemonic` in `shared/modules/wallet-utils.ts` canonicalises
 * mnemonics before they reach storage, so by the time this runs the mnemonic
 * string is already trimmed + lowercased.
 */
function mnemonicFingerprint(mnemonic: string): string {
  const digest = sha256(new TextEncoder().encode(mnemonic));
  let hex = '';
  for (let i = 0; i < 8; i++) hex += digest[i].toString(16).padStart(2, '0');
  return hex;
}

/**
 * Returns a per-mnemonic data directory. Isolating state by mnemonic prevents
 * the SDK from re-opening a previous wallet's rgb-lib sled store when the user
 * wipes the app and imports a different seed — the pattern mirrors
 * `breeze-adapter.ts` which uses `sha256(mnemonic)` for the same reason.
 *
 * Returned as a `Directory` (not a string) because expo-file-system's
 * `Directory` constructor requires an *absolute URI* on Android — passing a
 * bare POSIX path crashes with `IllegalArgumentException: URI is not absolute`.
 * Convert to the SDK's expected POSIX form via `dataDirSdkPath` only at the
 * native-call boundary.
 */
function dataDirFor(mnemonic: string, network: IRgbAdapterCreateParams['network']): Directory {
  const root = new Directory(Paths.document, RGB_DATA_ROOT, network, mnemonicFingerprint(mnemonic));
  if (!root.exists) root.create({ intermediates: true });
  return root;
}

/** Strips the `file://` URI prefix; the RN SDK expects a POSIX path. */
function dataDirSdkPath(dir: Directory): string {
  return dir.uri.replace(/^file:\/\//, '');
}

/**
 * rgb-lib throws these messages when the local sled store can't be parsed —
 * usually from an interrupted write (app killed mid-commit) or a schema bump
 * across an SDK upgrade. The Android binding self-heals (see RgbModule.kt:271);
 * iOS doesn't, so we mirror the recovery here.
 */
function isCorruptStore(e: unknown): boolean {
  const msg = (e as { message?: string })?.message ?? String(e);
  return /bincode error while reading entry/i.test(msg) || /failed to fill whole buffer/i.test(msg);
}

/**
 * Native dirs the iOS rgb-sdk-rn binding actually writes to. The `dataDir` we
 * pass to `WalletManager` is **ignored** by `_initializeWallet` in
 * `RgbSwiftHelper.swift:210`, which hardcodes `Documents/<network>/` (with
 * `network = toNativeNetwork(<sdk-network>)`). Each `UTEXOWallet` opens TWO
 * sub-wallets: a layer1 wallet on the bridge bitcoin chain, and a utexo
 * sidechain wallet that the SDK maps to `signet`. So for either preset we
 * have two on-disk dirs we have to wipe to recover.
 *
 * Tracked upstream: https://github.com/UTEXO-Protocol/rgb-sdk-rn/issues/20
 */
function nativeWalletDirs(network: IRgbAdapterCreateParams['network']): Directory[] {
  const layer1 = network === 'testnet' ? 'testnet' : 'mainnet';
  return [new Directory(Paths.document, layer1), new Directory(Paths.document, 'signet')];
}

class RgbAdapter implements IRgbAdapter {
  readonly capabilities = { lightning: false } as const;

  async createWallet({ mnemonic, network, vssServerUrl }: IRgbAdapterCreateParams): Promise<IRgbWallet> {
    const open = async () => {
      const wallet = new UTEXOWallet(mnemonic, {
        network,
        dataDir: dataDirSdkPath(dataDirFor(mnemonic, network)),
        vssServerUrl,
      });
      await wallet.initialize();
      return wallet;
    };
    try {
      return await open();
    } catch (e) {
      if (!isCorruptStore(e)) throw e;
      for (const dir of nativeWalletDirs(network)) {
        if (dir.exists) dir.delete();
      }
      const adapterDir = dataDirFor(mnemonic, network);
      if (adapterDir.exists) adapterDir.delete();
      return open();
    }
  }

  async restoreFromVss({ mnemonic, network, vssServerUrl }: IRgbAdapterCreateParams): Promise<IRgbWallet> {
    const dir = dataDirFor(mnemonic, network);
    // rgb-lib refuses to restore over an existing wallet dir
    // (`WalletDirAlreadyExists`). If we already have local state, skip the VSS
    // step — `createWallet` will reopen the existing sled stores in place.
    if (!new Directory(dir, 'layer1').exists) {
      await UTEXOWallet.restoreFromVss(mnemonic, dataDirSdkPath(dir), vssServerUrl ? { serverUrl: vssServerUrl } : undefined);
    }
    return this.createWallet({ mnemonic, network, vssServerUrl });
  }
}

globalThis.rgbAdapter = new RgbAdapter();
