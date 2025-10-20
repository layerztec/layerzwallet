import { test } from 'vitest';

import { StacksWallet } from '../../class/wallets/stacks-wallet';
import assert from 'assert';

test('stacks wallet can generate addresses for different accounts', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    console.warn('TEST_MNEMONIC not set, skipping');
    context.skip();
    return;
  }

  const w = new StacksWallet();
  w.setSecret(process.env.TEST_MNEMONIC);
  await w.init();

  w.setAccountNumber(0);
  assert.strictEqual(await w.getOffchainReceiveAddress(), 'SP2R874DNSDKVF0Z281M8H9A2CCNZ3HDH4W2DZNT6');

  w.setAccountNumber(1);
  assert.strictEqual(await w.getOffchainReceiveAddress(), 'SP1D6V3SQR6HRSBY19HVED0YQEX3QHGYT8YH60AGF');

  w.setAccountNumber(2);
  assert.strictEqual(await w.getOffchainReceiveAddress(), 'SP0C07Q6TRG3HAXJVG9GP630DPM483NZN7G94FZD');

  w.setAccountNumber(0);
  assert.strictEqual(await w.getOffchainReceiveAddress(), 'SP2R874DNSDKVF0Z281M8H9A2CCNZ3HDH4W2DZNT6');
});
