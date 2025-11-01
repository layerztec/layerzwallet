import { test } from 'vitest';

import { StacksWallet } from '../../class/wallets/stacks-wallet';
import assert from 'assert';

const storageMock = {
  async setItem(key: string, value: string) {},
  async getItem(key: string) {
    return '';
  },
};

test('stacks wallet can get balance', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    console.warn('TEST_MNEMONIC not set, skipping');
    context.skip();
    return;
  }

  const w = new StacksWallet();
  w.setSecret(process.env.TEST_MNEMONIC);
  await w.init(storageMock);

  const balance = await w.getOffchainBalance();

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
  await w.init(storageMock);
  w.setAccountNumber(1);

  const toAddress = await w.getOffchainReceiveAddress();
  w.setAccountNumber(0);

  const balance = await w.getOffchainBalance();
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
  await w.init(storageMock);

  await w.fetchTokenBalances();
  const tokens = w.getTokenBalances();

  assert.deepStrictEqual(tokens, [
    {
      id: 'STX',
      logoURI: 'https://static.tildacdn.net/tild6638-6331-4134-b936-386137393566/favicon_6.ico',
      balance: '99998716',
      name: 'STX',
      chainId: 0,
      symbol: 'STX',
      decimals: 6,
    },
  ]);
});

test('stacks wallet can get common txs', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    console.warn('TEST_MNEMONIC not set, skipping');
    context.skip();
    return;
  }

  const w = new StacksWallet();
  w.setSecret(process.env.TEST_MNEMONIC);
  await w.init(storageMock);

  const txs = await w.getCommonTransactions();
  assert.ok(txs.length > 0);
});
