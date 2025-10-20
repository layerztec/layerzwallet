import { test } from 'vitest';

import { StacksWallet } from '../../class/wallets/stacks-wallet';
import assert from 'assert';

test.only('stacks wallet can get balance', async (context) => {
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
      id: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token::sbtc-token',
      balance: '60000',
      chainId: 0,
      name: 'sbtc',
      decimals: 8,
      symbol: 'sbtc',
    },
    {
      id: 'STX',
      balance: '100000100',
      name: 'STX',
      chainId: 0,
      symbol: 'STX',
      decimals: 8,
    },
  ]);
});
