import { encodeBech32mTokenIdentifier, encodeSparkAddress } from '@buildonspark/spark-sdk';
import { describe, it, vi, assert } from 'vitest';
import { SparkWallet } from '../../class/wallets/spark-wallet';

const ownIdentityPublicKey = '036b1448c1b77fea99943c36c4ebed2de121ad98349f249949a1c43817fe26c2e2';
const inboundIdentityPublicKey = '033421a67a60cc7cb51de4422fc35e6db05f20fd8f3f2769a2e7e7061d19da191e';
const outboundIdentityPublicKey = '023e33e2920326f64ea31058d44777442d97d7d5cbfcf54e3060bc1695e5261c93';
const ownSparkAddress = encodeSparkAddress({ identityPublicKey: ownIdentityPublicKey, network: 'MAINNET' });
const inboundSparkAddress = encodeSparkAddress({ identityPublicKey: inboundIdentityPublicKey, network: 'MAINNET' });
const outboundSparkAddress = encodeSparkAddress({ identityPublicKey: outboundIdentityPublicKey, network: 'MAINNET' });
const tokenIdentifierBytes = Uint8Array.from([1, 2, 3, 4]);
const tokenIdentifier = encodeBech32mTokenIdentifier({ tokenIdentifier: tokenIdentifierBytes, network: 'MAINNET' });
const mixedReceivePrevHash = Uint8Array.from([0x11]);
const sendPrevHash = Uint8Array.from([0x22]);
const receiveTokenHash = Uint8Array.from([0xa1]);
const mixedReceiveTokenHash = Uint8Array.from([0xa2]);
const sendTokenHash = Uint8Array.from([0xb2]);
const cachedSparkTokenMetadata = JSON.stringify({
  metadata: {
    tokenName: 'Historic Token',
    tokenTicker: 'HIST',
    decimals: 6,
    iconUrl: 'https://example.com/historic-token.png',
  },
});

const storageMock = {
  async setItem(key: string, value: string) {},
  async getItem(key: string) {
    return '';
  },
};

const tokenTransactions = [
  {
    tokenTransactionHash: receiveTokenHash,
    status: 2,
    tokenTransaction: {
      clientCreatedTimestamp: new Date('2025-08-21T09:20:00.000Z'),
      tokenOutputs: [{ ownerPublicKey: Uint8Array.from(Buffer.from(ownIdentityPublicKey, 'hex')), tokenIdentifier: tokenIdentifierBytes, tokenAmount: Uint8Array.from([0xf4]) }],
    },
  },
  {
    tokenTransactionHash: mixedReceiveTokenHash,
    status: 2,
    tokenTransaction: {
      clientCreatedTimestamp: new Date('2025-08-21T09:19:00.000Z'),
      tokenInputs: {
        $case: 'transferInput' as const,
        transferInput: {
          outputsToSpend: [{ prevTokenTransactionHash: mixedReceivePrevHash, prevTokenTransactionVout: 0 }],
        },
      },
      tokenOutputs: [
        { ownerPublicKey: Uint8Array.from(Buffer.from(ownIdentityPublicKey, 'hex')), tokenIdentifier: tokenIdentifierBytes, tokenAmount: Uint8Array.from([0x64]) },
        { ownerPublicKey: Uint8Array.from(Buffer.from(outboundIdentityPublicKey, 'hex')), tokenIdentifier: tokenIdentifierBytes, tokenAmount: Uint8Array.from([0x2c]) },
      ],
    },
  },
  {
    tokenTransactionHash: sendTokenHash,
    status: 2,
    tokenTransaction: {
      clientCreatedTimestamp: new Date('2025-08-21T09:18:00.000Z'),
      tokenInputs: {
        $case: 'transferInput' as const,
        transferInput: {
          outputsToSpend: [{ prevTokenTransactionHash: sendPrevHash, prevTokenTransactionVout: 0 }],
        },
      },
      tokenOutputs: [
        { ownerPublicKey: Uint8Array.from(Buffer.from(outboundIdentityPublicKey, 'hex')), tokenIdentifier: tokenIdentifierBytes, tokenAmount: Uint8Array.from([0x90]) },
        { ownerPublicKey: Uint8Array.from(Buffer.from(ownIdentityPublicKey, 'hex')), tokenIdentifier: tokenIdentifierBytes, tokenAmount: Uint8Array.from([0x64]) },
      ],
    },
  },
];

const previousTokenTransactions = new Map([
  [
    '11',
    {
      tokenTransactionHash: mixedReceivePrevHash,
      status: 2,
      tokenTransaction: {
        tokenOutputs: [{ ownerPublicKey: Uint8Array.from(Buffer.from(inboundIdentityPublicKey, 'hex')), tokenIdentifier: tokenIdentifierBytes, tokenAmount: Uint8Array.from([0xc8]) }],
      },
    },
  ],
  [
    '22',
    {
      tokenTransactionHash: sendPrevHash,
      status: 2,
      tokenTransaction: {
        tokenOutputs: [{ ownerPublicKey: Uint8Array.from(Buffer.from(ownIdentityPublicKey, 'hex')), tokenIdentifier: tokenIdentifierBytes, tokenAmount: Uint8Array.from([0xf4]) }],
      },
    },
  ],
]);

