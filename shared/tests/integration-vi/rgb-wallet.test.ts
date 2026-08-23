import assert from 'assert';
import { describe, test, beforeAll } from 'vitest';

import { RgbWallet } from '../../class/wallets/rgb-wallet';
import { NETWORK_RGB_TESTNET } from '../../types/networks';
import type { IRgbAdapter, IRgbAdapterCreateParams, IRgbWallet } from '../../types/rgb-adapter';

/**
 * Integration test for RgbWallet against the real testnet.
 *
 * This test is gated on two env vars:
 *   TEST_MNEMONIC          — any valid BIP39 seed (shared with other integration tests)
 *   RGB_INTEGRATION=1      — opt-in flag to actually install `@utexo/rgb-sdk` (Node)
 *                            and talk to VSS + the testnet indexer.
 *
 * The Node SDK is not a regular dependency of `ext` or `mobile` (it ships native
 * binaries), so we import it dynamically here and install a thin Node adapter on
 * `globalThis.rgbAdapter` for the duration of the test. This mirrors the SparkWallet
 * integration test's approach of relying on setupFiles to provision `globalThis`.
 */

const SHOULD_RUN = !!process.env.TEST_MNEMONIC && process.env.RGB_INTEGRATION === '1';
const INSTALL_HINT = 'RGB_INTEGRATION=1 requires the Node SDK. Run: `npm i -D @utexo/rgb-sdk@1.0.0-beta.8` in ext/ or mobile/ before running this test.';

async function installNodeAdapter(): Promise<boolean> {
  let rgb: any;
  try {
    // Dynamic import — the package is not a declared dependency (it ships native
    // binaries, pulling it into production would bloat the wallet bundle).
    // Contributors who opt in via RGB_INTEGRATION=1 are expected to install it
    // locally; see INSTALL_HINT above.
    rgb = await import(/* @vite-ignore */ '@utexo/rgb-sdk' as any);
  } catch (e) {
    console.warn(`RGB integration test cannot load @utexo/rgb-sdk — ${INSTALL_HINT}`);
    return false;
  }
  const { UTEXOWallet } = rgb;

  const adapter: IRgbAdapter = {
    capabilities: { lightning: false },
    async createWallet({ mnemonic, network, vssServerUrl }: IRgbAdapterCreateParams): Promise<IRgbWallet> {
      const wallet = new UTEXOWallet(mnemonic, {
        network,
        dataDir: `/tmp/rgb-integration-${network}-${Date.now()}`,
        vssServerUrl,
      });
      await wallet.initialize();
      return wallet as unknown as IRgbWallet;
    },
    async restoreFromVss({ mnemonic, network, vssServerUrl }: IRgbAdapterCreateParams): Promise<IRgbWallet> {
      const targetDir = `/tmp/rgb-integration-restore-${network}-${Date.now()}`;
      await rgb.restoreUtxoWalletFromVss({ mnemonic, targetDir, vssServerUrl });
      const wallet = new UTEXOWallet(mnemonic, { network, dataDir: targetDir, vssServerUrl });
      await wallet.initialize();
      return wallet as unknown as IRgbWallet;
    },
  };

  (globalThis as any).rgbAdapter = adapter;
  return true;
}

let adapterReady = false;

describe('RgbWallet integration (testnet)', () => {
  beforeAll(async () => {
    if (!SHOULD_RUN) return;
    adapterReady = await installNodeAdapter();
  });

  function maybeSkip(context: { skip: () => void }): boolean {
    if (!SHOULD_RUN) {
      console.warn('TEST_MNEMONIC or RGB_INTEGRATION not set, skipping');
      context.skip();
      return true;
    }
    if (!adapterReady) {
      console.warn(INSTALL_HINT);
      context.skip();
      return true;
    }
    return false;
  }

  test('creates a wallet and fetches a taproot receive address', async (context) => {
    if (maybeSkip(context)) return;

    const w = new RgbWallet(NETWORK_RGB_TESTNET);
    w.setSecret(process.env.TEST_MNEMONIC!);
    await w.init({} as any);

    const address = await w.getOffchainReceiveAddress();
    assert.ok(/^(bc1p|tb1p|bcrt1p)/i.test(address), `Expected taproot address, got: ${address}`);
  });

  test('getOffchainBalance and fetchTokenBalances run against testnet', async (context) => {
    if (maybeSkip(context)) return;

    const w = new RgbWallet(NETWORK_RGB_TESTNET);
    w.setSecret(process.env.TEST_MNEMONIC!);
    await w.init({} as any);

    const balance = await w.getOffchainBalance();
    assert.ok(typeof balance === 'number' && balance >= 0, `unexpected balance: ${balance}`);

    await w.fetchTokenBalances();
    const tokens = w.getTokenBalances();
    assert.ok(Array.isArray(tokens));
  });

  test('getCommonTransactions merges on-chain txs with RGB transfers', async (context) => {
    if (maybeSkip(context)) return;

    const w = new RgbWallet(NETWORK_RGB_TESTNET);
    w.setSecret(process.env.TEST_MNEMONIC!);
    await w.init({} as any);

    const txs = await w.getCommonTransactions();
    assert.ok(Array.isArray(txs));
    if (txs.length > 0) {
      assert.ok(typeof txs[0].timestamp === 'number');
      assert.ok(['confirmed', 'pending', 'failed', 'cancelled'].includes(txs[0].status ?? 'confirmed'));
    }
  });

  test('VSS restore-then-createWallet parity: same address from two fresh data dirs', async (context) => {
    if (maybeSkip(context)) return;

    const w1 = new RgbWallet(NETWORK_RGB_TESTNET);
    w1.setSecret(process.env.TEST_MNEMONIC!);
    await w1.init({} as any);
    const a1 = await w1.getOffchainReceiveAddress();

    const w2 = new RgbWallet(NETWORK_RGB_TESTNET);
    w2.setSecret(process.env.TEST_MNEMONIC!);
    await w2.init({} as any);
    const a2 = await w2.getOffchainReceiveAddress();

    assert.strictEqual(a1, a2, 'Deterministic address mismatch across adapter instances');
  });
});
