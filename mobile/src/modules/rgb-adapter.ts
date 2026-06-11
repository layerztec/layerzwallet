import { sha256 } from '@noble/hashes/sha256';
import { PasswordRLNSigner, UTEXOWallet, resolveUnlockParams, type UTEXOWalletNodeParams } from '@utexo/rgb-sdk-rn';
import { Directory, File, Paths } from 'expo-file-system';

import type { IRgbAdapter, IRgbAdapterCreateParams, IRgbWallet, RgbNetwork } from '@shared/types/rgb-adapter';

const RGB_DATA_ROOT = 'rgb';

// rgb-sdk-rn beta.14 maps RGB network names to the RLN node's `network` string.
// 'testnet' → 'signet' (utexo testnet runs on signet). Mainnet not yet enabled
// on this branch — we still treat 'mainnet' as RGB utexo mainnet for now.
function toRlnNetwork(network: RgbNetwork): string {
  return network === 'testnet' ? 'signet' : 'mainnet';
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
        default:
          return Reflect.get(target, prop, receiver);
      }
    },
  }) as unknown as IRgbWallet;
}

function buildNodeParams(dir: Directory, network: RgbNetwork, vssServerUrl: string | undefined): UTEXOWalletNodeParams {
  return {
    storageDirPath: dataDirSdkPath(dir),
    daemonListeningPort: DAEMON_LISTENING_PORT,
    ldkPeerListeningPort: LDK_PEER_LISTENING_PORT,
    network: toRlnNetwork(network),
    vssUrl: vssServerUrl ?? null,
  };
}

class RgbAdapter implements IRgbAdapter {
  // Lightning surface (channels/peers/invoices) exists in beta.14 but isn't
  // wired into UI yet. Keep the flag off until we expose it deliberately.
  readonly capabilities = { lightning: false } as const;

  async createWallet({ mnemonic, network, vssServerUrl }: IRgbAdapterCreateParams): Promise<IRgbWallet> {
    const dir = dataDirFor(mnemonic, network);
    const marker = initMarker(dir);
    const rlnNet = toRlnNetwork(network);
    const password = rlnPassword(mnemonic);

    const params = buildNodeParams(dir, network, vssServerUrl);
    const signer = new PasswordRLNSigner(password, mnemonic);
    const wallet = new UTEXOWallet(params, signer);

    if (!marker.exists) {
      await wallet.init();
      marker.create();
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
