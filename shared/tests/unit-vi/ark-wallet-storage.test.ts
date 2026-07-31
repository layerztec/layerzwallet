import assert from 'assert';
import { test, vi } from 'vitest';
import { TxType, Wallet } from '@arkade-os/sdk';
import type { ArkTransaction, ExtendedCoin } from '@arkade-os/sdk';

import { ArkWallet } from '../../class/wallets/ark-wallet';
import { parseStoredTransactionList, parseStoredUtxoList, parseStoredVtxoList, stringifyTransactionList, stringifyUtxoList, stringifyVtxoList } from '../../class/wallets/ark-wallet-storage';
import { IStorage } from '../../types/IStorage';
import { NETWORK_ARK } from '../../types/networks';
import { minimalTapLeaf, minimalVtxo } from './ark-fixtures';

// Wallet.create needs a live Ark server; everything else in init() (identity
// derivation, namespace construction, recovery/restore bookkeeping) runs for
// real, so these tests exercise the exact storage keys production writes.
vi.mock('@arkade-os/sdk', async (importOriginal) => {
  const original = await importOriginal<typeof import('@arkade-os/sdk')>();
  const { makeMockArkadeSdkWallet } = await import('./ark-fixtures');
  return { ...original, Wallet: { create: vi.fn().mockResolvedValue(makeMockArkadeSdkWallet().wallet) } };
});

const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const makeCapturingStorage = () => {
  const writes: Record<string, string> = {};
  const reads: string[] = [];
  const storage: IStorage = {
    async setItem(key: string, value: string) {
      writes[key] = value;
    },
    async getItem(key: string) {
      reads.push(key);
      return writes[key] ?? '';
    },
  };
  return { storage, writes, reads };
};

/**
 * WHY THESE LITERALS ARE HARD-CODED: the storage namespace is the address of
 * every user's persisted Ark wallet state. A silent re-key (commit 485239b,
 * sanitized-URL -> sha256(serverUrl)) orphaned all previously persisted state
 * and surfaced as a user-facing balance/history loss on update. If this test
 * fails, you are re-keying the namespace: ship a data migration for existing
 * users, then update the fixture consciously.
 *
 * Format: `ark-sdk-v2:<first 16 hex chars of sha256(serverUrl)>:account_<n>`
 */
test('storage namespaces are pinned for fixed inputs', async () => {
  // defaults: https://mutinynet.arkade.sh, account 0
  const mutinynet = makeCapturingStorage();
  const w = new ArkWallet();
  w.setSecret(TEST_MNEMONIC);
  await w.init(mutinynet.storage);

  // init() completed the one-time recovery, so the flag sits under the pinned namespace...
  assert.strictEqual(mutinynet.writes['ark-sdk-v2:1e777a4f929711a7:account_0:recovery:vtxoStorageV1'], 'true');
  // ...and every read went through it too
  assert.ok(mutinynet.reads.length > 0);
  mutinynet.reads.forEach((key) => assert.ok(key.startsWith('ark-sdk-v2:1e777a4f929711a7:account_0:'), `unexpected storage key: ${key}`));

  // mainnet (https://arkade.computer), account 1
  const mainnet = makeCapturingStorage();
  const w2 = new ArkWallet();
  w2.setSecret(TEST_MNEMONIC);
  w2.setArkadeNetwork(NETWORK_ARK);
  w2.setAccountNumber(1);
  await w2.init(mainnet.storage);

  assert.strictEqual(mainnet.writes['ark-sdk-v2:2e486c179cc55ef7:account_1:recovery:vtxoStorageV1'], 'true');

  // pin the per-address suffixes too, by driving the exact repository init() handed to the SDK
  const walletRepository = (Wallet.create as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0].storage.walletRepository;
  await walletRepository.saveVtxos('addr1', []);
  await walletRepository.saveUtxos('addr1', []);
  await walletRepository.saveTransactions('addr1', []);
  await walletRepository.saveWalletState({ lastSyncTime: 1756199879000 });
  for (const suffix of ['wallet:vtxos:addr1', 'wallet:utxos:addr1', 'wallet:txs:addr1', 'wallet:state']) {
    assert.ok(`ark-sdk-v2:2e486c179cc55ef7:account_1:${suffix}` in mainnet.writes, `missing pinned key for ${suffix}`);
  }
});

// ---------------------------------------------------------------------------
// Codec compatibility. This codec is a copy of the SDK's internal
// repositories/serialization.ts; these fixtures turn drift between the two
// into a CI failure instead of silent user-data corruption.
// ---------------------------------------------------------------------------

const vtxoFixture = () => minimalVtxo({ extraWitness: [new Uint8Array([7, 7])] });

const utxoFixture = (): ExtendedCoin =>
  ({
    txid: 'b'.repeat(64),
    vout: 1,
    value: 5000,
    status: { confirmed: false },
    tapTree: new Uint8Array([4, 5, 6]),
    forfeitTapLeafScript: minimalTapLeaf(),
    intentTapLeafScript: minimalTapLeaf(),
    extraWitness: [new Uint8Array([8, 8])],
  }) as ExtendedCoin;

const txFixture = (): ArkTransaction =>
  ({
    key: { boardingTxid: '', commitmentTxid: 'c'.repeat(64), arkTxid: 'd'.repeat(64) },
    amount: 2100,
    type: TxType.TxReceived,
    settled: true,
    createdAt: 1756199879000,
    assets: [{ assetId: 'token-1', amount: 98765432109876543210n }],
  }) as unknown as ArkTransaction;

