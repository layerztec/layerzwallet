import { Cache } from 'swr';
import { State } from 'swr/_internal';
import { serialize, deserialize } from '@shared/class/swr-cache-serializer';

/**
 * Since every time user opens extension's Popup its treated like a brand-new launch with a brand-new context,
 * built-in SWR's caching mechanism is rendered moot (because it defaults to javascript's `Map`), so in order
 * for SWR to do its caching we implement our own caching mechanism.
 * Using `localStorage` because it works in sync way, and SWR docs don't mention whether cache provider's implementation
 * can be async.
 * Plus it's not that important data to put in a more reliable `chrome.storage.local`
 *
 * @see https://swr.vercel.app/docs/advanced/cache
 */
export class SwrCacheProvider implements Cache<any> {
  private cachePrefix = 'cache-v6-';
  private cache = new Map();

  constructor() {
    // Initialize cache from localStorage
    this.initializeCache();
  }

  private initializeCache(): void {
    try {
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter((k) => k.startsWith(this.cachePrefix));

      for (const key of cacheKeys) {
        const value = localStorage.getItem(key);
        if (value) {
          const data = deserialize(value);
          const originalKey = key.substring(this.cachePrefix.length);
          this.cache.set(originalKey, data);
        }
      }
    } catch (error) {
      console.error('Failed to initialize SWR cache:', error);
    }
  }

  get(key: string): State<any> | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: State<any>): void {
    this.cache.set(key, value);
    // Persist to localStorage
    localStorage.setItem(`${this.cachePrefix}${key}`, serialize(value));
  }

  delete(key: string): void {
    this.cache.delete(key);
    // Remove from localStorage
    localStorage.removeItem(`${this.cachePrefix}${key}`);
  }

  keys(): IterableIterator<string> {
    return this.cache.keys();
  }
}
