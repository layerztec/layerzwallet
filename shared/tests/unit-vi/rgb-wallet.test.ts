import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RgbBackupLostError, RgbBackupServerUnreachableError, RgbWallet } from '../../class/wallets/rgb-wallet';
import { getRgbBackupStateStorageKey, getRgbInitializedStorageKey, IStorage } from '../../types/IStorage';
import { NETWORK_RGB, NETWORK_RGB_TESTNET } from '../../types/networks';
import type { IRgbAdapter, IRgbWallet } from '../../types/rgb-adapter';

/** In-memory IStorage used by the backup-handling tests. */
function makeMemoryStorage(initial: Record<string, string> = {}): IStorage & { _data: Record<string, string> } {
  const _data: Record<string, string> = { ...initial };
  return {
    _data,
    async getItem(key) {
      return _data[key] ?? '';
    },
    async setItem(key, value) {
      _data[key] = value;
    },
  };
}

function installAdapter(overrides: Partial<IRgbWallet> = {}) {
  const sdkWallet: IRgbWallet = {
    dispose: vi.fn().mockResolvedValue(undefined),
    getAddress: vi.fn().mockResolvedValue('bc1pexampletaprootexampletaprootexampletaprootexampletaprootex'),
    getXpub: vi.fn().mockReturnValue({ xpubVan: '', xpubCol: '' }),
    getBtcBalance: vi.fn().mockResolvedValue({
      vanilla: { settled: 100, future: 100, spendable: 100 },
      colored: { settled: 25, future: 25, spendable: 25 },
    }),
    listAssets: vi.fn().mockResolvedValue({ nia: [], uda: [], cfa: [], ifa: [] }),
    getAssetBalance: vi.fn(),
    listUnspents: vi.fn().mockResolvedValue([]),
    estimateFeeRate: vi.fn().mockResolvedValue(1),
    listTransactions: vi.fn().mockResolvedValue([]),
    listTransfers: vi.fn().mockResolvedValue([]),
    blindReceive: vi.fn().mockResolvedValue({ invoice: 'rgb:blind-invoice', recipientId: 'utxob:abc', expirationTimestamp: 1730000000, batchTransferIdx: 1 }),
    witnessReceive: vi.fn().mockResolvedValue({ invoice: 'rgb:witness-invoice', recipientId: 'tb1pwit', expirationTimestamp: 1730000000, batchTransferIdx: 2 }),
    decodeRGBInvoice: vi.fn(),
    send: vi.fn(),
    sendBegin: vi.fn(),
    sendEnd: vi.fn(),
    sendBtc: vi.fn().mockResolvedValue('btc-txid-abc'),
    sendBtcBegin: vi.fn(),
    sendBtcEnd: vi.fn(),
    createUtxos: vi.fn().mockResolvedValue(1),
    createUtxosBegin: vi.fn(),
    createUtxosEnd: vi.fn(),
    issueAssetNia: vi
      .fn()
      .mockResolvedValue({ assetId: 'rgb:demo-asset', ticker: 'DEMO', name: 'Demo Token', precision: 2, issuedSupply: 1000, timestamp: 0, balance: { settled: 1000, future: 1000, spendable: 1000 } }),
    signPsbt: vi.fn(),
    refreshWallet: vi.fn(),
    syncWallet: vi.fn(),
    failTransfers: vi.fn(),
    vssBackup: vi.fn().mockResolvedValue(1),
    // Default to "VSS reachable, no backup yet, no backup required" so the
    // probe-then-fresh-create path used by RgbWallet.init() works without
    // each test having to spell it out. See
    // tasks/rgb-backup-failure-handling.md.
    vssBackupInfo: vi.fn().mockResolvedValue({ backupExists: false, backupRequired: false, serverVersion: null }),
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
        createWallet: vi.fn().mockResolvedValue({ vssBackupInfo: vi.fn().mockResolvedValue({ backupExists: false, backupRequired: false, serverVersion: null }) } as unknown as IRgbWallet),
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
        createWallet: vi.fn().mockResolvedValue({ vssBackupInfo: vi.fn().mockResolvedValue({ backupExists: false, backupRequired: false, serverVersion: null }) } as unknown as IRgbWallet),
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
        createWallet: vi.fn().mockResolvedValue({ vssBackupInfo: vi.fn().mockResolvedValue({ backupExists: false, backupRequired: false, serverVersion: null }) } as unknown as IRgbWallet),
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
        createWallet: vi.fn().mockResolvedValue({ vssBackupInfo: vi.fn().mockResolvedValue({ backupExists: false, backupRequired: false, serverVersion: null }) } as unknown as IRgbWallet),
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

    it('transferToken: omits amount/assetId when invoice has them baked in', async () => {
      // Repro of the empty-PSBT bug: when the invoice carries assignment.amount
      // and we *also* pass `amount` to sendBegin, rgb-lib returns an empty PSBT
      // and signPsbt rejects with `psbtBase64 must be a non-empty string`.
      const { sdkWallet } = installAdapter({
        decodeRGBInvoice: vi.fn().mockResolvedValue({
          invoice: 'rgb:full-invoice',
          recipientId: 'utxob:abc',
          assetId: 'rgb:embedded-asset',
          network: 'testnet',
          assignment: { type: 'Fungible', amount: 42 },
          expirationTimestamp: null,
          transportEndpoints: [],
        }),
        send: vi.fn().mockResolvedValue({ txid: 'tx-omit', batchTransferIdx: 1 }),
      });
      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      const txid = await w.transferToken('rgb:embedded-asset', 42n, 'rgb:full-invoice');
      expect(txid).toBe('tx-omit');
      expect(sdkWallet.send).toHaveBeenCalledWith({ invoice: 'rgb:full-invoice', feeRate: 1 });
      // No `amount` and no `assetId` keys leaked through.
      const call = (sdkWallet.send as any).mock.calls[0][0];
      expect('amount' in call).toBe(false);
      expect('assetId' in call).toBe(false);
    });

    it('transferToken: passes amount/assetId for an "any-amount" / "any-asset" invoice', async () => {
      const { sdkWallet } = installAdapter({
        decodeRGBInvoice: vi.fn().mockResolvedValue({
          invoice: 'rgb:open-invoice',
          recipientId: 'utxob:open',
          // No assetId, no amount → invoice is the open / "tip jar" form.
          network: 'testnet',
          assignment: { type: 'Any' },
          expirationTimestamp: null,
          transportEndpoints: [],
        }),
        send: vi.fn().mockResolvedValue({ txid: 'tx-open', batchTransferIdx: 2 }),
      });
      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      const txid = await w.transferToken('nia-A', 100n, 'rgb:open-invoice');
      expect(txid).toBe('tx-open');
      expect(sdkWallet.send).toHaveBeenCalledWith({ invoice: 'rgb:open-invoice', feeRate: 1, assetId: 'nia-A', amount: 100 });
    });

    it('decodeInvoice: returns the projected shape', async () => {
      const { sdkWallet } = installAdapter({
        decodeRGBInvoice: vi.fn().mockResolvedValue({
          invoice: 'rgb:abc',
          recipientId: 'utxob:r',
          assetId: 'rgb:asset-1',
          network: 'testnet',
          assignment: { type: 'Fungible', amount: 7 },
          expirationTimestamp: 1730000000,
          transportEndpoints: [],
        }),
      });
      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      const out = await w.decodeInvoice('rgb:abc');
      expect(out).toEqual({ assetId: 'rgb:asset-1', amount: 7, expirationTimestamp: 1730000000, recipientId: 'utxob:r' });
      expect(sdkWallet.decodeRGBInvoice).toHaveBeenCalledWith({ invoice: 'rgb:abc' });
    });

    it('decodeInvoice: returns null on SDK error (caller falls back to manual entry)', async () => {
      installAdapter({ decodeRGBInvoice: vi.fn().mockRejectedValue(new Error('bad invoice')) });
      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      const out = await w.decodeInvoice('rgb:bad');
      expect(out).toBeNull();
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

  describe('asset issuance', () => {
    it('createUtxos delegates to the SDK with default fee rate and triggers a backup', async () => {
      const { sdkWallet } = installAdapter();
      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      const slots = await w.createUtxos();
      expect(slots).toBe(1);
      expect(sdkWallet.createUtxos).toHaveBeenCalledWith({ upTo: true, num: 1, feeRate: 1 });
      expect(sdkWallet.vssBackup).toHaveBeenCalled();
    });

    it('requestReceive: prefers blindReceive when slots are available', async () => {
      const { sdkWallet } = installAdapter();
      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      const out = await w.requestReceive({ assetId: 'rgb:asset-1', amount: 100 });
      expect(sdkWallet.blindReceive).toHaveBeenCalledWith({ assetId: 'rgb:asset-1', amount: 100 });
      expect(sdkWallet.witnessReceive).not.toHaveBeenCalled();
      expect(out.type).toBe('blind');
      expect(out.invoice).toBe('rgb:blind-invoice');
      expect(out.recipientId).toBe('utxob:abc');
      expect(out.expirationTimestamp).toBe(1730000000);
    });

    it('requestReceive: falls back to witnessReceive on InsufficientAllocationSlots', async () => {
      const { sdkWallet } = installAdapter({
        blindReceive: vi.fn().mockRejectedValue(Object.assign(new Error('Rgb.RgbLibError.InsufficientAllocationSlots'), { code: 'InsufficientAllocationSlots' })),
      });
      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      const out = await w.requestReceive();
      expect(sdkWallet.blindReceive).toHaveBeenCalledOnce();
      expect(sdkWallet.witnessReceive).toHaveBeenCalledOnce();
      expect(out.type).toBe('witness');
      expect(out.invoice).toBe('rgb:witness-invoice');
    });

    it('requestReceive: rethrows non-allocation errors from blindReceive (no witness fallback)', async () => {
      // Defense against the fall-through swallowing real failures (network,
      // validation, etc.). Only the specific allocation-slot error should
      // trigger a witness retry.
      const { sdkWallet } = installAdapter({
        blindReceive: vi.fn().mockRejectedValue(new Error('Indexer offline')),
      });
      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      await expect(w.requestReceive()).rejects.toThrow(/Indexer offline/);
      expect(sdkWallet.witnessReceive).not.toHaveBeenCalled();
    });

    it('issueAssetNia returns a narrow projection and triggers a backup', async () => {
      const { sdkWallet } = installAdapter();
      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      const params = { ticker: 'DEMO', name: 'Demo Token', precision: 2, amounts: [1000] };
      const out = await w.issueAssetNia(params);
      expect(sdkWallet.issueAssetNia).toHaveBeenCalledWith(params);
      // The wallet should not leak SDK-only fields like `issuedSupply` or `balance` to callers.
      expect(out).toEqual({ assetId: 'rgb:demo-asset', ticker: 'DEMO', name: 'Demo Token', precision: 2 });
      expect(sdkWallet.vssBackup).toHaveBeenCalled();
    });
  });

  describe('utxo manager helpers', () => {
    it('createUtxos forwards custom { num, size, feeRate, upTo } and triggers a backup', async () => {
      const { sdkWallet } = installAdapter();
      (sdkWallet.createUtxos as any).mockResolvedValue(3);
      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      const slots = await w.createUtxos({ num: 3, size: 2000, feeRate: 7, upTo: false });
      expect(slots).toBe(3);
      expect(sdkWallet.createUtxos).toHaveBeenCalledWith({ upTo: false, num: 3, size: 2000, feeRate: 7 });
      expect(sdkWallet.vssBackup).toHaveBeenCalled();
    });

    it('listUnspents syncs (syncWallet + refreshWallet) before returning the SDK shape verbatim', async () => {
      const { sdkWallet } = installAdapter();
      const fake = [
        {
          utxo: { outpoint: 'a:0', btcAmount: 1000, colorable: true, exists: true },
          rgbAllocations: [{ assetId: 'rgb:demo', assignment: { type: 'Fungible', amount: 42 }, settled: true }],
          pendingBlinded: 0,
        },
      ];
      (sdkWallet.listUnspents as any).mockResolvedValue(fake);
      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      const out = await w.listUnspents();
      expect(sdkWallet.syncWallet).toHaveBeenCalled();
      expect(sdkWallet.refreshWallet).toHaveBeenCalled();
      expect(out).toBe(fake);
    });
  });

  describe('prepareWallet', () => {
    // Mock unspents shape: a single non-colorable spendable output (so listUnspents
    // is non-empty) plus zero free colorable slots → triggers the top-up branch.
    const oneVanillaUnspent = [{ utxo: { outpoint: 'a:0', btcAmount: 5000, colorable: false, exists: true }, rgbAllocations: [], pendingBlinded: 0 }];
    const oneFreeColorable = [...oneVanillaUnspent, { utxo: { outpoint: 'b:0', btcAmount: 1000, colorable: true, exists: true }, rgbAllocations: [], pendingBlinded: 0 }];
    const threeFreeColorable = [
      ...oneVanillaUnspent,
      { utxo: { outpoint: 'c:0', btcAmount: 1000, colorable: true, exists: true }, rgbAllocations: [], pendingBlinded: 0 },
      { utxo: { outpoint: 'd:0', btcAmount: 1000, colorable: true, exists: true }, rgbAllocations: [], pendingBlinded: 0 },
      { utxo: { outpoint: 'e:0', btcAmount: 1000, colorable: true, exists: true }, rgbAllocations: [], pendingBlinded: 0 },
    ];

    it('testnet: skips the fee gate, tops up when free slots are scarce', async () => {
      const { sdkWallet } = installAdapter();
      (sdkWallet.listUnspents as any).mockResolvedValue(oneFreeColorable);
      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      await w.prepareWallet();
      expect(sdkWallet.estimateFeeRate).not.toHaveBeenCalled();
      expect(sdkWallet.createUtxos).toHaveBeenCalledWith({ upTo: true, num: 5, size: 1000, feeRate: 1 });
      expect(sdkWallet.vssBackup).toHaveBeenCalled();
    });

    it('skips top-up when there are already plenty of free slots', async () => {
      const { sdkWallet } = installAdapter();
      (sdkWallet.listUnspents as any).mockResolvedValue(threeFreeColorable);
      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      await w.prepareWallet();
      expect(sdkWallet.createUtxos).not.toHaveBeenCalled();
    });

    it('skips when the wallet has no spendable outputs at all', async () => {
      const { sdkWallet } = installAdapter();
      (sdkWallet.listUnspents as any).mockResolvedValue([]);
      const w = new RgbWallet(NETWORK_RGB_TESTNET);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      await w.prepareWallet();
      expect(sdkWallet.createUtxos).not.toHaveBeenCalled();
    });

    it('mainnet: skips when network fees exceed the gate', async () => {
      const { sdkWallet } = installAdapter();
      (sdkWallet.listUnspents as any).mockResolvedValue(oneFreeColorable);
      (sdkWallet.estimateFeeRate as any).mockResolvedValue(10); // > 3
      const w = new RgbWallet(NETWORK_RGB);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      await w.prepareWallet();
      expect(sdkWallet.estimateFeeRate).toHaveBeenCalledWith(6);
      expect(sdkWallet.createUtxos).not.toHaveBeenCalled();
    });

    it('mainnet: proceeds when fees are at or below the gate', async () => {
      const { sdkWallet } = installAdapter();
      (sdkWallet.listUnspents as any).mockResolvedValue(oneFreeColorable);
      (sdkWallet.estimateFeeRate as any).mockResolvedValue(2); // ≤ 3
      const w = new RgbWallet(NETWORK_RGB);
      w.setSecret(MNEMONIC);
      await w.init({} as any);
      await w.prepareWallet();
      // Mainnet defaultFeeRate is 5 (see RgbWallet.defaultFeeRate)
      expect(sdkWallet.createUtxos).toHaveBeenCalledWith({ upTo: true, num: 5, size: 1000, feeRate: 5 });
    });
  });

  /**
   * Backup-failure handling. The model these tests cover is documented in
   * tasks/rgb-backup-failure-handling.md.
   *
   * The init() probe path: when restoreFromVss reports a "missing" error, we
   * don't trust that classification on its own — we create a candidate wallet
   * and call vssBackupInfo on it. The probe answer (combined with the
   * device-local "RGB_INITIALIZED" flag) determines whether we fresh-create,
   * throw RgbBackupServerUnreachableError, throw RgbBackupLostError, or
   * surface the original error.
   */
  describe('backup-failure handling', () => {
    describe('init probe', () => {
      it('throws RgbBackupServerUnreachableError when probe call itself fails', async () => {
        // restoreFromVss says "missing"; probe says nothing (throws). Without
        // the probe gate, the old code would have created a fresh wallet and
        // overwritten the user's real backup on the next mutation.
        const probeWallet = {
          vssBackupInfo: vi.fn().mockRejectedValue(new Error('connect ETIMEDOUT')),
          dispose: vi.fn().mockResolvedValue(undefined),
        } as unknown as IRgbWallet;
        const adapter: IRgbAdapter = {
          capabilities: { lightning: false },
          createWallet: vi.fn().mockResolvedValue(probeWallet),
          restoreFromVss: vi.fn().mockRejectedValue(Object.assign(new Error('not found'), { name: 'NotFoundError' })),
        };
        (globalThis as any).rgbAdapter = adapter;
        const w = new RgbWallet(NETWORK_RGB_TESTNET);
        w.setSecret(MNEMONIC);
        await expect(w.init(makeMemoryStorage())).rejects.toBeInstanceOf(RgbBackupServerUnreachableError);
        // Probe wallet was disposed — we don't keep dangling state.
        expect(probeWallet.dispose).toHaveBeenCalled();
      });

      it('rethrows the original restore error when probe says backup exists', async () => {
        // The "missing" classifier was wrong: server says a backup is here,
        // restoreFromVss just couldn't load it. Surface the original error so
        // the user knows what actually went wrong instead of a misleading
        // fresh wallet.
        const probeWallet = {
          vssBackupInfo: vi.fn().mockResolvedValue({ backupExists: true, backupRequired: false, serverVersion: 7 }),
          dispose: vi.fn().mockResolvedValue(undefined),
        } as unknown as IRgbWallet;
        const restoreErr = Object.assign(new Error('Rgb.RgbLibError.VssBackupNotFound'), { code: 'VssBackupNotFound' });
        const adapter: IRgbAdapter = {
          capabilities: { lightning: false },
          createWallet: vi.fn().mockResolvedValue(probeWallet),
          restoreFromVss: vi.fn().mockRejectedValue(restoreErr),
        };
        (globalThis as any).rgbAdapter = adapter;
        const w = new RgbWallet(NETWORK_RGB_TESTNET);
        w.setSecret(MNEMONIC);
        await expect(w.init(makeMemoryStorage())).rejects.toBe(restoreErr);
      });

      it('throws RgbBackupLostError when device flag is set and probe says missing', async () => {
        // Hardest case: this device has used RGB before (flag set), but VSS
        // now reports no backup. Either the user nuked their VSS account or
        // something is very wrong server-side. Refuse to silently recreate.
        const probeWallet = {
          vssBackupInfo: vi.fn().mockResolvedValue({ backupExists: false, backupRequired: false, serverVersion: null }),
          dispose: vi.fn().mockResolvedValue(undefined),
        } as unknown as IRgbWallet;
        const adapter: IRgbAdapter = {
          capabilities: { lightning: false },
          createWallet: vi.fn().mockResolvedValue(probeWallet),
          restoreFromVss: vi.fn().mockRejectedValue(Object.assign(new Error('not found'), { name: 'NotFoundError' })),
        };
        (globalThis as any).rgbAdapter = adapter;
        const storage = makeMemoryStorage({ [getRgbInitializedStorageKey(NETWORK_RGB_TESTNET)]: 'true' });
        const w = new RgbWallet(NETWORK_RGB_TESTNET);
        w.setSecret(MNEMONIC);
        await expect(w.init(storage)).rejects.toBeInstanceOf(RgbBackupLostError);
      });

      it('creates fresh wallet when probe says missing AND device has never initialized', async () => {
        // The genuine first-creation path — no flag set, server confirms no
        // backup. Same outcome as the old fall-back-on-missing behavior, but
        // now reached only after probe confirmation.
        const freshWallet = {
          vssBackupInfo: vi.fn().mockResolvedValue({ backupExists: false, backupRequired: false, serverVersion: null }),
          dispose: vi.fn().mockResolvedValue(undefined),
        } as unknown as IRgbWallet;
        const adapter: IRgbAdapter = {
          capabilities: { lightning: false },
          createWallet: vi.fn().mockResolvedValue(freshWallet),
          restoreFromVss: vi.fn().mockRejectedValue(Object.assign(new Error('not found'), { name: 'NotFoundError' })),
        };
        (globalThis as any).rgbAdapter = adapter;
        const storage = makeMemoryStorage();
        const w = new RgbWallet(NETWORK_RGB_TESTNET);
        w.setSecret(MNEMONIC);
        await w.init(storage);
        // Flag was set after successful init — next time, a probe-missing
        // would trigger RgbBackupLostError instead of silent fresh creation.
        expect(storage._data[getRgbInitializedStorageKey(NETWORK_RGB_TESTNET)]).toBe('true');
        // Fresh wallet was kept (not disposed) — caller will use it.
        expect(freshWallet.dispose).not.toHaveBeenCalled();
      });

      it('does not invoke the probe at all when restoreFromVss succeeds', async () => {
        // Happy path — backup exists, restore succeeds, no probe needed. The
        // RGB_INITIALIZED flag is still set on the way out so a future
        // backup-loss is detectable.
        const { adapter, sdkWallet } = installAdapter();
        const storage = makeMemoryStorage();
        const w = new RgbWallet(NETWORK_RGB_TESTNET);
        w.setSecret(MNEMONIC);
        await w.init(storage);
        expect(adapter.createWallet).not.toHaveBeenCalled();
        expect(sdkWallet.vssBackupInfo).not.toHaveBeenCalled();
        expect(storage._data[getRgbInitializedStorageKey(NETWORK_RGB_TESTNET)]).toBe('true');
      });
    });

    describe('tryBackup ledger', () => {
      it('records a successful backup: pendingMutations -> 0, lastBackupAt set, no error', async () => {
        const { sdkWallet } = installAdapter();
        const storage = makeMemoryStorage();
        const w = new RgbWallet(NETWORK_RGB_TESTNET);
        w.setSecret(MNEMONIC);
        await w.init(storage);
        // issueAssetNia triggers a critical tryBackup; the default vssBackup
        // mock resolves successfully.
        await w.issueAssetNia({ ticker: 'X', name: 'X', precision: 0, amounts: [1] });
        const status = w.getBackupStatus();
        expect(status.pendingMutations).toBe(0);
        expect(status.lastBackupAt).toBeTypeOf('number');
        expect(status.lastBackupError).toBeNull();
        expect(sdkWallet.vssBackup).toHaveBeenCalledOnce();
        // Persisted shape mirrors the in-memory state.
        const raw = storage._data[getRgbBackupStateStorageKey(NETWORK_RGB_TESTNET, 0)];
        expect(JSON.parse(raw).pendingMutations).toBe(0);
      });

      it('classifies a network-style failure and leaves pendingMutations elevated', async () => {
        // Default tryBackup (non-critical) is used by createUtxos. Force the
        // SDK call to fail; ledger should record the error and the bumped
        // counter, but not throw.
        const { sdkWallet } = installAdapter({
          vssBackup: vi.fn().mockRejectedValue(Object.assign(new Error('connect ECONNREFUSED'), { code: 'NetworkError' })),
        });
        const storage = makeMemoryStorage();
        const w = new RgbWallet(NETWORK_RGB_TESTNET);
        w.setSecret(MNEMONIC);
        await w.init(storage);
        await w.createUtxos();
        const status = w.getBackupStatus();
        expect(status.pendingMutations).toBe(1);
        expect(status.lastBackupError?.kind).toBe('network');
        expect(sdkWallet.vssBackup).toHaveBeenCalledOnce();
        // Persistence held — a force-quit here would still surface the warning.
        const raw = storage._data[getRgbBackupStateStorageKey(NETWORK_RGB_TESTNET, 0)];
        expect(JSON.parse(raw).lastBackupError.kind).toBe('network');
      });

      it('throws on critical=true backup failure (transferToken / issueAssetNia path)', async () => {
        // Caller (send-confirm) needs to know about a failed backup so it
        // can surface a "your transfer happened but backup failed" dialog.
        const issueErr = Object.assign(new Error('connect ECONNREFUSED'), { code: 'NetworkError' });
        const { sdkWallet } = installAdapter({
          vssBackup: vi.fn().mockRejectedValue(issueErr),
        });
        const storage = makeMemoryStorage();
        const w = new RgbWallet(NETWORK_RGB_TESTNET);
        w.setSecret(MNEMONIC);
        await w.init(storage);
        await expect(w.issueAssetNia({ ticker: 'X', name: 'X', precision: 0, amounts: [1] })).rejects.toBe(issueErr);
        // The actual issuance still went through on the SDK — the ledger
        // reflects that we have a pending mutation that wasn't backed up.
        expect(sdkWallet.issueAssetNia).toHaveBeenCalledOnce();
        expect(w.getBackupStatus().pendingMutations).toBe(1);
      });

      it('retryBackup clears pendingMutations and the recorded error on success', async () => {
        // Wire vssBackup to fail first, then succeed on the retry.
        const vssBackup = vi.fn().mockRejectedValueOnce(new Error('transient')).mockResolvedValueOnce(1);
        const { sdkWallet } = installAdapter({ vssBackup });
        const storage = makeMemoryStorage();
        const w = new RgbWallet(NETWORK_RGB_TESTNET);
        w.setSecret(MNEMONIC);
        await w.init(storage);
        await w.createUtxos(); // first attempt fails, ledger records it
        expect(w.getBackupStatus().pendingMutations).toBe(1);
        const ok = await w.retryBackup();
        expect(ok).toBe(true);
        expect(w.getBackupStatus().pendingMutations).toBe(0);
        expect(w.getBackupStatus().lastBackupError).toBeNull();
        expect(sdkWallet.vssBackup).toHaveBeenCalledTimes(2);
      });

      it('preserves pendingMutations across re-init by reading from persisted state', async () => {
        // A force-quit between mutation and successful backup must not
        // silently clear the warning state on next launch.
        const storage = makeMemoryStorage();
        {
          const { sdkWallet } = installAdapter({
            vssBackup: vi.fn().mockRejectedValue(new Error('boom')),
          });
          void sdkWallet;
          const w1 = new RgbWallet(NETWORK_RGB_TESTNET);
          w1.setSecret(MNEMONIC);
          await w1.init(storage);
          await w1.createUtxos();
          expect(w1.getBackupStatus().pendingMutations).toBe(1);
        }
        // Simulate fresh process: new wallet instance, same storage.
        installAdapter();
        const w2 = new RgbWallet(NETWORK_RGB_TESTNET);
        w2.setSecret(MNEMONIC);
        await w2.init(storage);
        // Counter survived the process boundary.
        expect(w2.getBackupStatus().pendingMutations).toBe(1);
      });
    });
  });
});
