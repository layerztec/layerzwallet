import { UTEXOWallet } from '@utexo/rgb-sdk';
import { isEngineError } from '@utexo/rgb-sdk-core';
import { RgbLibWeb } from '@utexo/rgb-sdk-web';

import type { IRgbAdapter, IRgbAdapterCreateParams, IRgbWallet } from '@shared/types/rgb-adapter';

type Wallet = UTEXOWallet<RgbLibWeb>;

/**
 * The shared wallet speaks the older `IRgbWallet` names; map the few that
 * differ on the `UTEXOWallet` facade, pass everything else through.
 *
 * VSS: the web engine configures cloud backup itself on `init()` (identity
 * derived from the mnemonic) and queues an upload after every mutation, so
 * the configure/disable calls have nothing left to do.
 */
function adapt(wallet: Wallet): IRgbWallet {
  return new Proxy(wallet as unknown as IRgbWallet, {
    get(target, prop, receiver) {
      switch (prop) {
        case 'send':
          return (params: Parameters<Wallet['onchainSend']>[0]) => wallet.onchainSend(params);
        case 'estimateFeeRate':
          return async (blocks: number) => (await wallet.estimateFeeRate(blocks)).feeRate;
        case 'vssBackup':
          return () => wallet.backupToVss();
        case 'vssBackupInfo':
          return () => wallet.getVssBackupInfo();
        case 'configureVssBackup':
        case 'disableVssAutoBackup':
          return async () => {};
        case 'getDefaultVssConfig':
          return async () => null;
        default: {
          const value = Reflect.get(target, prop, receiver);
          return typeof value === 'function' ? value.bind(target) : value;
        }
      }
    },
  });
}

// The engine keeps its state in IndexedDB under <masterFingerprint>/<network>,
// so wallets of different seeds don't collide and no per-seed path is needed.
async function open({ mnemonic, network, vssServerUrl }: IRgbAdapterCreateParams): Promise<Wallet> {
  const engine = new RgbLibWeb({ network: network === 'testnet' ? 'utexo' : 'mainnet', mnemonic, ...(vssServerUrl ? { vssUrl: vssServerUrl } : {}) });
  const wallet = new UTEXOWallet({ engine });
  await wallet.init();
  return wallet;
}

class RgbAdapter implements IRgbAdapter {
  readonly capabilities = { lightning: false } as const;

  async createWallet(params: IRgbAdapterCreateParams): Promise<IRgbWallet> {
    return adapt(await open(params));
  }

  /**
   * Open the wallet, pulling the cloud copy in when this browser has no local
   * RGB state yet. A wallet that already has local data is returned as is —
   * the engine refuses to overwrite it, and local state is the newer one.
   *
   * When there is nothing to restore this throws a "backup not found" error
   * rather than returning the empty wallet: the shared RgbWallet then decides
   * between "first creation" and "the backup vanished" (see its init()).
   */
  async restoreFromVss(params: IRgbAdapterCreateParams): Promise<IRgbWallet> {
    const wallet = await open(params);
    try {
      await wallet.restoreFromVss();
      return adapt(wallet);
    } catch (e) {
      if (isEngineError(e) && e.code === 'WALLET_INVALID_STATE') return adapt(wallet);
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
