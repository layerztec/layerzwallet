import { UTEXOWallet } from '@utexo/rgb-sdk';
import { isEngineError } from '@utexo/rgb-sdk-core';
import { RgbLibWeb } from '@utexo/rgb-sdk-web';

import type { IRgbAdapter, IRgbAdapterCreateParams, IRgbWallet } from '@shared/types/rgb-adapter';

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
  return new Proxy(wallet as unknown as IRgbWallet, {
    get(target, prop) {
      switch (prop) {
        case 'send':
          return (params: Parameters<Wallet['onchainSend']>[0]) => wallet.onchainSend(params);
        case 'estimateFeeRate':
          return async (blocks: number) => (await wallet.estimateFeeRate(blocks)).feeRate;
        case 'vssBackup':
          return async () => {
            if (!vssOn) throw vssUnavailableError();
            return wallet.backupToVss();
          };
        case 'vssBackupInfo':
          return async () => (vssOn ? wallet.getVssBackupInfo() : { backupExists: false, backupRequired: false, serverVersion: null });
        case 'configureVssBackup':
        case 'disableVssAutoBackup':
          return async () => {};
        case 'getDefaultVssConfig':
          return async () => null;
        default: {
          // Read on the real wallet, not the proxy: the facade keeps its engine
          // in a #private field, so a getter (`protocol`, `capabilities`) run
          // with `this` = proxy throws a TypeError.
          const value = Reflect.get(target, prop, target);
          return typeof value === 'function' ? value.bind(target) : value;
        }
      }
    },
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

globalThis.rgbAdapter = new RgbAdapter();
