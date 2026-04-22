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

    it('rejects bare prefixes (no payload)', () => {
      installAdapter();
      expect(RgbWallet.isAddressValid('rgb:')).toBe(false);
      expect(RgbWallet.isAddressValid('utxob:')).toBe(false);
      expect(RgbWallet.isAddressValid('rgb:abc')).toBe(false); // too short
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
    it('falls back to createWallet when VSS reports backup missing', async () => {
      const adapter: IRgbAdapter = {
        capabilities: { lightning: false },
        createWallet: vi.fn().mockResolvedValue({} as IRgbWallet),
        restoreFromVss: vi.fn().mockRejectedValue(Object.assign(new Error('not found'), { name: 'NotFoundError' })),
      };
      (globalThis as any).rgbAdapter = adapter;
      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      expect(adapter.restoreFromVss).toHaveBeenCalledOnce();
      expect(adapter.createWallet).toHaveBeenCalledOnce();
    });

    it('rethrows non-missing-backup errors from VSS', async () => {
      const adapter: IRgbAdapter = {
        capabilities: { lightning: false },
        createWallet: vi.fn(),
        restoreFromVss: vi.fn().mockRejectedValue(Object.assign(new Error('network unreachable'), { statusCode: 503 })),
      };
      (globalThis as any).rgbAdapter = adapter;
      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await expect(w.init({} as any)).rejects.toThrow(/network unreachable/);
      expect(adapter.createWallet).not.toHaveBeenCalled();
    });

    it('rethrows transport errors whose message contains "not found" (e.g. DNS/TLS)', async () => {
      // The previous, looser regex `/not.?found/i` would have swallowed this.
      const adapter: IRgbAdapter = {
        capabilities: { lightning: false },
        createWallet: vi.fn(),
        restoreFromVss: vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND vss.example.com — host not found')),
      };
      (globalThis as any).rgbAdapter = adapter;
      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await expect(w.init({} as any)).rejects.toThrow(/host not found/);
      expect(adapter.createWallet).not.toHaveBeenCalled();
    });

    it('falls back on HTTP 404 from VSS', async () => {
      const adapter: IRgbAdapter = {
        capabilities: { lightning: false },
        createWallet: vi.fn().mockResolvedValue({} as IRgbWallet),
        restoreFromVss: vi.fn().mockRejectedValue(Object.assign(new Error('vss bucket unavailable'), { statusCode: 404 })),
      };
      (globalThis as any).rgbAdapter = adapter;
      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      expect(adapter.createWallet).toHaveBeenCalledOnce();
    });

    it('falls back on RgbError code=VssBackupNotFound (RN SDK shape)', async () => {
      // Shape emitted by @utexo/rgb-sdk-rn when the user has no prior VSS backup.
      // This is the primary path for existing users opening an RGB wallet for
      // the first time after an app update.
      const err = Object.assign(new Error('Rgb.RgbLibError.VssBackupNotFound'), { code: 'VssBackupNotFound' });
      const adapter: IRgbAdapter = {
        capabilities: { lightning: false },
        createWallet: vi.fn().mockResolvedValue({} as IRgbWallet),
        restoreFromVss: vi.fn().mockRejectedValue(err),
      };
      (globalThis as any).rgbAdapter = adapter;
      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      expect(adapter.createWallet).toHaveBeenCalledOnce();
    });

    it('falls back on web SDK shape (non-Error object, toString = "VSS backup not found")', async () => {
      // Observed shape thrown by @utexo/rgb-sdk-web when the user has no VSS
      // backup: an object with numeric keys, no `message`, but a `toString()`
      // that yields the error phrase. Verifies we fall back to String(e) when
      // err.message is missing.
      const err = Object.assign({ 0: 'V', 1: 'S', 2: 'S' }, { toString: () => 'VSS backup not found' });
      const adapter: IRgbAdapter = {
        capabilities: { lightning: false },
        createWallet: vi.fn().mockResolvedValue({} as IRgbWallet),
        restoreFromVss: vi.fn().mockRejectedValue(err),
      };
      (globalThis as any).rgbAdapter = adapter;
      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      expect(adapter.createWallet).toHaveBeenCalledOnce();
    });
  });

  describe('balance + send', () => {
    it('returns vanilla spendable sats only (excludes colored allocations)', async () => {
      installAdapter();
      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      expect(await w.getOffchainBalance()).toBe(100);
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

    it('transferToken rejects amounts above Number.MAX_SAFE_INTEGER', async () => {
      installAdapter();
      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      const huge = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
      await expect(w.transferToken('nia-1', huge, 'rgb:abc')).rejects.toThrow(/MAX_SAFE_INTEGER/);
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
    it('attributes per-transfer tokenId correctly across multiple assets', async () => {
      const { sdkWallet } = installAdapter();
      // Two assets in the wallet
      (sdkWallet.listAssets as any) = vi.fn().mockResolvedValue({
        nia: [
          { assetId: 'nia-A', name: 'Token A', ticker: 'A', precision: 2, balance: { settled: 0, future: 0, spendable: 0 } },
          { assetId: 'nia-B', name: 'Token B', ticker: 'B', precision: 0, balance: { settled: 0, future: 0, spendable: 0 } },
        ],
        cfa: [],
        ifa: [],
        uda: [],
      });
      // On-chain txs
      (sdkWallet.listTransactions as any) = vi.fn().mockResolvedValue([
        { transactionType: 'RgbSend', txid: 'txA', received: 0, sent: 0, fee: 50, confirmationTime: { height: 100, timestamp: 1700000000 } },
        { transactionType: 'RgbSend', txid: 'txB', received: 0, sent: 0, fee: 50, confirmationTime: { height: 101, timestamp: 1700000100 } },
      ]);
      // Per-asset transfers: listTransfers is called once per asset id with that id passed in
      (sdkWallet.listTransfers as any) = vi.fn().mockImplementation(async (assetId?: string) => {
        if (assetId === 'nia-A') {
          return [
            {
              idx: 1,
              batchTransferIdx: 1,
              createdAt: 1700000000000,
              updatedAt: 1700000000000,
              status: 'Settled',
              kind: 'Send',
              assignments: [{ type: 'Fungible', amount: 10 }],
              transportEndpoints: [],
              txid: 'txA',
            },
          ];
        }
        if (assetId === 'nia-B') {
          return [
            {
              idx: 2,
              batchTransferIdx: 2,
              createdAt: 1700000100000,
              updatedAt: 1700000100000,
              status: 'Settled',
              kind: 'ReceiveBlind',
              assignments: [{ type: 'Fungible', amount: 7 }],
              transportEndpoints: [],
              txid: 'txB',
            },
          ];
        }
        return [];
      });

      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      const txs = await w.getCommonTransactions();
      expect(txs).toHaveLength(2);
      // sorted descending by timestamp → txB (nia-B) first
      expect(txs[0].txid).toBe('txB');
      expect(txs[0].tokenTransfers?.[0].tokenId).toBe('nia-B');
      expect(txs[0].tokenTransfers?.[0].symbol).toBe('B');
      expect(txs[0].tokenTransfers?.[0].amount).toBe(7);
      expect(txs[1].txid).toBe('txA');
      expect(txs[1].tokenTransfers?.[0].tokenId).toBe('nia-A');
      expect(txs[1].tokenTransfers?.[0].symbol).toBe('A');
      expect(txs[1].tokenTransfers?.[0].amount).toBe(10);
    });

    it('emits pending transfers (no mined txid) under a namespaced key, with two assets in the wallet', async () => {
      const { sdkWallet } = installAdapter();
      // Two assets in the wallet: the pending transfer belongs to one (nia-A)
      // and listTransfers('nia-B') returns an empty array. This exercises the
      // per-asset iteration actually filtering to the right asset.
      (sdkWallet.listAssets as any) = vi.fn().mockResolvedValue({
        nia: [
          { assetId: 'nia-A', name: 'Token A', ticker: 'A', precision: 0, balance: { settled: 0, future: 0, spendable: 0 } },
          { assetId: 'nia-B', name: 'Token B', ticker: 'B', precision: 0, balance: { settled: 0, future: 0, spendable: 0 } },
        ],
        cfa: [],
        ifa: [],
        uda: [],
      });
      (sdkWallet.listTransactions as any) = vi.fn().mockResolvedValue([]);
      (sdkWallet.listTransfers as any) = vi.fn().mockImplementation(async (assetId?: string) => {
        if (assetId === 'nia-A') {
          return [
            {
              idx: 99,
              batchTransferIdx: 1,
              createdAt: 1700000200000,
              updatedAt: 1700000200000,
              status: 'WaitingCounterparty',
              kind: 'ReceiveBlind',
              assignments: [{ type: 'Fungible', amount: 5 }],
              transportEndpoints: [],
              invoiceString: 'rgb:pending-invoice-xyz',
            },
          ];
        }
        return [];
      });

      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      const txs = await w.getCommonTransactions();
      expect(txs).toHaveLength(1);
      expect(txs[0].status).toBe('pending');
      expect(txs[0].direction).toBe('receive');
      expect(txs[0].txid).toMatch(/^transfer:/);
      expect(txs[0].tokenTransfers?.[0].tokenId).toBe('nia-A');
    });

    it('dedupes repeated assignments within a single transfer', async () => {
      // Defense-in-depth: if the SDK (or a future pagination bug) returns the
      // same assignment twice, our (assetId, amount, recipient, kind) key
      // collapses the repeat rather than double-reporting the transfer.
      const { sdkWallet } = installAdapter();
      (sdkWallet.listAssets as any) = vi.fn().mockResolvedValue({
        nia: [{ assetId: 'nia-A', name: 'Token A', ticker: 'A', precision: 0, balance: { settled: 0, future: 0, spendable: 0 } }],
        cfa: [],
        ifa: [],
        uda: [],
      });
      (sdkWallet.listTransactions as any) = vi
        .fn()
        .mockResolvedValue([{ transactionType: 'RgbSend', txid: 'tx1', received: 0, sent: 0, fee: 10, confirmationTime: { height: 1, timestamp: 1700000000 } }]);
      (sdkWallet.listTransfers as any) = vi.fn().mockResolvedValue([
        {
          idx: 1,
          batchTransferIdx: 1,
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
          status: 'Settled',
          kind: 'Send',
          assignments: [
            { type: 'Fungible', amount: 42 },
            { type: 'Fungible', amount: 42 }, // duplicate entry
          ],
          transportEndpoints: [],
          txid: 'tx1',
          recipientId: 'rcp-1',
        },
      ]);

      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      const txs = await w.getCommonTransactions();
      expect(txs).toHaveLength(1);
      expect(txs[0].tokenTransfers).toHaveLength(1); // duplicate collapsed
    });
  });

  describe('fetchTokenBalances', () => {
    it('dedupes concurrent callers into a single SDK round-trip', async () => {
      const { sdkWallet } = installAdapter();
      (sdkWallet.listAssets as any) = vi.fn().mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 10));
        return { nia: [], cfa: [], ifa: [], uda: [] };
      });

      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);

      // Three concurrent callers, only one listAssets call should happen.
      await Promise.all([w.fetchTokenBalances(), w.fetchTokenBalances(), w.fetchTokenBalances()]);
      expect((sdkWallet.listAssets as any).mock.calls.length).toBe(1);
    });

    it('survives listAssets failure without nuking the wallet', async () => {
      const { sdkWallet } = installAdapter();
      (sdkWallet.listAssets as any) = vi.fn().mockRejectedValueOnce(new Error('indexer down'));

      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);

      // getOffchainBalance kicks off fetchTokenBalances but must not propagate its error.
      const bal = await w.getOffchainBalance();
      expect(bal).toBe(100);
    });
  });
});
