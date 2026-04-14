import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RgbWallet } from '../../class/wallets/rgb-wallet';
import { NETWORK_RGB, NETWORK_RGB_TESTNET } from '../../types/networks';
import type { IRgbAdapter, IRgbWallet } from '../../types/rgb-adapter';

function installAdapter(overrides: Partial<IRgbWallet> = {}) {
  const sdkWallet: IRgbWallet = {
    dispose: vi.fn(),
    getAddress: vi.fn().mockResolvedValue('bc1pexampletaprootexampletaprootexampletaprootexampletaprootex'),
    getXpub: vi.fn().mockReturnValue({ xpubVan: '', xpubCol: '' }),
    getBtcBalance: vi.fn().mockResolvedValue({
      vanilla: { settled: 100, future: 100, spendable: 100 },
      colored: { settled: 25, future: 25, spendable: 25 },
    }),
    listAssets: vi.fn().mockResolvedValue({ nia: [], uda: [], cfa: [], ifa: [] }),
    getAssetBalance: vi.fn(),
    listUnspents: vi.fn(),
    listTransactions: vi.fn().mockResolvedValue([]),
    listTransfers: vi.fn().mockResolvedValue([]),
    blindReceive: vi.fn(),
    witnessReceive: vi.fn(),
    decodeRGBInvoice: vi.fn(),
    send: vi.fn(),
    sendBegin: vi.fn(),
    sendEnd: vi.fn(),
    sendBtc: vi.fn().mockResolvedValue('btc-txid-abc'),
    sendBtcBegin: vi.fn(),
    sendBtcEnd: vi.fn(),
    createUtxos: vi.fn(),
    createUtxosBegin: vi.fn(),
    createUtxosEnd: vi.fn(),
    signPsbt: vi.fn(),
    refreshWallet: vi.fn(),
    syncWallet: vi.fn(),
    failTransfers: vi.fn(),
    vssBackup: vi.fn().mockResolvedValue(1),
    vssBackupInfo: vi.fn(),
    configureVssBackup: vi.fn(),
    disableVssAutoBackup: vi.fn(),
    getDefaultVssConfig: vi.fn(),
    ...overrides,
  } as unknown as IRgbWallet;

  const adapter: IRgbAdapter = {
    capabilities: { lightning: false },
    createWallet: vi.fn().mockResolvedValue(sdkWallet),
    restoreFromVss: vi.fn().mockResolvedValue(sdkWallet),
  };

  (globalThis as any).rgbAdapter = adapter;
  return { adapter, sdkWallet };
}

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('RgbWallet', () => {
  beforeEach(() => {
    delete (globalThis as any).rgbAdapter;
  });

  describe('isAddressValid', () => {
    it('accepts rgb: invoices', () => {
      installAdapter();
      expect(RgbWallet.isAddressValid('rgb:utxob:abcdef123456')).toBe(true);
    });

    it('accepts utxob: invoices', () => {
      installAdapter();
      expect(RgbWallet.isAddressValid('utxob:1abc2def3ghi')).toBe(true);
    });

    it('accepts taproot addresses', () => {
      installAdapter();
      expect(RgbWallet.isAddressValid('bc1ppkpnr0m9avzkpzrra6q57zdsrtzcf39qrzhxag9m4lq30v7r6a3srw0fxj')).toBe(true);
      expect(RgbWallet.isAddressValid('tb1ppkpnr0m9avzkpzrra6q57zdsrtzcf39qrzhxag9m4lq30v7r6a3s29ukdd')).toBe(true);
    });

    it('rejects plain bc1q (segwit v0)', () => {
      installAdapter();
      expect(RgbWallet.isAddressValid('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq')).toBe(false);
    });

    it('rejects garbage', () => {
      installAdapter();
      expect(RgbWallet.isAddressValid('nope')).toBe(false);
      expect(RgbWallet.isAddressValid('')).toBe(false);
      expect(RgbWallet.isAddressValid('   ')).toBe(false);
    });
  });

  describe('constructor', () => {
    it('throws without an adapter installed', () => {
      expect(() => new RgbWallet(NETWORK_RGB)).toThrowError(/RGB adapter/);
    });

    it('maps NETWORK_RGB_TESTNET to sdk testnet', async () => {
      const { adapter } = installAdapter();
      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      expect(adapter.restoreFromVss).toHaveBeenCalledWith(expect.objectContaining({ network: 'testnet' }));
      expect(w.getNetwork()).toBe(NETWORK_RGB_TESTNET);
    });

    it('maps NETWORK_RGB to sdk mainnet', async () => {
      const { adapter } = installAdapter();
      const w = new RgbWallet(NETWORK_RGB);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      expect(adapter.restoreFromVss).toHaveBeenCalledWith(expect.objectContaining({ network: 'mainnet' }));
    });
  });

  describe('init', () => {
    it('falls back to createWallet when VSS restore throws', async () => {
      const adapter: IRgbAdapter = {
        capabilities: { lightning: false },
        createWallet: vi.fn().mockResolvedValue({} as IRgbWallet),
        restoreFromVss: vi.fn().mockRejectedValue(new Error('no vss backup yet')),
      };
      (globalThis as any).rgbAdapter = adapter;
      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      expect(adapter.restoreFromVss).toHaveBeenCalledOnce();
      expect(adapter.createWallet).toHaveBeenCalledOnce();
    });
  });

  describe('balance + send', () => {
    it('returns vanilla + colored spendable sats', async () => {
      installAdapter();
      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      expect(await w.getOffchainBalance()).toBe(125);
    });

    it('pay() delegates to sendBtc and triggers a backup attempt', async () => {
      const { sdkWallet } = installAdapter();
      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      const txid = await w.pay('tb1ppkpnr0m9avzkpzrra6q57zdsrtzcf39qrzhxag9m4lq30v7r6a3s29ukdd', 1000);
      expect(txid).toBe('btc-txid-abc');
      expect(sdkWallet.sendBtc).toHaveBeenCalledWith(expect.objectContaining({ amount: 1000 }));
      expect(sdkWallet.vssBackup).toHaveBeenCalledOnce();
    });
  });

  describe('tokens', () => {
    it('fetchTokenBalances maps NIA + CFA + IFA assets to CachedTokenInfo', async () => {
      const { sdkWallet } = installAdapter();
      (sdkWallet.listAssets as any) = vi.fn().mockResolvedValue({
        nia: [{ assetId: 'nia-1', name: 'Token A', ticker: 'A', precision: 2, balance: { settled: 10, future: 10, spendable: 10 } }],
        cfa: [{ assetId: 'cfa-1', name: 'Collectible', precision: 0, balance: { settled: 1, future: 1, spendable: 1 } }],
        ifa: [],
        uda: [],
      });
      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      await w.fetchTokenBalances();
      const balances = w.getTokenBalances();
      expect(balances).toHaveLength(2);
      expect(balances[0].id).toBe('nia-1');
      expect(balances[0].symbol).toBe('A');
      expect(balances[0].decimals).toBe(2);
      expect(balances[0].balance).toBe('10');
      expect(balances[1].id).toBe('cfa-1');
      expect(balances[1].symbol).toBe('Collectible'); // no ticker for CFA, falls back to name
    });
  });

  describe('getCommonTransactions', () => {
    it('merges listTransactions with listTransfers and flags pending state', async () => {
      const { sdkWallet } = installAdapter();
      (sdkWallet.listTransactions as any) = vi.fn().mockResolvedValue([
        { transactionType: 'User', txid: 'tx1', received: 5000, sent: 0, fee: 0, confirmationTime: { height: 100, timestamp: 1700000000 } },
        { transactionType: 'RgbSend', txid: 'tx2', received: 0, sent: 1200, fee: 200, confirmationTime: { height: 101, timestamp: 1700000100 } },
      ]);
      (sdkWallet.listTransfers as any) = vi.fn().mockResolvedValue([
        { idx: 1, batchTransferIdx: 1, createdAt: 1700000000000, updatedAt: 1700000000000, status: 'Settled', kind: 'ReceiveBlind', assignments: [], transportEndpoints: [], txid: 'tx1' },
        {
          idx: 2,
          batchTransferIdx: 2,
          createdAt: 1700000200000,
          updatedAt: 1700000200000,
          status: 'WaitingCounterparty',
          kind: 'ReceiveBlind',
          assignments: [],
          transportEndpoints: [],
          invoiceString: 'rgb:abc',
        },
      ]);

      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      const txs = await w.getCommonTransactions();
      expect(txs).toHaveLength(3);
      // sorted descending by timestamp
      expect(txs[0].status).toBe('pending');
      expect(txs[0].txid).toBe('rgb:abc');
      expect(txs[1].txid).toBe('tx2');
      expect(txs[1].direction).toBe('send');
      expect(txs[2].txid).toBe('tx1');
      expect(txs[2].direction).toBe('receive');
    });
  });
});
