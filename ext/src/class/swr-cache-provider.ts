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

  get(key: string): State<any> | undefined {
    try {
      const value = localStorage.getItem(key.startsWith(this.cachePrefix) ? key : `${this.cachePrefix}${key}`);
      if (value) {
        return deserialize(value);
      }
    } catch (error) {
      return undefined;
    }
  }

  set(key: string, value: State<any>): void {
    localStorage.setItem(`${this.cachePrefix}${key}`, serialize(value));
  }

  delete(key: string): void {
    localStorage.removeItem(`${this.cachePrefix}${key}`);
  }

  keys(): IterableIterator<string> {
    const that = this;
    function* generator() {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(that.cachePrefix)) {
          yield key;
        }
      }
    }
    return generator();
  }
}
