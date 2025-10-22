import { test } from 'vitest';

import { StacksWallet } from '../../class/wallets/stacks-wallet';
import assert from 'assert';

test('stacks wallet can get balance', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    console.warn('TEST_MNEMONIC not set, skipping');
    context.skip();
    return;
  }

  const w = new StacksWallet();
  w.setSecret(process.env.TEST_MNEMONIC);
  await w.init();

  const balance = await w.getBalance();

  assert(+balance > 0, `unexpected balance: ${balance}`);
});

test.skip('stacks send', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    console.warn('TEST_MNEMONIC not set, skipping');
    context.skip();
    return;
  }

  const w = new StacksWallet();
  w.setSecret(process.env.TEST_MNEMONIC);
  await w.init();
  w.setAccountNumber(1);

  const toAddress = await w.getOffchainReceiveAddress();
  w.setAccountNumber(0);

  const balance = await w.getBalance();
  await w.fetchTokenBalances();

  await w.pay(toAddress, 100);

  assert(+balance > 0, `unexpected balance: ${balance}`);
});

test('stacks wallet can get tokens', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    console.warn('TEST_MNEMONIC not set, skipping');
    context.skip();
    return;
  }

  const w = new StacksWallet();
  w.setSecret(process.env.TEST_MNEMONIC);
  await w.init();

  await w.fetchTokenBalances();
  const tokens = w.getTokenBalances();

  assert.deepStrictEqual(tokens, [
    {
      id: 'STX',
      balance: '99998716',
      name: 'STX',
      chainId: 0,
      symbol: 'STX',
      decimals: 6,
    },
  ]);
});
