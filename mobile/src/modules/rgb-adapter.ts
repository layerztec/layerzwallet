import { UTEXOWallet } from '@utexo/rgb-sdk-rn';
import { Directory, Paths } from 'expo-file-system';

import type { IRgbAdapter, IRgbAdapterCreateParams, IRgbWallet } from '@shared/types/rgb-adapter';

const RGB_DATA_ROOT = 'rgb';

function dataDirFor(network: IRgbAdapterCreateParams['network']): string {
  const root = new Directory(Paths.document, RGB_DATA_ROOT, network);
  if (!root.exists) root.create({ intermediates: true });
  return root.uri.replace(/^file:\/\//, '');
}

class RgbAdapter implements IRgbAdapter {
  readonly capabilities = { lightning: false } as const;

  async createWallet({ mnemonic, network, vssServerUrl }: IRgbAdapterCreateParams): Promise<IRgbWallet> {
    const wallet = new UTEXOWallet(mnemonic, {
      network,
      dataDir: dataDirFor(network),
      vssServerUrl,
    });
    await wallet.initialize();
    return wallet;
  }

  async restoreFromVss({ mnemonic, network, vssServerUrl }: IRgbAdapterCreateParams): Promise<IRgbWallet> {
    await UTEXOWallet.restoreFromVss(mnemonic, dataDirFor(network), vssServerUrl ? { serverUrl: vssServerUrl } : undefined);
    return this.createWallet({ mnemonic, network, vssServerUrl });
  }
}

global.rgbAdapter = new RgbAdapter();
