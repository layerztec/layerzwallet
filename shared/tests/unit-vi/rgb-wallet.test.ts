import { describe, expect, it, vi, assert, beforeAll } from 'vitest';

import { RGBWallet, IRGBAdapter, RGBConnection } from '../../class/wallets/rgb-wallet';
import type { ListAssetsResponseCustom, RgbTransferCustom, TransactionCustom } from '../../class/wallets/rgb-types';
import type { DeepPartial } from '../../class/wallets/types';
import { NETWORK_RGB_TESTNET } from '../../types/networks';
import type { BtcBalance, GeneratedKeys, InvoiceReceiveData, SendResult } from '@utexo/rgb-sdk';

const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

/**
 * Create a mock adapter for testing
 */
function createMockAdapter(overrides: Partial<IRGBAdapter['api']> = {}): IRGBAdapter {
  const defaultApi: IRGBAdapter['api'] = {
    registerWallet: vi.fn().mockResolvedValue({ address: 'tb1ptest', btcBalance: { vanilla: { settled: 0, future: 0, spendable: 0 }, colored: { settled: 0, future: 0, spendable: 0 } } }),
    refreshWallet: vi.fn().mockResolvedValue(undefined),
    getBtcBalance: vi.fn().mockResolvedValue({ vanilla: { settled: 0, future: 0, spendable: 0 }, colored: { settled: 0, future: 0, spendable: 0 } }),
    getAddress: vi.fn().mockResolvedValue('tb1ptest'),
    listUnspents: vi.fn().mockResolvedValue([]),
    listAssets: vi.fn().mockResolvedValue({ nia: [], uda: [], cfa: [] }),
    sendBtcBegin: vi.fn().mockResolvedValue('psbt'),
    sendBtcEnd: vi.fn().mockResolvedValue('txid'),
    sendBegin: vi.fn().mockResolvedValue('psbt'),
    sendEnd: vi.fn().mockResolvedValue({ txid: 'txid', batchTransferIdx: 0 }),
    createUtxos: vi.fn().mockResolvedValue(5),
    blindReceive: vi.fn().mockResolvedValue({ invoice: 'rgb:invoice', recipientId: 'recipient', expirationTimestamp: 0, batchTransferIdx: 0 }),
    decodeRGBInvoice: vi.fn().mockResolvedValue({ recipientId: 'recipient', network: 'testnet', assignment: {}, transportEndpoints: [] }),
    listTransactions: vi.fn().mockResolvedValue([]),
    listTransfers: vi.fn().mockResolvedValue([]),
    signPsbt: vi.fn().mockResolvedValue('signed_psbt'),
    createBackup: vi.fn().mockResolvedValue({ backupPath: '/tmp/backup.rgbbackup' }),
    ...overrides,
  };

  return {
    api: defaultApi,
    deriveKeysFromMnemonic: vi.fn().mockResolvedValue({
      mnemonic: TEST_MNEMONIC,
      xpub: 'tpubD6NzVbkrYhZ4Y...',
      xpriv: 'tprv8ZgxMBicQKsPd...',
      accountXpubVanilla: 'tpubDCivdM...',
      accountXpubColored: 'tpubDCivdN...',
      masterFingerprint: '73c5da0a',
    }),
    getDataDir: vi.fn().mockReturnValue('/tmp/rgb-test'),
  };
}

