import { describe, it, vi, assert } from 'vitest';
import { SparkWallet } from '../../class/wallets/spark-wallet';

type WalletTransferOrig = Awaited<ReturnType<NonNullable<SparkWallet['_sdkWallet']>['getTransfers']>>['transfers'][number];
type WalletTransfer = Omit<WalletTransferOrig, 'leaves' | 'userRequest'>;

// a couple of Lightning and regular transfers, leaves and userRequest are not relevant for the test
const transfers: WalletTransfer[] = [
  {
    id: '0198cc01-ee9a-7af1-b54c-b1fb836ad9a6',
    senderIdentityPublicKey: '033421a67a60cc7cb51de4422fc35e6db05f20fd8f3f2769a2e7e7061d19da191e',
    receiverIdentityPublicKey: '036b1448c1b77fea99943c36c4ebed2de121ad98349f249949a1c43817fe26c2e2',
    status: 'TRANSFER_STATUS_COMPLETED',
    totalValue: 20,
    expiryTime: new Date('1970-01-01T00:00:00.000Z'),
    createdTime: new Date('2025-08-21T09:42:17.512Z'),
    updatedTime: new Date('2025-08-21T09:42:29.578Z'),
    type: 'TRANSFER',
    transferDirection: 'INCOMING',
  },
  {
    id: '0198cc00-ff50-767a-8c21-bb258b4a903e',
    senderIdentityPublicKey: '036b1448c1b77fea99943c36c4ebed2de121ad98349f249949a1c43817fe26c2e2',
    receiverIdentityPublicKey: '033421a67a60cc7cb51de4422fc35e6db05f20fd8f3f2769a2e7e7061d19da191e',
    status: 'TRANSFER_STATUS_COMPLETED',
    totalValue: 20,
    expiryTime: new Date('1970-01-01T00:00:00.000Z'),
    createdTime: new Date('2025-08-21T09:41:16.531Z'),
    updatedTime: new Date('2025-08-21T09:41:25.587Z'),
    type: 'TRANSFER',
    transferDirection: 'OUTGOING',
  },
  {
    id: '0198cbfe-d2b4-7a29-869b-cbd58c78a7cb',
    senderIdentityPublicKey: '036b1448c1b77fea99943c36c4ebed2de121ad98349f249949a1c43817fe26c2e2',
    receiverIdentityPublicKey: '036b1448c1b77fea99943c36c4ebed2de121ad98349f249949a1c43817fe26c2e2',
    status: 'TRANSFER_STATUS_COMPLETED',
    totalValue: 10,
    expiryTime: new Date('1970-01-01T00:00:00.000Z'),
    createdTime: new Date('2025-08-21T09:38:53.885Z'),
    updatedTime: new Date('2025-08-21T09:38:57.071Z'),
    type: 'TRANSFER',
    transferDirection: 'INCOMING',
  },
  {
    id: '0198cbfc-66c1-76ed-8196-2e21576fcb00',
    senderIdentityPublicKey: '036b1448c1b77fea99943c36c4ebed2de121ad98349f249949a1c43817fe26c2e2',
    receiverIdentityPublicKey: '023e33e2920326f64ea31058d44777442d97d7d5cbfcf54e3060bc1695e5261c93',
    status: 'TRANSFER_STATUS_COMPLETED',
    totalValue: 51,
    expiryTime: new Date('2025-08-21T09:38:12.993Z'),
    createdTime: new Date('2025-08-21T09:36:13.263Z'),
    updatedTime: new Date('2025-08-21T09:36:22.735Z'),
    type: 'PREIMAGE_SWAP',
    transferDirection: 'OUTGOING',
  },
  {
    id: '0198cbfa-9b0b-774c-8426-a6951af9177d',
    senderIdentityPublicKey: '023e33e2920326f64ea31058d44777442d97d7d5cbfcf54e3060bc1695e5261c93',
    receiverIdentityPublicKey: '036b1448c1b77fea99943c36c4ebed2de121ad98349f249949a1c43817fe26c2e2',
    status: 'TRANSFER_STATUS_COMPLETED',
    totalValue: 100,
    expiryTime: new Date('1970-01-01T00:00:00.000Z'),
    createdTime: new Date('2025-08-21T09:34:15.335Z'),
    updatedTime: new Date('2025-08-21T09:34:26.042Z'),
    type: 'PREIMAGE_SWAP',
    transferDirection: 'INCOMING',
  },
];

describe('Spark Wallet', () => {
  it('getCommonTransactions - should return transactions', async () => {
    const wallet = new SparkWallet();

    (wallet as any)._sdkWallet = {
      getTransfers: vi.fn().mockImplementation((limit: number, offset: number) => {
        return {
          transfers: transfers.slice(offset, offset + limit),
        };
      }),
    };

    const result = await wallet.getCommonTransactions();

    assert.deepEqual(result, [
      {
        amount: 20,
        direction: 'receive',
        network: 'spark',
        timestamp: 1755769349,
        status: 'confirmed',
        txid: '0198cc01-ee9a-7af1-b54c-b1fb836ad9a6',
      },
      {
        amount: 20,
        direction: 'send',
        network: 'spark',
        timestamp: 1755769285,
        status: 'confirmed',
        txid: '0198cc00-ff50-767a-8c21-bb258b4a903e',
      },
      {
        amount: 10,
        direction: 'receive',
        network: 'spark',
        timestamp: 1755769137,
        status: 'confirmed',
        txid: '0198cbfe-d2b4-7a29-869b-cbd58c78a7cb',
      },
      {
        amount: 51,
        direction: 'send',
        network: 'spark',
        timestamp: 1755768982,
        status: 'confirmed',
        txid: '0198cbfc-66c1-76ed-8196-2e21576fcb00',
      },
      {
        amount: 100,
        direction: 'receive',
        network: 'spark',
        timestamp: 1755768866,
        status: 'confirmed',
        txid: '0198cbfa-9b0b-774c-8426-a6951af9177d',
      },
    ]);

    const getTransfersMock = (wallet as any)._sdkWallet.getTransfers as any;
    const calls = getTransfersMock.mock.calls;
    assert.strictEqual(calls.length, 2);
    assert.deepEqual(calls[0], [100, 0]);
    assert.deepEqual(calls[1], [100, 100]);
  });

  it('can get offchain receive address (no account set)', async () => {
    const wallet = new SparkWallet();
    wallet.setSecret('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
    await wallet.init();
    const address = await wallet.getOffchainReceiveAddress();
    assert.strictEqual(address, 'spark1pgss9qfk8ygtphqqzkj2yhn43k3s7r3g8z822ffvpcm38ym094800574x5numh');
  });

  it('can get offchain receive address (account 0)', async () => {
    const wallet = new SparkWallet();
    wallet.setSecret('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
    wallet.setAccountNumber(0);
    await wallet.init();
    const address = await wallet.getOffchainReceiveAddress();
    assert.strictEqual(address, 'spark1pgss9qfk8ygtphqqzkj2yhn43k3s7r3g8z822ffvpcm38ym094800574x5numh');
  });

  it('can set account number', async () => {
    const addressesHashmap: Record<string, number> = {};
    for (let i = 0; i < 5; i++) {
      const wallet = new SparkWallet();
      wallet.setAccountNumber(i);
      wallet.setSecret('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
      await wallet.init();

      addressesHashmap[await wallet.getOffchainReceiveAddress()] = i;
    }

    assert.strictEqual(Object.keys(addressesHashmap).length, 5, 'addressesHashmap: ' + JSON.stringify(addressesHashmap));
  });
});