describe('Spark Wallet', () => {
  it('getCommonTransactions returns token history with direction and cached metadata', async () => {
    const wallet = new SparkWallet();
    (wallet as any)._storage = {
      async setItem() {},
      async getItem(key: string) {
        return key === `SPARK_TOKEN_METADATA-${tokenIdentifier}` ? cachedSparkTokenMetadata : '';
      },
    };

    (wallet as any)._sdkWallet = {
      getTransfers: vi.fn().mockResolvedValue({ transfers: [] }),
      getSparkAddress: vi.fn().mockResolvedValue(ownSparkAddress),
      getIdentityPublicKey: vi.fn().mockResolvedValue(ownIdentityPublicKey),
      queryTokenTransactionsWithFilters: vi.fn().mockResolvedValue({
        tokenTransactionsWithStatus: tokenTransactions,
        pageResponse: undefined,
      }),
      queryTokenTransactionsByTxHashes: vi.fn().mockImplementation((hashes: string[]) => ({
        tokenTransactionsWithStatus: hashes.map((hash) => previousTokenTransactions.get(hash)),
      })),
    };

    const result = await wallet.getCommonTransactions();

    assert.deepEqual(result, [
      {
        amount: undefined,
        counterparty: undefined,
        direction: 'receive',
        explorerUrl: 'https://sparkscan.io/tx/a1',
        network: 'spark',
        status: 'confirmed',
        timestamp: 1755768000,
        tokenTransfers: [
          {
            address: undefined,
            amount: 244,
            decimals: 6,
            logoURI: 'https://example.com/historic-token.png',
            name: 'Historic Token',
            symbol: 'HIST',
            tokenId: tokenIdentifier,
          },
        ],
        txid: 'a1',
      },
      {
        amount: undefined,
        counterparty: inboundSparkAddress,
        direction: 'receive',
        explorerUrl: 'https://sparkscan.io/tx/a2',
        network: 'spark',
        status: 'confirmed',
        timestamp: 1755767940,
        tokenTransfers: [
          {
            address: undefined,
            amount: 100,
            decimals: 6,
            logoURI: 'https://example.com/historic-token.png',
            name: 'Historic Token',
            symbol: 'HIST',
            tokenId: tokenIdentifier,
          },
        ],
        txid: 'a2',
      },
      {
        amount: undefined,
        counterparty: outboundSparkAddress,
        direction: 'send',
        explorerUrl: 'https://sparkscan.io/tx/b2',
        network: 'spark',
        status: 'confirmed',
        timestamp: 1755767880,
        tokenTransfers: [
          {
            address: outboundSparkAddress,
            amount: 144,
            decimals: 6,
            logoURI: 'https://example.com/historic-token.png',
            name: 'Historic Token',
            symbol: 'HIST',
            tokenId: tokenIdentifier,
          },
        ],
        txid: 'b2',
      },
    ]);

    const previousTransactionsMock = (wallet as any)._sdkWallet.queryTokenTransactionsByTxHashes as any;
    assert.deepEqual(previousTransactionsMock.mock.calls[0], [['11', '22']]);
  });

  it('can get offchain receive address (no account set)', async () => {
    const wallet = new SparkWallet();
    wallet.setSecret('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
    await wallet.init(storageMock);
    const address = await wallet.getOffchainReceiveAddress();
    assert.strictEqual(address, 'spark1pgss9qfk8ygtphqqzkj2yhn43k3s7r3g8z822ffvpcm38ym094800574x5numh');
  });

  it('can get offchain receive address (account 0)', async () => {
    const wallet = new SparkWallet();
    wallet.setSecret('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
    wallet.setAccountNumber(0);
    await wallet.init(storageMock);
    const address = await wallet.getOffchainReceiveAddress();
    assert.strictEqual(address, 'spark1pgss9qfk8ygtphqqzkj2yhn43k3s7r3g8z822ffvpcm38ym094800574x5numh');
  });

  it('can set account number', async () => {
    const addressesHashmap: Record<string, number> = {};
    for (let i = 0; i < 5; i++) {
      const wallet = new SparkWallet();
      wallet.setAccountNumber(i);
      wallet.setSecret('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
      await wallet.init(storageMock);

      addressesHashmap[await wallet.getOffchainReceiveAddress()] = i;
    }

    assert.strictEqual(Object.keys(addressesHashmap).length, 5, 'addressesHashmap: ' + JSON.stringify(addressesHashmap));
  });

  it('can validate Spark addresses', () => {
    const wallet = new SparkWallet();

    // Test valid Spark addresses
    assert.strictEqual(wallet.isAddressValid('spark1pgssx2srkm6344nxzngx9n8stj5uxp544dgm3mrdgpeulr8phutzdx89vlg5kf'), true);

    // Test invalid addresses
    assert.strictEqual(wallet.isAddressValid(''), false);
    assert.strictEqual(wallet.isAddressValid('invalid'), false);
    assert.strictEqual(wallet.isAddressValid('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'), false);
    assert.strictEqual(wallet.isAddressValid('0x742d35Cc6634C0532925a3b8D'), false);
    assert.strictEqual(wallet.isAddressValid('spark1invalid'), false);
    assert.strictEqual(wallet.isAddressValid('spark1'), false);
  });
});
