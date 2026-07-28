import assert from 'assert';
import { test, vi } from 'vitest';
import { ArkTransaction, TxType } from '@arkade-os/sdk';
import type { ExtendedVirtualCoin } from '@arkade-os/sdk';

import { ArkWallet } from '../../class/wallets/ark-wallet';
import { deserializeVtxo, parseStoredTransactionList, parseStoredVtxoList, serializeVtxo, stringifyVtxoList } from '../../class/wallets/ark-wallet-storage';
import { IStorage } from '../../types/IStorage';
import { NETWORK_ARK } from '../../types/networks';
import { makeMockArkadeSdkWallet } from './ark-fixtures';
import { DeepPartial } from '../../class/wallets/types';

const minimalTapLeaf = (): ExtendedVirtualCoin['forfeitTapLeafScript'] => {
  const internalKey = new Uint8Array(32).fill(9);
  const cb = { version: 192, internalKey, merklePath: [] as Uint8Array[] };
  const script = new Uint8Array([0x51, 0x20, ...internalKey]);
  return [cb, script];
};

const minimalVtxo = (overrides: Partial<ExtendedVirtualCoin> = {}): ExtendedVirtualCoin =>
  ({
    txid: 'a'.repeat(64),
    vout: 0,
    value: 2100,
    createdAt: new Date(1756199879000),
    tapTree: new Uint8Array([1, 2, 3, 255]),
    forfeitTapLeafScript: minimalTapLeaf(),
    intentTapLeafScript: minimalTapLeaf(),
    script: '5120' + '00'.repeat(32),
    status: { confirmed: true, block_time: 1756199879 },
    virtualStatus: { state: 'preconfirmed', commitmentTxIds: [] },
    isSpent: false,
    isUnrolled: false,
    isRecoverable: false,
    isSwept: false,
    isPreconfirmed: true,
    isPending: false,
    isLeaf: false,
    settledBy: undefined,
    arkTxId: undefined,
    assets: [{ assetId: 'token-1', amount: 12345678901234567890n }],
    ...overrides,
  }) as ExtendedVirtualCoin;

test('ark vtxo storage round-trips SDK-shaped fields', () => {
  const vtxo = minimalVtxo();
  const stored = serializeVtxo(vtxo);
  const restored = deserializeVtxo(stored);

  assert.ok(restored.createdAt instanceof Date);
  assert.strictEqual(restored.createdAt.getTime(), 1756199879000);
  assert.ok(restored.tapTree instanceof Uint8Array);
  assert.deepEqual(Array.from(restored.tapTree), [1, 2, 3, 255]);
  assert.ok(Array.isArray(restored.forfeitTapLeafScript));
  assert.ok(restored.forfeitTapLeafScript[1] instanceof Uint8Array);
  assert.strictEqual(typeof restored.assets?.[0].amount, 'bigint');
  assert.strictEqual(restored.assets?.[0].amount, 12345678901234567890n);
});

test('ark vtxo storage parses legacy plain-JSON cache rows', () => {
  const tapLeaf = minimalTapLeaf();
  const legacyRow = {
    ...minimalVtxo({ assets: undefined }),
    createdAt: '2026-03-15T22:46:00.000Z',
    tapTree: Object.fromEntries([...minimalVtxo().tapTree.entries()]),
    forfeitTapLeafScript: [
      {
        version: tapLeaf[0].version,
        internalKey: Object.fromEntries([...tapLeaf[0].internalKey.entries()]),
        merklePath: tapLeaf[0].merklePath.map((p) => Object.fromEntries([...p.entries()])),
      },
      Object.fromEntries([...tapLeaf[1].entries()]),
    ],
    intentTapLeafScript: [
      {
        version: tapLeaf[0].version,
        internalKey: Object.fromEntries([...tapLeaf[0].internalKey.entries()]),
        merklePath: tapLeaf[0].merklePath.map((p) => Object.fromEntries([...p.entries()])),
      },
      Object.fromEntries([...tapLeaf[1].entries()]),
    ],
  };

  const parsed = parseStoredVtxoList(JSON.stringify([legacyRow]));
  assert.strictEqual(parsed.length, 1);
  assert.ok(parsed[0].createdAt instanceof Date);
  assert.strictEqual(typeof parsed[0].createdAt.getTime(), 'number');
  assert.ok(!Number.isNaN(parsed[0].createdAt.getTime()));
  assert.ok(parsed[0].tapTree instanceof Uint8Array);
});

