import { describe, expect, it, vi, assert } from 'vitest';
import type { Transaction, RgbTransfer } from 'rgb-sdk';

import { RGBWallet } from '../../class/wallets/rgb-wallet';
import { ListAssetsResponseCustom } from '../../class/wallets/rgb-types';
import { DeepPartial } from '../../class/wallets/types';
import { NETWORK_RGB_TESTNET } from '../../types/networks';

const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('RGBWallet.customDeriveKeysFromMnemonic', () => {
  it('should derive keys for account 0', async () => {
    const wallet = new RGBWallet('testnet');
    wallet.setSecret(TEST_MNEMONIC);
    wallet.setAccountNumber(0);
    const keys = await wallet.customDeriveKeysFromMnemonic();

    expect(keys.mnemonic).toBe(TEST_MNEMONIC);
    expect(keys.account_xpub_vanilla).toBeDefined();
    expect(keys.account_xpub_colored).toBeDefined();
    expect(keys.master_fingerprint).toBeDefined();
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

    expect(keys0.account_xpub_vanilla).not.toBe(keys1.account_xpub_vanilla);
    expect(keys0.account_xpub_colored).not.toBe(keys1.account_xpub_colored);
    // Master fingerprint should be the same (same mnemonic)
    expect(keys0.master_fingerprint).toBe(keys1.master_fingerprint);
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
    expect(keys.master_fingerprint).toBe('73c5da0a');
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
    expect(keysTestnet.account_xpub_vanilla).not.toBe(keysMainnet.account_xpub_vanilla);
    expect(keysTestnet.account_xpub_colored).not.toBe(keysMainnet.account_xpub_colored);
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

    // Mock data based on real RGB SDK output
    // transaction_type: 0=RGB_SEND, 2=CREATE_UTXOS, 3=USER
    const mockBtcTransactions: DeepPartial<Transaction>[] = [
      // RGB send tx (type 0)
      {
        transaction_type: 0,
        txid: 'tx0',
        received: 690,
        sent: 845,
        fee: 155,
        confirmation_time: { height: 4834605, timestamp: 1768920959 },
      },
      // User deposit tx (type 3)
      {
        transaction_type: 3,
        txid: 'tx1',
        received: 100000,
        sent: 0,
        fee: 309,
        confirmation_time: { height: 4832594, timestamp: 1768839381 },
      },
      // CREATE_UTXOS tx (type 2) - internal, net negative
      {
        transaction_type: 2,
        txid: 'tx2',
        received: 339233,
        sent: 341443,
        fee: 2210,
        confirmation_time: { height: 4834518, timestamp: 1768910759 },
      },
    ];

    const mockAssets: ListAssetsResponseCustom = {
      nia: [
        {
          asset_id: 'rgb:token1',
          name: 'Layerz Shares',
          ticker: 'LZ',
          precision: 0,
          balance: { settled: 97, future: 93, spendable: 0, offchain_outbound: 0, offchain_inbound: 0 },
        },
      ],
      uda: null,
      cfa: null,
    };

    // kind: 0=issue, 1=receive, 2=receive_blind, 3=send
    // status: 0=WAITING_COUNTERPARTY, 1=WAITING_CONFIRMATIONS, 2=SETTLED, 3=FAILED
    const mockTransfers: DeepPartial<RgbTransfer>[] = [
      // Settled receive (kind 1)
      {
        idx: 1,
        batch_transfer_idx: 1,
        created_at: 1768911476,
        updated_at: 1768913040,
        status: 2,
        amount: 100,
        kind: 1,
        txid: 'tx3',
        recipient_id: 'tb3:utxob:D1BIpGOS-2IGi7ex-nmhSxJ_-uQk1B6N-bU_dyas-vxzsBfM-Rubm6',
      },
      // Settled send (kind 3)
      {
        idx: 10,
        batch_transfer_idx: 10,
        created_at: 1768920427,
        updated_at: 1768920661,
        status: 2,
        amount: 3,
        kind: 3,
        txid: 'tx4',
        recipient_id: 'tb3:utxob:rV1kdaRk-fUPIV5d-Ks1L~Qb-Jvu93~6-QlxuPSR-9jClQsU-xIyMQ',
      },
      // Pending send (status 1, kind 3)
      {
        idx: 11,
        batch_transfer_idx: 11,
        created_at: 1768920683,
        updated_at: 1768920743,
        status: 1,
        amount: 4,
        kind: 3,
        txid: 'tx0',
        recipient_id: 'tb3:utxob:zacFno3V-ioge7Gx-ZZHx~_l-MJuX6A5-2XKL_Ih-uckFdgW-X8~NH',
      },
      // Failed transfer (status 3)
      {
        idx: 5,
        batch_transfer_idx: 5,
        created_at: 1768900000,
        updated_at: 1768900100,
        status: 3,
        amount: 50,
        kind: 3,
        txid: null,
        recipient_id: 'tb3:utxob:failed-recipient',
      },
    ];

    (wallet as any)._wallet = {
      listTransactions: vi.fn().mockResolvedValue(mockBtcTransactions),
      listAssets: vi.fn().mockResolvedValue(mockAssets),
      listTransfers: vi.fn().mockResolvedValue(mockTransfers),
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
