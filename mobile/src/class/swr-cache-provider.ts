import { Cache } from 'swr';
import { State } from 'swr/_internal';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * In  order to persist our cache between app launches
 * we implement our own caching mechanism.

 * Note: AsyncStorage is asynchronous, but SWR expects synchronous cache operations.
 * We're implementing a best-effort approach to handle this mismatch.
 *
 * @see https://swr.vercel.app/docs/advanced/cache
 * @see https://swr.vercel.app/docs/advanced/react-native.en-US
 */
export class SwrCacheProvider implements Cache<any> {
  private cachePrefix = 'swr-cache-v3-';
  private cache: Map<string, any> = new Map();

  constructor() {
    // Initialize cache from AsyncStorage
    this.initializeCache();
  }

  private async initializeCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((k) => k.startsWith(this.cachePrefix));

      for (const key of cacheKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          const data = JSON.parse(value);
          const originalKey = key.substring(this.cachePrefix.length);
          this.cache.set(originalKey, data);
        }
      }
    } catch (error) {
      console.error('Failed to initialize SWR cache:', error);
    }
  }

  get(key: string): State<any> | undefined {
    try {
      const data = this.cache.get(key);
      if (data) {
        return { data };
      }
    } catch (error) {
      return { error };
    }

    return {};
  }

  set(key: string, value: State<any>): void {
    if (value.data) {
      this.cache.set(key, value.data);
      // Persist to AsyncStorage asynchronously
      AsyncStorage.setItem(`${this.cachePrefix}${key}`, JSON.stringify(value.data)).catch((err) => console.error('Failed to persist SWR cache:', err));
    }
  }

  delete(key: string): void {
    this.cache.delete(key);
    // Remove from AsyncStorage asynchronously
    AsyncStorage.removeItem(`${this.cachePrefix}${key}`).catch((err) => console.error('Failed to delete from SWR cache:', err));
  }

  keys(): IterableIterator<string> {
    return this.cache.keys();
  }
}