test('rows written by the current codec round-trip to the original values', () => {
  const vtxo = vtxoFixture();
  const [restoredVtxo] = parseStoredVtxoList(stringifyVtxoList([vtxo]));
  assert.strictEqual(restoredVtxo.txid, vtxo.txid);
  assert.strictEqual(restoredVtxo.createdAt.getTime(), 1756199879000);
  assert.deepEqual(Array.from(restoredVtxo.tapTree), [1, 2, 3, 255]);
  assert.deepEqual(Array.from(restoredVtxo.forfeitTapLeafScript[1]), Array.from(vtxo.forfeitTapLeafScript[1]));
  assert.deepEqual(Array.from(restoredVtxo.forfeitTapLeafScript[0].internalKey), Array.from(vtxo.forfeitTapLeafScript[0].internalKey));
  assert.deepEqual(
    restoredVtxo.extraWitness?.map((w) => Array.from(w)),
    [[7, 7]]
  );
  assert.strictEqual(restoredVtxo.assets?.[0].amount, 12345678901234567890n);

  const utxo = utxoFixture();
  const [restoredUtxo] = parseStoredUtxoList(stringifyUtxoList([utxo]));
  assert.strictEqual(restoredUtxo.txid, utxo.txid);
  assert.deepEqual(Array.from(restoredUtxo.tapTree), [4, 5, 6]);
  assert.deepEqual(Array.from(restoredUtxo.intentTapLeafScript[1]), Array.from(utxo.intentTapLeafScript[1]));
  assert.deepEqual(
    restoredUtxo.extraWitness?.map((w) => Array.from(w)),
    [[8, 8]]
  );

  const tx = txFixture();
  const [restoredTx] = parseStoredTransactionList(stringifyTransactionList([tx]));
  assert.deepEqual(restoredTx.key, tx.key);
  assert.strictEqual(restoredTx.amount, 2100);
  assert.strictEqual((restoredTx as ArkTransaction & { assets?: { amount: bigint }[] }).assets?.[0].amount, 98765432109876543210n);
});

test('rows in the SDK serialization format parse identically', () => {
  // The SDK's WalletRepositoryImpl JSON.stringify()s a spread row where
  // createdAt is still a Date, producing an ISO string; tap leaves are
  // {cb, s} hex pairs and asset amounts are strings — same as this codec
  // except for createdAt, which we store as an epoch number.
  const ownRaw = stringifyVtxoList([vtxoFixture()]);
  const sdkFormatVtxo = { ...JSON.parse(ownRaw)[0], createdAt: new Date(1756199879000).toISOString() };
  const [fromSdkRow] = parseStoredVtxoList(JSON.stringify([sdkFormatVtxo]));
  const [fromOwnRow] = parseStoredVtxoList(ownRaw);

  assert.strictEqual(fromSdkRow.createdAt.getTime(), fromOwnRow.createdAt.getTime());
  assert.deepEqual(Array.from(fromSdkRow.tapTree), Array.from(fromOwnRow.tapTree));
  assert.deepEqual(Array.from(fromSdkRow.forfeitTapLeafScript[1]), Array.from(fromOwnRow.forfeitTapLeafScript[1]));
  assert.strictEqual(fromSdkRow.assets?.[0].amount, fromOwnRow.assets?.[0].amount);

  // transactions: the SDK format matches ours exactly (string asset amounts, numeric createdAt)
  const sdkFormatTx = { ...txFixture(), assets: [{ assetId: 'token-1', amount: '98765432109876543210' }] };
  const [restoredTx] = parseStoredTransactionList(JSON.stringify([sdkFormatTx]));
  assert.strictEqual((restoredTx as ArkTransaction & { assets?: { amount: bigint }[] }).assets?.[0].amount, 98765432109876543210n);
});

test('a list containing one corrupt row still yields the valid rows', () => {
  const goodVtxoRaw = JSON.parse(stringifyVtxoList([vtxoFixture()]))[0];
  const vtxos = parseStoredVtxoList(JSON.stringify([{ txid: 'garbage', vout: 0, value: 1 }, goodVtxoRaw]));
  assert.strictEqual(vtxos.length, 1);
  assert.strictEqual(vtxos[0].txid, 'a'.repeat(64));

  const goodUtxoRaw = JSON.parse(stringifyUtxoList([utxoFixture()]))[0];
  const utxos = parseStoredUtxoList(JSON.stringify([null, { tapTree: 42 }, goodUtxoRaw]));
  assert.strictEqual(utxos.length, 1);
  assert.strictEqual(utxos[0].txid, 'b'.repeat(64));

  const goodTxRaw = JSON.parse(stringifyTransactionList([txFixture()]))[0];
  const arrayKeyTx = { ...goodTxRaw, key: [] };
  const badAssetTx = { ...goodTxRaw, key: { ...goodTxRaw.key, arkTxid: 'e'.repeat(64) }, assets: [{ assetId: 'x', amount: 'NaN-garbage' }] };
  // BigInt('') is 0n — an empty amount must be rejected as corrupt, not kept as a zero balance
  const emptyAmountTx = { ...goodTxRaw, key: { ...goodTxRaw.key, arkTxid: 'f'.repeat(64) }, assets: [{ assetId: 'x', amount: '' }] };
  const txs = parseStoredTransactionList(JSON.stringify([null, { amount: 1 }, arrayKeyTx, badAssetTx, emptyAmountTx, goodTxRaw]));
  assert.strictEqual(txs.length, 1);
  assert.strictEqual(txs[0].key.arkTxid, 'd'.repeat(64));
});
