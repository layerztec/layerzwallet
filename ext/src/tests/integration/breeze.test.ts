import { afterEach, describe, expect, it } from 'vitest';
import { BreezWallet } from '@shared/class/wallets/breez-wallet';
import { breezAdapter } from '../../modules/breeze-adapter';

describe('BreezWallet', () => {
  afterEach(async () => {
    await breezAdapter.disconnect();
  });

  describe('breezAdapter', () => {
    it('should initialize and connect on first call', async () => {
      const testConnection = {
        mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        network: 'mainnet',
      };

      const result = await breezAdapter.api.getInfo(testConnection);

      expect(result).toEqual({
        blockchainInfo: {
          bitcoinTip: 0,
          liquidTip: 0,
        },
        walletInfo: {
          assetBalances: [],
          balanceSat: 0,
          fingerprint: '73c5da0a',
          pendingReceiveSat: 0,
          pendingSendSat: 0,
          pubkey: '03d902f35f560e0470c63313c7369168d9d7df2d49bf295fd9fb7cb109ccee0494',
        },
      });
    });
  });

  it('should be able to use the BreezWallet class', async () => {
    const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const w = new BreezWallet(mnemonic, 'mainnet', breezAdapter);
    const info = await w.getInfo();
    expect(info).toEqual({
      blockchainInfo: {
        bitcoinTip: 0,
        liquidTip: 0,
      },
      walletInfo: {
        assetBalances: [],
        balanceSat: 0,
        fingerprint: '73c5da0a',
        pendingReceiveSat: 0,
        pendingSendSat: 0,
        pubkey: '03d902f35f560e0470c63313c7369168d9d7df2d49bf295fd9fb7cb109ccee0494',
      },
    });
  });

  it.skip('should handle multiple connections', async () => {
    const mnemonic1 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const mnemonic2 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

    const w1 = new BreezWallet(mnemonic1, 'testnet', breezAdapter);
    const w2 = new BreezWallet(mnemonic2, 'mainnet', breezAdapter);

    const info1 = await w1.getInfo();
    console.info('info1', info1.walletInfo);
    const info2 = await w2.getInfo();
    console.info('info2', info2.walletInfo);
    expect(info1.walletInfo.fingerprint).not.toEqual(info2.walletInfo.fingerprint);
  });
});
