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
 * `breeze-adapter.ts` which uses `sha256(mnemonic)` for the same reason. Strips
 * the `file://` URI prefix because the RN SDK expects a POSIX path.
 */
function dataDirFor(mnemonic: string, network: IRgbAdapterCreateParams['network']): string {
  const root = new Directory(Paths.document, RGB_DATA_ROOT, network, mnemonicFingerprint(mnemonic));
  if (!root.exists) root.create({ intermediates: true });
  return root.uri.replace(/^file:\/\//, '');
}

class RgbAdapter implements IRgbAdapter {
  readonly capabilities = { lightning: false } as const;

  async createWallet({ mnemonic, network, vssServerUrl }: IRgbAdapterCreateParams): Promise<IRgbWallet> {
    const wallet = new UTEXOWallet(mnemonic, {
      network,
      dataDir: dataDirFor(mnemonic, network),
      vssServerUrl,
    });
    await wallet.initialize();
    return wallet;
  }

  async restoreFromVss({ mnemonic, network, vssServerUrl }: IRgbAdapterCreateParams): Promise<IRgbWallet> {
    await UTEXOWallet.restoreFromVss(mnemonic, dataDirFor(mnemonic, network), vssServerUrl ? { serverUrl: vssServerUrl } : undefined);
    return this.createWallet({ mnemonic, network, vssServerUrl });
  }
}

globalThis.rgbAdapter = new RgbAdapter();
