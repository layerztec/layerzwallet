import assert from 'assert';
import { beforeEach, describe, expect, it, test, vi } from 'vitest';
import { ArkTransaction, TxType } from '@arkade-os/sdk';

import { ArkWallet } from '../../class/wallets/ark-wallet';
import { IStorage } from '../../types/IStorage';
import { NETWORK_ARK } from '../../types/networks';
import { DeepPartial } from '../../class/wallets/types';

const _cache: Record<string, string> = {};
const storageMock: IStorage = {
  async setItem(key: string, value: string) {
    _cache[key] = value;
  },

  async getItem(key: string) {
    return _cache[key];
  },
};

test('ark mainnet can getCommonTransactions', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    console.warn('TEST_MNEMONIC not set, skipping');
    context.skip();
    return;
  }

  const w = new ArkWallet();
  w.setSecret(process.env.TEST_MNEMONIC);
  w.setArkServerUrl('https://arkade.computer');
  w.setArkServerPublicKey('022b74c2011af089c849383ee527c72325de52df6a788428b68d49e9174053aaba');
  w.setBoltzApiUrl('https://api.ark.boltz.exchange');
  await w.init(storageMock);

  const transfers: DeepPartial<ArkTransaction>[] = [
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
      return transfers as ArkTransaction[];
    }),
  };

  const transactions = await w.getCommonTransactions();
  assert.deepEqual(transactions, [
    {
      amount: 100,
      direction: 'send',
      network: NETWORK_ARK,
      timestamp: 1756199879,
      tokenTransfers: [],
      txid: 'c08e5661587fa741aea8d4eb0be3b400aae75cee18b0e0afa70b9ba41d9ca3be',
      status: 'confirmed',
      confirmations: 1,
    },
    {
      amount: 2100,
      direction: 'receive',
      network: NETWORK_ARK,
      timestamp: 1755786091,
      tokenTransfers: [],
      txid: '5a41fdc280352cab91fef62a1f407a0c8559ecffb2f85bea1970b72eaf4d6058',
      status: 'confirmed',
      confirmations: 1,
    },
  ]);
});

describe('ArkWallet getSendQuote / executeSendQuote', () => {
  const TO = 'ark1recipientaddress';
  const TOKEN_ID = 'tokenAssetId';
  const TXID = 'arktxid0001';

  const createWallet = (): ArkWallet => {
    const w = new ArkWallet();
    (w as any)._wallet = {
      send: vi.fn().mockResolvedValue(TXID),
    };
    return w;
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('native send: returns fee=0, feeTicker=BTC, feeDecimals=8, and execute calls _wallet.send with amount', async () => {
    const w = createWallet();

    const quote = await w.getSendQuote({ toAddress: TO, amount: '1000' });

    expect(quote.fee).toBe('0');
    expect(quote.feeTicker).toBe('BTC');
    expect(quote.feeDecimals).toBe(8);
    expect(quote.request.toAddress).toBe(TO);
    expect(quote.request.amount).toBe('1000');

    const txid = await w.executeSendQuote(quote);
    expect(txid).toBe(TXID);
    expect((w as any)._wallet.send).toHaveBeenCalledWith({ address: TO, amount: 1000 });
  });

  it('token send: checks cached balance and execute calls _wallet.send with assets[]', async () => {
    const w = createWallet();
    (w as any)._arkTokenBalances = [{ id: TOKEN_ID, symbol: 'TKN', balance: '5000' }];

    const quote = await w.getSendQuote({ toAddress: TO, amount: '1000', tokenId: TOKEN_ID });
    expect(quote.fee).toBe('0');

    const txid = await w.executeSendQuote(quote);
    expect(txid).toBe(TXID);
    expect((w as any)._wallet.send).toHaveBeenCalledWith({
      address: TO,
      assets: [{ assetId: TOKEN_ID, amount: 1000 }],
    });
  });

  it('token send: throws if token balance unavailable', async () => {
    const w = createWallet();
    (w as any)._arkTokenBalances = [];

    await expect(w.getSendQuote({ toAddress: TO, amount: '1000', tokenId: TOKEN_ID })).rejects.toThrow(/token balance is unavailable/);
  });

  it('token send: throws if insufficient balance', async () => {
    const w = createWallet();
    (w as any)._arkTokenBalances = [{ id: TOKEN_ID, symbol: 'TKN', balance: '500' }];

    await expect(w.getSendQuote({ toAddress: TO, amount: '1000', tokenId: TOKEN_ID })).rejects.toThrow(/Insufficient TKN balance/);
  });

  it('throws if wallet not initialized', async () => {
    const w = new ArkWallet();
    await expect(w.getSendQuote({ toAddress: TO, amount: '1000' })).rejects.toThrow(/not initialized/);
  });

  it('throws on non-positive amount', async () => {
    const w = createWallet();
    await expect(w.getSendQuote({ toAddress: TO, amount: '0' })).rejects.toThrow(/amount must be positive/);
  });

  it('throws when native amount exceeds MAX_SAFE_INTEGER', async () => {
    const w = createWallet();
    const overflow = String(BigInt(Number.MAX_SAFE_INTEGER) + 1n);
    await expect(w.getSendQuote({ toAddress: TO, amount: overflow })).rejects.toThrow(/Amount too large/);
  });
});
