import { UTEXOWallet } from '@utexo/rgb-sdk';
import { isEngineError } from '@utexo/rgb-sdk-core';
import { RgbLibWeb } from '@utexo/rgb-sdk-web';

import { rgbBackupPassword } from '@shared/modules/rgb-backup-password';
import { proxyRgbFacade } from '@shared/modules/rgb-facade-proxy';
import type { IRgbAdapter, IRgbAdapterCreateParams, IRgbWallet, RgbNetwork } from '@shared/types/rgb-adapter';

type Wallet = UTEXOWallet<RgbLibWeb>;

/**
 * Cloud backup (VSS) server. `null` = off.
 *
 * The web engine supports VSS, but its built-in default
 * (`vss-server.utexo.com`) was retired together with the RLN stack (NXDOMAIN
 * since 2026-11) and UTEXO has not published a replacement yet. With VSS left
 * on, the first restore attempt fails on the network and the wallet never
 * opens — so it stays off until there is a server to point at. Set the URL
 * here and the real backup/restore paths below take over.
 */
const RGB_VSS_URL: string | null = null;

function vssUnavailableError(): Error {
  const e = new Error('Cloud backup is not available: no VSS server is configured for this build');
  e.name = 'VssUnavailable';
  return e;
}

/**
 * The shared wallet speaks the older `IRgbWallet` names; map the few that
 * differ on the `UTEXOWallet` facade, pass everything else through.
 *
 * With VSS on, the engine configures cloud backup itself on `init()`
 * (identity derived from the mnemonic) and queues an upload after every
 * mutation, so the configure/disable calls have nothing left to do.
 */
function adapt(wallet: Wallet, vssOn: boolean): IRgbWallet {
  return proxyRgbFacade(wallet, {
    send: (params: Parameters<Wallet['onchainSend']>[0]) => wallet.onchainSend(params),
    estimateFeeRate: async (blocks: number) => (await wallet.estimateFeeRate(blocks)).feeRate,
    vssBackup: async () => {
      if (!vssOn) throw vssUnavailableError();
      return wallet.backupToVss();
    },
    vssBackupInfo: async () => (vssOn ? wallet.getVssBackupInfo() : { backupExists: false, backupRequired: false, serverVersion: null }),
    configureVssBackup: async () => {},
    disableVssAutoBackup: async () => {},
    getDefaultVssConfig: async () => null,
  });
}

const vssUrlFor = (params: IRgbAdapterCreateParams) => params.vssServerUrl ?? RGB_VSS_URL;

// The engine keeps its state in IndexedDB under <masterFingerprint>/<network>,
// so wallets of different seeds don't collide and no per-seed path is needed.
async function open(params: IRgbAdapterCreateParams): Promise<Wallet> {
  const engine = new RgbLibWeb({ network: params.network === 'testnet' ? 'utexo' : 'mainnet', mnemonic: params.mnemonic, vssUrl: vssUrlFor(params) });
  const wallet = new UTEXOWallet({ engine });
  await wallet.init();
  return wallet;
}

class RgbAdapter implements IRgbAdapter {
  readonly capabilities = { lightning: false } as const;

  async createWallet(params: IRgbAdapterCreateParams): Promise<IRgbWallet> {
    return adapt(await open(params), vssUrlFor(params) !== null);
  }

  /**
   * Open the wallet, pulling the cloud copy in when this browser has no local
   * RGB state yet. A wallet that already has local data is returned as is —
   * the engine refuses to overwrite it, and local state is the newer one.
   *
   * When there is nothing to restore this throws a "backup not found" error
   * rather than returning the empty wallet: the shared RgbWallet then decides
   * between "first creation" and "the backup vanished" (see its init()).
   *
   * Without a VSS server there is nothing to restore from: same as create.
   */
  async restoreFromVss(params: IRgbAdapterCreateParams): Promise<IRgbWallet> {
    if (vssUrlFor(params) === null) return this.createWallet(params);
    const wallet = await open(params);
    try {
      await wallet.restoreFromVss();
      return adapt(wallet, true);
    } catch (e) {
      if (isEngineError(e) && e.code === 'WALLET_INVALID_STATE') return adapt(wallet, true);
      let missing = false;
      try {
        missing = !(await wallet.getVssBackupInfo()).backupExists;
      } catch {
        // Server unreachable: surface the original restore error below.
      }
      await wallet.dispose().catch(() => {});
      if (missing) throw Object.assign(new Error('VSS backup not found'), { code: 'VssBackupNotFound' });
      throw e;
    }
  }
}

/**
 * Encrypted copy of the wallet's whole RGB state, for the user to keep as a
 * file. With the seed it is the only way to get RGB assets back while there is
 * no cloud backup. `sdk` is the open wallet (`RgbWallet.getSdk()`).
 */
export async function exportRgbBackup(sdk: IRgbWallet, mnemonic: string, network: RgbNetwork): Promise<Uint8Array> {
  return (sdk as unknown as Wallet).exportBackup({ password: rgbBackupPassword(mnemonic, network) });
}

/**
 * Replace the local RGB state with a backup file made for the SAME seed and
 * network (by this extension or by the mobile app). The current state is kept
 * in memory and put back if the file does not restore. Caller must reload the
 * popup afterwards: `sdk` is disposed here.
 */
export async function importRgbBackup(sdk: IRgbWallet, mnemonic: string, network: RgbNetwork, bytes: Uint8Array): Promise<void> {
  const password = rgbBackupPassword(mnemonic, network);
  const previous = await (sdk as unknown as Wallet).exportBackup({ password });
  await sdk.dispose();

  // The engine restores only between init() and the first connection, so each
  // attempt gets its own short-lived instance.
  const restore = async (data: Uint8Array) => {
    const wallet = await open({ mnemonic, network });
    try {
      await wallet.restoreBackup({ bytes: data, password, overwrite: true });
    } finally {
      await wallet.dispose().catch(() => {});
    }
  };

  try {
    await restore(bytes);
  } catch (e) {
    await restore(previous).catch(() => {});
    throw e;
  }
}

globalThis.rgbAdapter = new RgbAdapter();
