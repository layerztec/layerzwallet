import assert from 'assert';
import { test, vi } from 'vitest';
import { ArkTransaction, TxType } from '@arkade-os/sdk';

import { ArkadeWallet } from '../../class/wallets/arkade-wallet';
import { IStorage } from '../../types/IStorage';

const _cache: Record<string, string> = {};
const storageMock: IStorage = {
  async setItem(key: string, value: string) {
    _cache[key] = value;
  },

  async getItem(key: string) {
    return _cache[key];
  },
};

test('arkade mainnet can getCommonTransactions', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    console.warn('TEST_MNEMONIC not set, skipping');
    context.skip();
    return;
  }

  if (!(process.env.EXPO_PUBLIC_ARK_SERVER_URL && process.env.EXPO_PUBLIC_ARK_SERVER_PUBLIC_KEY && process.env.EXPO_PUBLIC_BOLTZ_API_URL)) {
    console.warn('env not set, skipping');
    context.skip();
    return;
  }

  const w = new ArkadeWallet();
  w.setSecret(process.env.TEST_MNEMONIC);
  w.setArkServerUrl(process.env.EXPO_PUBLIC_ARK_SERVER_URL);
  w.setArkServerPublicKey(process.env.EXPO_PUBLIC_ARK_SERVER_PUBLIC_KEY);
  w.setBoltzApiUrl(process.env.EXPO_PUBLIC_BOLTZ_API_URL);
  await w.init(storageMock);

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
      network: 'arkade',
      timestamp: 1756199879,
      txid: 'c08e5661587fa741aea8d4eb0be3b400aae75cee18b0e0afa70b9ba41d9ca3be',
    },
    {
      amount: 2100,
      direction: 'receive',
      network: 'arkade',
      timestamp: 1755786091,
      txid: '5a41fdc280352cab91fef62a1f407a0c8559ecffb2f85bea1970b72eaf4d6058',
    },
  ]);
});
