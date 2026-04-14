import { UTEXOWallet, restoreUtxoWalletFromVss } from '@utexo/rgb-sdk-web';

import type { IRgbAdapter, IRgbAdapterCreateParams, IRgbWallet } from '@shared/types/rgb-adapter';

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