test('ark vtxo storage drops rows that cannot be coerced', () => {
  const parsed = parseStoredVtxoList(JSON.stringify([{ txid: 'bad', vout: 0, value: 1 }]));
  assert.deepEqual(parsed, []);
});

test('persisted vtxo list uses SDK hex encoding', () => {
  const vtxo = minimalVtxo();
  const raw = JSON.parse(stringifyVtxoList([vtxo]))[0];

  assert.strictEqual(typeof raw.tapTree, 'string');
  assert.strictEqual(typeof raw.forfeitTapLeafScript.cb, 'string');
  assert.strictEqual(typeof raw.forfeitTapLeafScript.s, 'string');
  assert.strictEqual(typeof raw.createdAt, 'number');

  const loaded = parseStoredVtxoList(stringifyVtxoList([vtxo]));
  assert.strictEqual(loaded.length, 1);
  assert.strictEqual(loaded[0].createdAt.getTime(), vtxo.createdAt.getTime());
});

test('ark transaction storage keeps valid rows when the list has corrupt entries', () => {
  const good = {
    key: { boardingTxid: '', commitmentTxid: 'c'.repeat(64), arkTxid: 'a'.repeat(64) },
    amount: 2100,
    type: TxType.TxReceived,
    settled: true,
    createdAt: 1756199879000,
  };
  const missingKey = { amount: 100, type: TxType.TxSent, settled: true, createdAt: 1756199879000 };
  const arrayKey = { ...good, key: [] };
  const badAsset = { ...good, key: { ...good.key, arkTxid: 'b'.repeat(64) }, assets: [{ assetId: 'token-1', amount: 'not-a-number' }] };
  const emptyAmount = { ...good, key: { ...good.key, arkTxid: 'e'.repeat(64) }, assets: [{ assetId: 'token-1', amount: '' }] };

  const parsed = parseStoredTransactionList(JSON.stringify([null, missingKey, arrayKey, badAsset, emptyAmount, good]));

  assert.strictEqual(parsed.length, 1);
  assert.strictEqual(parsed[0].amount, 2100);
  assert.strictEqual(parsed[0].key.arkTxid, 'a'.repeat(64));
});

/** ArkWallet with mocked SDK objects and a fake NamespacedStorage, for testing the init-time bootstrap sequence. */
const makeBootstrapHarness = (persisted: Record<string, unknown>) => {
  const w = new ArkWallet();
  const { wallet, manager } = makeMockArkadeSdkWallet();
  (w as any)._wallet = wallet;
  (w as any)._manager = manager;
  const namespacedStorage = {
    readJson: async (key: string, fallback: unknown) => (key in persisted ? persisted[key] : fallback),
    writeJson: async (key: string, value: unknown) => {
      persisted[key] = value;
    },
    clearCoinCacheForAddresses: async () => {},
  };
  const walletRepository = {
    getTrackedAddresses: async () => (persisted['wallet:addresses'] as string[]) ?? [],
    getWalletState: async () => persisted['wallet:state'] ?? null,
  };
  // the boolean is read through the real gate, exactly like init() does before Wallet.create
  const bootstrap = async () => (w as any)._bootstrapWalletState(namespacedStorage, walletRepository, await (w as any)._needsBootstrap(walletRepository));
  return { restore: wallet.restore, persisted, bootstrap };
};

