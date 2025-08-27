import assert from 'assert';
import { test, vi } from 'vitest';
import { ArkTransaction, TxType } from '@arkade-os/sdk';

import { ArkWallet } from '../../class/wallets/ark-wallet';

test('ArkWallet', async () => {
  const w = new ArkWallet();
  w.setSecret('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
  // acc number 0
  await w.init();

  const receive0 = await w.getOffchainReceiveAddress();
  assert.ok(receive0);

  w.setAccountNumber(1);
  await w.init();
  assert.ok(await w.getOffchainReceiveAddress());
  assert.ok(receive0 !== (await w.getOffchainReceiveAddress()));

  w.setAccountNumber(0);
  await w.init();

  assert.ok(receive0 === (await w.getOffchainReceiveAddress()));
});

test('ArkWallet - getCommonTransactions', async () => {
  const w = new ArkWallet();
  w.setSecret('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
  await w.init();

  const transfers: ArkTransaction[] = [
    {
      amount: 100,
      createdAt: 1756199879000,
      key: { arkTxid: 'c08e5661587fa741aea8d4eb0be3b400aae75cee18b0e0afa70b9ba41d9ca3be', boardingTxid: '', commitmentTxid: 'fdfe123c8d87e82c81d1e76141684f6e2041a85c5f2fe403982a7bca523f74ff' },
      settled: true,
      type: TxType.TxSent,
    },
    {
      amount: 2100,
      createdAt: 1755786091000,
      key: { arkTxid: '5a41fdc280352cab91fef62a1f407a0c8559ecffb2f85bea1970b72eaf4d6058', boardingTxid: '', commitmentTxid: '44b0e7852490eba4ec6d19fff042e0191078c6ce67b38f99e200632d5be1622a' },
      settled: true,
      type: TxType.TxReceived,
    },
  ];

  (w as any)._wallet = {
    getTransactionHistory: vi.fn().mockImplementation(() => {
      return transfers;
    }),
  };

  const transactions = await w.getCommonTransactions();
  assert.deepEqual(transactions, [
    {
      amount: 100,
      direction: 'send',
      network: 'ark_mutinynet',
      timestamp: 1756199879,
      txid: 'c08e5661587fa741aea8d4eb0be3b400aae75cee18b0e0afa70b9ba41d9ca3be',
    },
    {
      amount: 2100,
      direction: 'receive',
      network: 'ark_mutinynet',
      timestamp: 1755786091,
      txid: '5a41fdc280352cab91fef62a1f407a0c8559ecffb2f85bea1970b72eaf4d6058',
    },
  ]);
});
