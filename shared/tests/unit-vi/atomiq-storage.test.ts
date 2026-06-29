import { describe, expect, it } from 'vitest';

import { AtomiqChainStorage, AtomiqUnifiedStorage } from '../../services/atomiq-storage';
import { IStorage } from '../../types/IStorage';

/**
 * A real in-memory IStorage. We deliberately do NOT mock the storage adapters themselves — the point
 * is to exercise their actual query-filtering and persistence logic against a faithful key/value store.
 */
function makeMemoryStorage(): IStorage {
  const dump = new Map<string, string>();
  return {
    getItem: async (key) => dump.get(key) ?? '',
    setItem: async (key, value) => {
      dump.set(key, value);
    },
  };
}

type Row = { id: string } & Record<string, unknown>;

describe('AtomiqUnifiedStorage', () => {
  async function seeded(): Promise<{ storage: IStorage; store: AtomiqUnifiedStorage }> {
    const storage = makeMemoryStorage();
    const store = new AtomiqUnifiedStorage(storage, 'CITREA');
    await store.init();
    await store.saveAll([
      { id: 'a', type: 5, paymentHash: 'h1' },
      { id: 'b', type: 5, paymentHash: 'h2' },
      { id: 'c', type: 9, paymentHash: 'h3' },
    ]);
    return { storage, store };
  }

  const ids = (rows: unknown[]): string[] => rows.map((r) => (r as Row).id).sort();

  it('returns every row for an empty query', async () => {
    const { store } = await seeded();
    expect(ids(await store.query([]))).toEqual(['a', 'b', 'c']);
  });

  it('ANDs conditions within a group and ORs across groups', async () => {
    const { store } = await seeded();
    // (type=5 AND paymentHash=h2) OR (id=c)  →  b, c
    const rows = await store.query([
      [
        { key: 'type', value: 5 },
        { key: 'paymentHash', value: 'h2' },
      ],
      [{ key: 'id', value: 'c' }],
    ]);
    expect(ids(rows)).toEqual(['b', 'c']);
  });

  it('returns nothing when an AND-group has a non-matching condition', async () => {
    const { store } = await seeded();
    // type=5 matches a,b but paymentHash=h3 matches none of those → empty
    expect(
      await store.query([
        [
          { key: 'type', value: 5 },
          { key: 'paymentHash', value: 'h3' },
        ],
      ])
    ).toHaveLength(0);
  });

  it('treats an array condition value as an OR set (includes)', async () => {
    const { store } = await seeded();
    const rows = await store.query([[{ key: 'id', value: ['a', 'c', 'missing'] }]]);
    expect(ids(rows)).toEqual(['a', 'c']);
  });

  it('upserts by id (no duplicates) and persists across instances', async () => {
    const { storage, store } = await seeded();
    await store.save({ id: 'b', type: 5, paymentHash: 'CHANGED' });

    // A brand-new instance over the same backing store must observe the update, not a duplicate row.
    const reopened = new AtomiqUnifiedStorage(storage, 'CITREA');
    await reopened.init();
    const all = await reopened.query([]);
    expect(all).toHaveLength(3);
    expect((all.find((r) => (r as Row).id === 'b') as Row).paymentHash).toBe('CHANGED');
  });

  it('removeAll deletes only the listed ids', async () => {
    const { store } = await seeded();
    await store.removeAll([{ id: 'a' }, { id: 'c' }]);
    expect(ids(await store.query([]))).toEqual(['b']);
  });

  it('isolates rows by container name', async () => {
    const storage = makeMemoryStorage();
    const citrea = new AtomiqUnifiedStorage(storage, 'CITREA');
    const other = new AtomiqUnifiedStorage(storage, 'OTHER');
    await citrea.saveAll([{ id: 'a' }]);
    expect(await other.query([])).toHaveLength(0);
  });
});

describe('AtomiqChainStorage', () => {
  // A minimal StorageObject: round-trips through serialize() / the (data) => T constructor.
  class FakeHeader {
    constructor(public data: { hash: string; height: number }) {}
    serialize() {
      return this.data;
    }
  }

  it('persists serialized objects and rebuilds typed instances on reload', async () => {
    const storage = makeMemoryStorage();
    const store = new AtomiqChainStorage<FakeHeader>(storage, 'btc-headers');
    await store.init();
    await store.saveData('h1', new FakeHeader({ hash: 'h1', height: 1 }));
    await store.saveDataArr([{ id: 'h2', object: new FakeHeader({ hash: 'h2', height: 2 }) }]);

    // Reopen from the same store: init() reads the serialized blob, loadData() reconstructs via the ctor.
    const reopened = new AtomiqChainStorage<FakeHeader>(storage, 'btc-headers');
    await reopened.init();
    const loaded = await reopened.loadData(FakeHeader);
    expect(loaded.every((h) => h instanceof FakeHeader)).toBe(true);
    expect(loaded.map((h) => h.data.height).sort()).toEqual([1, 2]);
  });

  it('removes entries individually and in bulk', async () => {
    const storage = makeMemoryStorage();
    const store = new AtomiqChainStorage<FakeHeader>(storage, 'btc-headers');
    await store.init();
    await store.saveDataArr([
      { id: 'h1', object: new FakeHeader({ hash: 'h1', height: 1 }) },
      { id: 'h2', object: new FakeHeader({ hash: 'h2', height: 2 }) },
      { id: 'h3', object: new FakeHeader({ hash: 'h3', height: 3 }) },
    ]);
    await store.removeData('h1');
    await store.removeDataArr(['h3']);

    const reopened = new AtomiqChainStorage<FakeHeader>(storage, 'btc-headers');
    await reopened.init();
    expect((await reopened.loadData(FakeHeader)).map((h) => h.data.hash)).toEqual(['h2']);
  });
});
