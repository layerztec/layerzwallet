import assert from 'assert';
import { test } from 'vitest';
import { ArkWallet } from '../../class/wallets/ark-wallet';

test('ark', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    context.skip();
    return;
  }

  const w = new ArkWallet();
  w.setSecret(process.env.TEST_MNEMONIC);
  await w.init();

  const offchainBalance = await w.getOffchainBalance();
  assert.ok(offchainBalance >= 666);
  assert.strictEqual(await w.getOffchainBalanceForAddress((await w.getOffchainReceiveAddress())!), offchainBalance);
});
