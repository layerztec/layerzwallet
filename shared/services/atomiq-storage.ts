import type { IStorageManager, IUnifiedStorage, QueryParams, StorageObject, UnifiedStorageCompositeIndexes, UnifiedStorageIndexes, UnifiedStoredObject } from '@atomiqlabs/sdk';

import { IStorage } from '../types/IStorage';

/**
 * Storage adapters that back the Atomiq SDK on top of our platform-agnostic {@link IStorage}.
 *
 * The SDK defaults to IndexedDB / localStorage, which don't exist on React Native (and aren't
 * desirable on the extension/desktop either). Providing these keeps a single storage backend
 * across every platform. Swap/header volumes are tiny, so each container is just a JSON blob
 * loaded into memory and filtered in JS.
 */

const PREFIX = 'ATOMIQ_STORAGE';

function safeParse<T>(raw: string, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Key-value chain storage (e.g. bitcoin light-client headers). Mirrors the SDK's LocalStorageManager. */
export class AtomiqChainStorage<T extends StorageObject> implements IStorageManager<T> {
  data: { [key: string]: T } = {};
  private rawData: { [key: string]: any } = {};
  private readonly key: string;

  constructor(
    private storage: IStorage,
    name: string
  ) {
    this.key = `${PREFIX}:chain:${name}`;
  }

  async init(): Promise<void> {
    this.rawData = safeParse(await this.storage.getItem(this.key), {} as Record<string, any>);
  }

  async saveData(hash: string, object: T): Promise<void> {
    this.rawData[hash] = object.serialize();
    this.data[hash] = object;
    await this.persist();
  }

  async saveDataArr(values: { id: string; object: T }[]): Promise<void> {
    for (const { id, object } of values) {
      this.rawData[id] = object.serialize();
      this.data[id] = object;
    }
    await this.persist();
  }

  async removeData(hash: string): Promise<void> {
    delete this.rawData[hash];
    delete this.data[hash];
    await this.persist();
  }

  async removeDataArr(hashArr: string[]): Promise<void> {
    for (const hash of hashArr) {
      delete this.rawData[hash];
      delete this.data[hash];
    }
    await this.persist();
  }

  async loadData(type: new (data: any) => T): Promise<T[]> {
    const result: T[] = [];
    for (const hash of Object.keys(this.rawData)) {
      const obj = new type(this.rawData[hash]);
      this.data[hash] = obj;
      result.push(obj);
    }
    return result;
  }

  private async persist(): Promise<void> {
    await this.storage.setItem(this.key, JSON.stringify(this.rawData));
  }
}

/** Swap storage. The whole (tiny) table is loaded and queried in JS, avoiding any index machinery. */
export class AtomiqUnifiedStorage implements IUnifiedStorage<UnifiedStorageIndexes, UnifiedStorageCompositeIndexes> {
  private readonly key: string;

  constructor(
    private storage: IStorage,
    name: string
  ) {
    this.key = `${PREFIX}:swaps:${name}`;
  }

  async init(): Promise<void> {
    /* No indexes needed — queries filter in memory. */
  }

  async query(params: Array<Array<QueryParams>>): Promise<UnifiedStoredObject[]> {
    const rows = await this.load();
    if (!params || params.length === 0) return rows;
    // params is an OR of AND-groups: [[a, b], [c]] => (a AND b) OR c
    return rows.filter((row) => params.some((andGroup) => andGroup.every((cond) => matches(row, cond))));
  }

  async save(value: UnifiedStoredObject): Promise<void> {
    await this.saveAll([value]);
  }

  async saveAll(values: UnifiedStoredObject[]): Promise<void> {
    const rows = await this.load();
    for (const value of values) {
      const idx = rows.findIndex((r) => r.id === value.id);
      if (idx >= 0) rows[idx] = value;
      else rows.push(value);
    }
    await this.persist(rows);
  }

  async remove(value: UnifiedStoredObject): Promise<void> {
    await this.removeAll([value]);
  }

  async removeAll(values: UnifiedStoredObject[]): Promise<void> {
    const ids = new Set(values.map((v) => v.id));
    await this.persist((await this.load()).filter((r) => !ids.has(r.id)));
  }

  private async load(): Promise<UnifiedStoredObject[]> {
    return safeParse(await this.storage.getItem(this.key), [] as UnifiedStoredObject[]);
  }

  private async persist(rows: UnifiedStoredObject[]): Promise<void> {
    await this.storage.setItem(this.key, JSON.stringify(rows));
  }
}

function matches(row: UnifiedStoredObject, cond: QueryParams): boolean {
  const value = row[cond.key];
  return Array.isArray(cond.value) ? cond.value.includes(value) : value === cond.value;
}
