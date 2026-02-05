import { describe, expect, it, vi, assert } from 'vitest';

import { RGBWallet } from '../../class/wallets/rgb-wallet';
import type { ListAssetsResponseCustom, RgbTransferCustom, TransactionCustom } from '../../class/wallets/rgb-types';
import type { DeepPartial } from '../../class/wallets/types';
import { NETWORK_RGB_TESTNET } from '../../types/networks';

const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('RGBWallet.customDeriveKeysFromMnemonic', () => {
  it('should derive keys for account 0', async () => {
    const wallet = new RGBWallet('testnet');
    wallet.setSecret(TEST_MNEMONIC);
    wallet.setAccountNumber(0);
    const keys = await wallet.customDeriveKeysFromMnemonic();

    expect(keys.mnemonic).toBe(TEST_MNEMONIC);
    expect(keys.accountXpubVanilla).toBeDefined();
    expect(keys.accountXpubColored).toBeDefined();
    expect(keys.masterFingerprint).toBeDefined();
    expect(keys.xpub).toBeDefined();
    expect(keys.xpriv).toBeDefined();
  });

  it('should derive different xpubs for different account numbers', async () => {
    const wallet0 = new RGBWallet('testnet');
    wallet0.setSecret(TEST_MNEMONIC);
    wallet0.setAccountNumber(0);
    const keys0 = await wallet0.customDeriveKeysFromMnemonic();

    const wallet1 = new RGBWallet('testnet');
    wallet1.setSecret(TEST_MNEMONIC);
    wallet1.setAccountNumber(1);
    const keys1 = await wallet1.customDeriveKeysFromMnemonic();

    expect(keys0.accountXpubVanilla).not.toBe(keys1.accountXpubVanilla);
    expect(keys0.accountXpubColored).not.toBe(keys1.accountXpubColored);
    // Master fingerprint should be the same (same mnemonic)
    expect(keys0.masterFingerprint).toBe(keys1.masterFingerprint);
    // Root xpub/xpriv should be the same
    expect(keys0.xpub).toBe(keys1.xpub);
    expect(keys0.xpriv).toBe(keys1.xpriv);
  });

  it('should produce expected master fingerprint for test mnemonic', async () => {
    const wallet = new RGBWallet('testnet');
    wallet.setSecret(TEST_MNEMONIC);
    wallet.setAccountNumber(0);
    const keys = await wallet.customDeriveKeysFromMnemonic();

    // Known master fingerprint for "abandon abandon..." mnemonic
    expect(keys.masterFingerprint).toBe('73c5da0a');
  });

  it('should derive different keys for mainnet vs testnet', async () => {
    const walletTestnet = new RGBWallet('testnet');
    walletTestnet.setSecret(TEST_MNEMONIC);
    walletTestnet.setAccountNumber(0);
    const keysTestnet = await walletTestnet.customDeriveKeysFromMnemonic();

    const walletMainnet = new RGBWallet('mainnet');
    walletMainnet.setSecret(TEST_MNEMONIC);
    walletMainnet.setAccountNumber(0);
    const keysMainnet = await walletMainnet.customDeriveKeysFromMnemonic();

    // Different coin types lead to different xpubs
    expect(keysTestnet.accountXpubVanilla).not.toBe(keysMainnet.accountXpubVanilla);
    expect(keysTestnet.accountXpubColored).not.toBe(keysMainnet.accountXpubColored);
    // Root xpubs are also different due to different version bytes
    expect(keysTestnet.xpub).not.toBe(keysMainnet.xpub);
  });
});

describe('RGBWallet.isAddressValid', () => {
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
    const wallet = new RGBWallet('testnet');

    // Mock adapter for getDataDir
    (wallet as any).adapter = {
      getDataDir: () => '/tmp/rgb-test',
    };

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

    (wallet as any)._wallet = {
      listTransactions: vi.fn().mockReturnValue(mockBtcTransactions),
      listAssets: vi.fn().mockReturnValue(mockAssets),
      listTransfers: vi.fn().mockReturnValue(mockTransfers),
      createBackup: vi.fn().mockReturnValue({ backupPath: '/tmp/backup.rgbbackup', message: 'ok' }),
    };

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
