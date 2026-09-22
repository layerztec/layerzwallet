import { UTEXOWallet, restoreUtxoWalletFromVss } from '@utexo/rgb-sdk-web';
import { DEFAULT_VSS_SERVER_URL, buildVssConfigFromMnemonic } from '@utexo/rgb-sdk-core';

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
    // beta.9 gap: `initialize()` never configures the wasm VSS client, and the
    // web binding's `vssBackup(_config)` DISCARDS the per-call config the core
    // resolves — so without this explicit configure every `vssBackup` call
    // fails and nothing ever replicates. `configureVssBackup` is the one path
    // that reaches the wasm side with serverUrl/storeId/signingKey intact.
    const cfg = await buildVssConfigFromMnemonic(mnemonic.trim(), vssServerUrl ?? DEFAULT_VSS_SERVER_URL, network);
    await wallet.configureVssBackup(cfg);
    return wallet;
  }

  async restoreFromVss({ mnemonic, network, vssServerUrl }: IRgbAdapterCreateParams): Promise<IRgbWallet> {
    await restoreUtxoWalletFromVss({ mnemonic, networkPreset: network, vssServerUrl });
    return this.createWallet({ mnemonic, network, vssServerUrl });
  }
}

globalThis.rgbAdapter = new RgbAdapter();
