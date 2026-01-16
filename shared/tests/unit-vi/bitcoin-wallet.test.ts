import { describe, it, vi, assert } from 'vitest';
import { AbstractHDElectrumWallet } from '../../class/wallets/abstract-hd-electrum-wallet';
import { NETWORK_BITCOIN } from '../../types/networks';
import { Transaction, DeepPartial } from '../../class/wallets/types';

describe('Bitcoin Wallet - getCommonTransactions', () => {
  it('should return transactions in correct order', async () => {
    const wallet = new AbstractHDElectrumWallet();

    const unknownAddress = 'unknownAddress';
    const ownedExternalAddress = 'ownedExternalAddress';
    const ownedChangeAddress = 'ownedChangeAddress';

    // Mock wallet address methods
    wallet.next_free_address_index = 1;
    wallet.next_free_change_address_index = 1;
    vi.spyOn(wallet, '_getExternalAddressByIndex').mockImplementation((index: number) => {
      if (index === 0) return ownedExternalAddress;
      return `bc1qexternal${index}`;
    });
    vi.spyOn(wallet, '_getInternalAddressByIndex').mockImplementation((index: number) => {
      if (index === 0) return ownedChangeAddress;
      return `bc1qchange${index}`;
    });
    vi.spyOn(wallet, 'addressIsChange').mockImplementation((address: string) => {
      return address === ownedChangeAddress;
    });
    vi.spyOn(wallet, 'weOwnAddress').mockImplementation((address: string) => {
      return address === ownedExternalAddress || address === ownedChangeAddress;
    });
    vi.spyOn(wallet, 'getAddress').mockReturnValue(false);

    const fakeTransactions: DeepPartial<Transaction>[] = [
      // incoming with unknown address in inputs, confirmed
      {
        txid: 'tx1',
        timestamp: 1234567890,
        value: 100000000,
        confirmations: 5,
        inputs: [
          {
            txid: 'prev_tx1',
            vout: 0,
            scriptSig: { asm: '', hex: '' },
            txinwitness: [],
            sequence: 0,
            address: unknownAddress,
          },
        ],
      },
      // outgoing with unknown address, confirmed
      {
        txid: 'tx2',
        timestamp: 1234567891,
        value: -50000000,
        confirmations: 5,
        outputs: [
          {
            scriptPubKey: {
              addresses: [unknownAddress],
            },
          },
        ],
      },
      // outgoing with unknown and change address, confirmed
      {
        txid: 'tx3',
        timestamp: 1234567892,
        value: -30000000,
        confirmations: 5,
        outputs: [
          {
            scriptPubKey: {
              addresses: [unknownAddress],
            },
          },
          {
            scriptPubKey: {
              addresses: [ownedChangeAddress],
            },
          },
        ],
      },
      // incoming with multiple inputs (one unknown, one owned), unconfirmed
      {
        txid: 'tx4',
        timestamp: 1234567893,
        value: 100000000,
        confirmations: 0,
        inputs: [
          {
            txid: 'prev_tx4_1',
            vout: 0,
            scriptSig: { asm: '', hex: '' },
            txinwitness: [],
            sequence: 0,
            address: ownedExternalAddress,
          },
          {
            txid: 'prev_tx4_2',
            vout: 0,
            scriptSig: { asm: '', hex: '' },
            txinwitness: [],
            sequence: 0,
            address: unknownAddress,
          },
        ],
      },
    ];

    vi.spyOn(wallet, 'getTransactions').mockReturnValue(fakeTransactions as Transaction[]);

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
        explorerUrl: 'https://layerz.mempool.space/tx/tx1',
        counterparty: unknownAddress,
      },
      {
        txid: 'tx2',
        network: NETWORK_BITCOIN,
        timestamp: 1234567891,
        direction: 'send',
        amount: -50000000,
        tokenTransfers: [],
        status: 'confirmed',
        explorerUrl: 'https://layerz.mempool.space/tx/tx2',
        counterparty: unknownAddress,
      },
      {
        txid: 'tx3',
        network: NETWORK_BITCOIN,
        timestamp: 1234567892,
        direction: 'send',
        amount: -30000000,
        tokenTransfers: [],
        status: 'confirmed',
        explorerUrl: 'https://layerz.mempool.space/tx/tx3',
        counterparty: unknownAddress,
      },
      {
        txid: 'tx4',
        network: NETWORK_BITCOIN,
        timestamp: 1234567893,
        direction: 'receive',
        amount: 100000000,
        tokenTransfers: [],
        status: 'pending',
        explorerUrl: 'https://layerz.mempool.space/tx/tx4',
        counterparty: unknownAddress,
      },
    ]);

    // filter by txid - returns transactions after tx2
    const result2 = await wallet.getCommonTransactions('tx2');

    assert.deepEqual(result2, [
      {
        txid: 'tx3',
        network: NETWORK_BITCOIN,
        timestamp: 1234567892,
        direction: 'send',
        amount: -30000000,
        tokenTransfers: [],
        status: 'confirmed',
        explorerUrl: 'https://layerz.mempool.space/tx/tx3',
        counterparty: unknownAddress,
      },
    ]);
  });
});
