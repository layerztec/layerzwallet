import { UTEXOWallet } from '@utexo/rgb-sdk';
import { describe, expect, it } from 'vitest';

import { proxyRgbFacade } from '../../modules/rgb-facade-proxy';

// A minimal engine the real facade accepts: every shared method plus two
// optional extensions. Each method reports whether `this` was the engine.
const SHARED = [
  'init', 'unlock', 'destroy', 'isDisposed', 'getNetwork', 'getNetworkInfo', 'getWalletIdentity', 'getBtcBalance', 'getAddress', 'listUnspents', 'createUtxos',
  'sendBtc', 'estimateFeeRate', 'listAssets', 'getAssetBalance', 'issueAssetNia', 'issueAssetIfa', 'inflate', 'blindReceive', 'witnessReceive', 'onchainReceive',
  'onchainSend', 'decodeRGBInvoice', 'failTransfers', 'listTransactions', 'listTransfers', 'listOnchainTransfers', 'refresh', 'refreshWallet', 'refreshTransfers', 'syncWallet',
]; // prettier-ignore
const EXTENSIONS = ['exportBackupToFile', 'getBfaCapabilities', 'burn'];

function makeFacade() {
  const engine: Record<string, unknown> = { contractVersion: '1', protocol: 'RGB_L1', capabilities: {} };
  for (const name of [...SHARED, ...EXTENSIONS]) {
    engine[name] = function (this: unknown) {
      return this === engine ? `engine:${name}` : 'WRONG THIS';
    };
  }
  return new UTEXOWallet({ engine: engine as never });
}

describe('proxyRgbFacade', () => {
  it('reads facade getters without tripping on its private engine field', () => {
    const proxied = proxyRgbFacade(makeFacade(), {}) as unknown as { protocol: string };
    expect(proxied.protocol).toBe('RGB_L1');
  });

  it('passes shared (prototype) methods through with the right receiver', async () => {
    const proxied = proxyRgbFacade(makeFacade(), {});
    expect(await proxied.getAddress()).toBe('engine:getAddress');
  });

  it('returns read-only engine extensions untouched (WebRGB getInfo and backup export use them)', async () => {
    const proxied = proxyRgbFacade(makeFacade(), {}) as unknown as { exportBackupToFile(p: object): Promise<string>; getBfaCapabilities(): Promise<string> };
    expect(await proxied.exportBackupToFile({})).toBe('engine:exportBackupToFile');
    expect(await proxied.getBfaCapabilities()).toBe('engine:getBfaCapabilities');
  });

  it('applies overrides, including names the facade does not have', async () => {
    const facade = makeFacade();
    const proxied = proxyRgbFacade(facade, {
      send: () => 'override:send',
      estimateFeeRate: async () => 7,
    });
    expect((proxied.send as unknown as () => string)()).toBe('override:send');
    expect(await proxied.estimateFeeRate(1)).toBe(7);
  });

  it('leaves extensions the engine lacks undefined, so callers can feature-detect', () => {
    const proxied = proxyRgbFacade(makeFacade(), {}) as unknown as { backupToVss?: unknown };
    expect(proxied.backupToVss).toBeUndefined();
  });
});
