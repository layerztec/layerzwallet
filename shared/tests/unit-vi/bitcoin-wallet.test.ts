import { describe, it, vi, assert } from 'vitest';
import { AbstractHDElectrumWallet } from '../../class/wallets/abstract-hd-electrum-wallet';
import { NETWORK_BITCOIN } from '../../types/networks';
import { Transaction } from '../../class/wallets/types';

describe('Bitcoin Wallet - getCommonTransactions', () => {
  it('should return transactions in correct order', async () => {
    const wallet = new AbstractHDElectrumWallet();

    const fakeTransactions = [
      // incoming, confirmed
      {
        txid: 'tx1',
        received: 1234567890000,
        value: 100000000,
        confirmations: 5,
      },
      // outgoing, confirmed
      {
        txid: 'tx2',
        received: 1234567891000,
        value: -50000000,
        confirmations: 5,
      },
      // incoming, unconfirmed
      {
        txid: 'tx3',
        received: 1234567892000,
        value: 100000000,
        confirmations: 0,
      },
    ] as Transaction[];

    vi.spyOn(wallet, 'getTransactions').mockReturnValue(fakeTransactions);

    const result1 = await wallet.getCommonTransactions();

    assert.deepEqual(result1, [
      {
        txid: 'tx1',
        network: NETWORK_BITCOIN,
        timestamp: 1234567890,
        direction: 'receive',
        amount: 100000000,
        tokenTransfers: [],
        status: 'confirmed',
      },
      {
        txid: 'tx2',
        network: NETWORK_BITCOIN,
        timestamp: 1234567891,
        direction: 'send',
        amount: -50000000,
        tokenTransfers: [],
        status: 'confirmed',
      },
      {
        txid: 'tx3',
        network: NETWORK_BITCOIN,
        timestamp: 1234567892,
        direction: 'receive',
        amount: 100000000,
        tokenTransfers: [],
        status: 'pending',
      },
    ]);

    // filter by txid
    const result2 = await wallet.getCommonTransactions('tx2');

    assert.deepEqual(result2, [
      {
        txid: 'tx3',
        network: NETWORK_BITCOIN,
        timestamp: 1234567892,
        direction: 'receive',
        amount: 100000000,
        tokenTransfers: [],
        status: 'pending',
      },
    ]);
  });
});
