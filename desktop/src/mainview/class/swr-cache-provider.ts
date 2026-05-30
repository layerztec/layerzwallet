import { Cache } from "swr";
import { State } from "swr/_internal";
import { serialize, deserialize } from "@shared/class/swr-cache-serializer";

import { LayerzStorage } from "./layerz-storage";

const CACHE_INDEX_KEY = "swr-cache-v6-index";
const cachePrefix = "swr-cache-v6-";

/**
 * Persists SWR cache via LayerzStorage RPC — CEF does not persist views:// localStorage on Linux.
 * SWR expects synchronous cache ops; persistence is best-effort async (same pattern as mobile AsyncStorage).
 *
 * @see https://swr.vercel.app/docs/advanced/cache
 */
export class SwrCacheProvider implements Cache<any> {
  private cache = new Map<string, State<any>>();
  private indexKeys = new Set<string>();

  constructor() {
    void this.initializeCache();
  }

  private storageKey(key: string): string {
    return `${cachePrefix}${key}`;
  }

  private async initializeCache(): Promise<void> {
    try {
      const indexRaw = await LayerzStorage.getItem(CACHE_INDEX_KEY);
      if (!indexRaw) {
        return;
      }

      const keys: string[] = JSON.parse(indexRaw);
      for (const storageKey of keys) {
        if (!storageKey.startsWith(cachePrefix)) {
          continue;
        }
        const value = await LayerzStorage.getItem(storageKey);
        if (value) {
          const originalKey = storageKey.substring(cachePrefix.length);
          this.cache.set(originalKey, deserialize(value));
          this.indexKeys.add(storageKey);
        }
      }
    } catch (error) {
      console.error("Failed to initialize SWR cache:", error);
    }
  }

  private persistIndex(): void {
    void LayerzStorage.setItem(
      CACHE_INDEX_KEY,
      JSON.stringify([...this.indexKeys]),
    ).catch((err) => console.error("Failed to persist SWR cache index:", err));
  }

  get(key: string): State<any> | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: State<any>): void {
    this.cache.set(key, value);
    const storageKey = this.storageKey(key);
    this.indexKeys.add(storageKey);
    this.persistIndex();
    void LayerzStorage.setItem(storageKey, serialize(value)).catch((err) =>
      console.error("Failed to persist SWR cache:", err),
    );
  }

  delete(key: string): void {
    this.cache.delete(key);
    const storageKey = this.storageKey(key);
    this.indexKeys.delete(storageKey);
    this.persistIndex();
    void LayerzStorage.setItem(storageKey, "").catch((err) =>
      console.error("Failed to delete from SWR cache:", err),
    );
  }

  keys(): IterableIterator<string> {
    return this.cache.keys();
  }
}