describe('RGBWallet address validation', () => {
  it('should accept mainnet taproot addresses', () => {
    expect(RGBWallet.isAddressValid('bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0')).toBe(true);
  });

  it('should accept testnet taproot addresses', () => {
    expect(RGBWallet.isAddressValid('tb1pqqqqp399et2xygdj5xreqhjjvcmzhxw4aywxecjdzew6hylgvsesf3hn0c')).toBe(true);
  });

  it('should accept RGB invoices', () => {
    expect(RGBWallet.isAddressValid('rgb:token1')).toBe(true);
  });

  it('should reject invalid addresses', () => {
    expect(RGBWallet.isAddressValid('')).toBe(false);
    expect(RGBWallet.isAddressValid('invalid')).toBe(false);
    expect(RGBWallet.isAddressValid('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe(false); // segwit v0, not taproot
    expect(RGBWallet.isAddressValid('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(false); // legacy
    expect(RGBWallet.isAddressValid('bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqinvalid')).toBe(false); // invalid checksum
    expect(RGBWallet.isAddressValid('bc1p')).toBe(false); // too short
    expect(RGBWallet.isAddressValid('tb1p')).toBe(false); // too short
  });
});

describe('RGBWallet.getCommonTransactions', () => {
  it('should map and merge bitcoin transactions and token transfers', async () => {
    // Mock data based on real RGB SDK output
    // Note: SDK types say transactionType is enum (number), but actual data is string
    const mockBtcTransactions: DeepPartial<TransactionCustom>[] = [
      // RGB send tx
      {
        transactionType: 'RgbSend',
        txid: 'tx0',
        received: 690,
        sent: 845,
        fee: 155,
        confirmationTime: { height: 4834605, timestamp: 1768920959 },
      },
      // User deposit tx
      {
        transactionType: 'User',
        txid: 'tx1',
        received: 100000,
        sent: 0,
        fee: 309,
        confirmationTime: { height: 4832594, timestamp: 1768839381 },
      },
      // CREATE_UTXOS tx - internal, net negative
      {
        transactionType: 'CreateUtxos',
        txid: 'tx2',
        received: 339233,
        sent: 341443,
        fee: 2210,
        confirmationTime: { height: 4834518, timestamp: 1768910759 },
      },
    ];

    const mockAssets: ListAssetsResponseCustom = {
      nia: [
        {
          assetId: 'rgb:token1',
          name: 'Layerz Shares',
          ticker: 'LZ',
          precision: 0,
          balance: { settled: 97, future: 93, spendable: 0 },
        },
      ],
      uda: [],
      cfa: [],
    };

    // Note: SDK types say status/kind are enums (number), but actual data is string
    const mockTransfers: DeepPartial<RgbTransferCustom>[] = [
      // Settled receive (kind ReceiveBlind)
      {
        idx: 1,
        batchTransferIdx: 1,
        createdAt: 1768911476,
        updatedAt: 1768913040,
        status: 'Settled',
        requestedAssignment: { Fungible: 100 },
        kind: 'ReceiveBlind',
        txid: 'tx3',
        recipientId: 'tb3:utxob:D1BIpGOS-2IGi7ex-nmhSxJ_-uQk1B6N-bU_dyas-vxzsBfM-Rubm6',
      },
      // Settled send
      {
        idx: 10,
        batchTransferIdx: 10,
        createdAt: 1768920427,
        updatedAt: 1768920661,
        status: 'Settled',
        requestedAssignment: { Fungible: 3 },
        kind: 'Send',
        txid: 'tx4',
        recipientId: 'tb3:utxob:rV1kdaRk-fUPIV5d-Ks1L~Qb-Jvu93~6-QlxuPSR-9jClQsU-xIyMQ',
      },
      // Pending send (WaitingConfirmations)
      {
        idx: 11,
        batchTransferIdx: 11,
        createdAt: 1768920683,
        updatedAt: 1768920743,
        status: 'WaitingConfirmations',
        requestedAssignment: { Fungible: 4 },
        kind: 'Send',
        txid: 'tx0',
        recipientId: 'tb3:utxob:zacFno3V-ioge7Gx-ZZHx~_l-MJuX6A5-2XKL_Ih-uckFdgW-X8~NH',
      },
      // Failed transfer
      {
        idx: 5,
        batchTransferIdx: 5,
        createdAt: 1768900000,
        updatedAt: 1768900100,
        status: 'Failed',
        requestedAssignment: { Fungible: 50 },
        kind: 'Send',
        txid: null,
        recipientId: 'tb3:utxob:failed-recipient',
      },
    ];

    const mockAdapter = createMockAdapter({
      listTransactions: vi.fn().mockResolvedValue(mockBtcTransactions as TransactionCustom[]),
      listAssets: vi.fn().mockResolvedValue(mockAssets),
      listTransfers: vi.fn().mockResolvedValue(mockTransfers as RgbTransferCustom[]),
    });

    // Inject mock adapter
    (globalThis as any).rgbAdapter = mockAdapter;

    const wallet = new RGBWallet('testnet');
    wallet.setSecret(TEST_MNEMONIC);

    const result = await wallet.getCommonTransactions();

    assert.deepEqual(result, [
      // Merged BTC+RGB: tx0 is RGB_SEND (type 0) with pending RGB transfer
      // RGB pending status takes precedence over BTC confirmed
      // Amount is 0 for RGB_SEND (token amount shown in tokenTransfers)
      {
        network: NETWORK_RGB_TESTNET,
        txid: 'tx0',
        amount: 0,
        timestamp: 1768920959,
        status: 'pending',
        direction: 'send',
        fee: 155,
        blockHeight: 4834605,
        explorerUrl: undefined,
        tokenTransfers: [{ tokenId: 'rgb:token1', name: 'Layerz Shares', symbol: 'LZ', decimals: 0, amount: 4, address: 'tb3:utxob:zacFno3V-ioge7Gx-ZZHx~_l-MJuX6A5-2XKL_Ih-uckFdgW-X8~NH' }],
        counterparty: 'tb3:utxob:zacFno3V-ioge7Gx-ZZHx~_l-MJuX6A5-2XKL_Ih-uckFdgW-X8~NH',
      },
      // RGB settled send at 1768920661 (no matching BTC tx)
      {
        network: NETWORK_RGB_TESTNET,
        txid: 'tx4',
        timestamp: 1768920661,
        status: 'confirmed',
        direction: 'send',
        tokenTransfers: [{ tokenId: 'rgb:token1', name: 'Layerz Shares', symbol: 'LZ', decimals: 0, amount: 3, address: 'tb3:utxob:rV1kdaRk-fUPIV5d-Ks1L~Qb-Jvu93~6-QlxuPSR-9jClQsU-xIyMQ' }],
        counterparty: 'tb3:utxob:rV1kdaRk-fUPIV5d-Ks1L~Qb-Jvu93~6-QlxuPSR-9jClQsU-xIyMQ',
        explorerUrl: undefined,
      },
      // RGB settled receive at 1768913040 (no matching BTC tx)
      {
        network: NETWORK_RGB_TESTNET,
        txid: 'tx3',
        timestamp: 1768913040,
        status: 'confirmed',
        direction: 'receive',
        tokenTransfers: [{ tokenId: 'rgb:token1', name: 'Layerz Shares', symbol: 'LZ', decimals: 0, amount: 100, address: 'tb3:utxob:D1BIpGOS-2IGi7ex-nmhSxJ_-uQk1B6N-bU_dyas-vxzsBfM-Rubm6' }],
        counterparty: 'tb3:utxob:D1BIpGOS-2IGi7ex-nmhSxJ_-uQk1B6N-bU_dyas-vxzsBfM-Rubm6',
        explorerUrl: undefined,
      },
      // BTC CREATE_UTXOS (type 2) at 1768910759 - direction is 'swap', amount is -fee
      {
        network: NETWORK_RGB_TESTNET,
        txid: 'tx2',
        amount: -2210,
        timestamp: 1768910759,
        status: 'confirmed',
        direction: 'swap',
        fee: 2210,
        blockHeight: 4834518,
        explorerUrl: undefined,
      },
      // RGB failed transfer at 1768900100 (no txid, uses generated id)
      {
        network: NETWORK_RGB_TESTNET,
        txid: 'rgb-transfer-5-5',
        timestamp: 1768900100,
        status: 'failed',
        direction: 'send',
        tokenTransfers: [{ tokenId: 'rgb:token1', name: 'Layerz Shares', symbol: 'LZ', decimals: 0, amount: 50, address: 'tb3:utxob:failed-recipient' }],
        counterparty: 'tb3:utxob:failed-recipient',
        explorerUrl: undefined,
      },
      // BTC USER (type 3) deposit at 1768839381 - only received, so direction is 'receive'
      {
        network: NETWORK_RGB_TESTNET,
        txid: 'tx1',
        amount: 100000,
        timestamp: 1768839381,
        status: 'confirmed',
        direction: 'receive',
        fee: 309,
        blockHeight: 4832594,
        explorerUrl: undefined,
      },
    ]);
  });
});
