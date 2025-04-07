import assert from 'assert';
import { test } from 'vitest';
import { ArkWallet } from '../../class/wallets/ark-wallet';

test('ark', async () => {
  if (!process.env.TEST_MNEMONIC) {
    console.warn('skipped because TEST_MNEMONIC env var is not set');
    return;
  }

  const w = new ArkWallet();
  w.setSecret(process.env.TEST_MNEMONIC);
  w.init();

  assert.strictEqual(await w.getOffchainBalance(), 666);
  assert.strictEqual(await w.getOffchainBalanceForAddress(w.getOffchainReceiveAddress()!), 666);
});
