import { UTEXOWallet, restoreUtxoWalletFromVss } from '@utexo/rgb-sdk-web';

import type { IRgbAdapter, IRgbAdapterCreateParams, IRgbWallet } from '@shared/types/rgb-adapter';

// The web SDK persists wallet state in IndexedDB, which is scoped per-origin
// by the browser — so a per-mnemonic subdirectory (as the mobile adapter uses)
// isn't needed here. Switching mnemonic requires clearing the IndexedDB store
// via the SDK's own dispose/restore flow, not a filesystem path trick.
class RgbAdapter implements IRgbAdapter {
  readonly capabilities = { lightning: false } as const;

  async createWallet({ mnemonic, network, vssServerUrl }: IRgbAdapterCreateParams): Promise<IRgbWallet> {
    const wallet = new UTEXOWallet(mnemonic, { network, vssServerUrl });
    await wallet.initialize();
    return wallet;
  }

  async restoreFromVss({ mnemonic, network, vssServerUrl }: IRgbAdapterCreateParams): Promise<IRgbWallet> {
    await restoreUtxoWalletFromVss({ mnemonic, networkPreset: network, vssServerUrl });
    return this.createWallet({ mnemonic, network, vssServerUrl });
  }
}

globalThis.rgbAdapter = new RgbAdapter();