test('one-time VTXO recovery flag is only persisted after a successful restore', async () => {
  const { restore, persisted, bootstrap } = makeBootstrapHarness({});
  restore.mockRejectedValueOnce(new Error('indexer down'));

  // restore() fails: the wipe must stay unflagged so the next boot retries it
  await bootstrap();
  assert.strictEqual(persisted['recovery:vtxoStorageV1'], undefined);

  // restore() succeeds: recovery is complete and must not run again
  await bootstrap();
  assert.strictEqual(persisted['recovery:vtxoStorageV1'], true);
});

test('steady-state boots skip the full indexer restore, empty namespaces still bootstrap', async () => {
  // recovery already done + tracked addresses + wallet state: no restore on boot
  const steady = makeBootstrapHarness({
    'recovery:vtxoStorageV1': true,
    'wallet:addresses': ['ark1qsomeaddress'],
    'wallet:state': { lastSyncTime: 1756199879000 },
  });
  await steady.bootstrap();
  assert.strictEqual(steady.restore.mock.calls.length, 0);

  // recovery already done but the namespace never finished a sync: restore must run
  const wiped = makeBootstrapHarness({ 'recovery:vtxoStorageV1': true });
  await wiped.bootstrap();
  assert.strictEqual(wiped.restore.mock.calls.length, 1);
});

const _cache: Record<string, string> = {};
const storageMock: IStorage = {
  async setItem(key: string, value: string) {
    _cache[key] = value;
  },

  async getItem(key: string) {
    return _cache[key];
  },
};

test('ark mainnet can getCommonTransactions', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    console.warn('TEST_MNEMONIC not set, skipping');
    context.skip();
    return;
  }

  const w = new ArkWallet();
  w.setSecret(process.env.TEST_MNEMONIC);
  w.setArkadeNetwork(NETWORK_ARK);
  await w.init(storageMock);

  const transfers: DeepPartial<ArkTransaction>[] = [
    {
      amount: 100,
      createdAt: 1756199879000,
      key: { arkTxid: 'c08e5661587fa741aea8d4eb0be3b400aae75cee18b0e0afa70b9ba41d9ca3be', boardingTxid: '', commitmentTxid: 'fdfe123c8d87e82c81d1e76141684f6e2041a85c5f2fe403982a7bca523f74ff' },
      settled: true,
      type: TxType.TxSent,
    },
    {
      amount: 2100,
      createdAt: 1755786091000,
      key: { arkTxid: '5a41fdc280352cab91fef62a1f407a0c8559ecffb2f85bea1970b72eaf4d6058', boardingTxid: '', commitmentTxid: '44b0e7852490eba4ec6d19fff042e0191078c6ce67b38f99e200632d5be1622a' },
      settled: true,
      type: TxType.TxReceived,
    },
  ];

  (w as any)._wallet = {
    getTransactionHistory: vi.fn().mockImplementation(() => {
      return transfers as ArkTransaction[];
    }),
    assetManager: {
      getAssetDetails: vi.fn().mockResolvedValue({ metadata: {} }),
    },
  };

  const transactions = await w.getCommonTransactions();
  assert.deepEqual(transactions, [
    {
      amount: 100,
      direction: 'send',
      network: NETWORK_ARK,
      timestamp: 1756199879,
      tokenTransfers: [],
      txid: 'c08e5661587fa741aea8d4eb0be3b400aae75cee18b0e0afa70b9ba41d9ca3be',
      status: 'confirmed',
      confirmations: 1,
    },
    {
      amount: 2100,
      direction: 'receive',
      network: NETWORK_ARK,
      timestamp: 1755786091,
      tokenTransfers: [],
      txid: '5a41fdc280352cab91fef62a1f407a0c8559ecffb2f85bea1970b72eaf4d6058',
      status: 'confirmed',
      confirmations: 1,
    },
  ]);
});
