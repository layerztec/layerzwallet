import { sha256 } from '@noble/hashes/sha256';

import type { RgbNetwork } from '../types/rgb-adapter';

/**
 * Password of an RGB backup file. Derived from the seed, so "seed + file" is
 * all a user needs to recover — no extra password to lose. The network is
 * part of it: the engines do not check which network a file belongs to, and a
 * testnet file restored into a mainnet wallet would leave it unable to open.
 *
 * Same derivation on mobile and in the extension.
 */
export function rgbBackupPassword(mnemonic: string, network: RgbNetwork): string {
  const bytes = sha256(new TextEncoder().encode(`rgb-backup-v1\0${network}\0${mnemonic}`));
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}
