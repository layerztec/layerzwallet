import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { Utils } from "electrobun/bun";

const STORAGE_FILE = "layerz-storage.json";

let storeCache: Record<string, string> | null = null;

// Serialized + coalesced writer. The SWR cache persists through this store on every
// `set`/`delete`, so writes are frequent; coalescing collapses bursts into the minimum
// number of file writes, and the temp-file + rename keeps the JSON crash-safe (a partial
// write can never clobber the live file).
let flushing: Promise<void> | null = null;
let dirty = false;

async function storageFilePath(): Promise<string> {
  const dir = Utils.paths.userData;
  await mkdir(dir, { recursive: true });
  return join(dir, STORAGE_FILE);
}

async function readStore(): Promise<Record<string, string>> {
  if (storeCache) {
    return storeCache;
  }

  try {
    const raw = await readFile(await storageFilePath(), "utf-8");
    const parsed = JSON.parse(raw);
    storeCache =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, string>)
        : {};
  } catch {
    storeCache = {};
  }

  return storeCache;
}

/** Atomically persist the in-memory cache, coalescing concurrent writes into one chain. */
function flush(): Promise<void> {
  dirty = true;
  if (flushing) {
    return flushing;
  }

  flushing = (async () => {
    try {
      while (dirty) {
        dirty = false;
        const path = await storageFilePath();
        const tmp = `${path}.${process.pid}.tmp`;
        await writeFile(tmp, JSON.stringify(storeCache ?? {}), "utf-8");
        await rename(tmp, path);
      }
    } finally {
      flushing = null;
    }
  })();

  return flushing;
}

export const desktopStorage = {
  async getItem(key: string): Promise<string> {
    const store = await readStore();
    return store[key] ?? "";
  },

  async setItem(key: string, value: string): Promise<void> {
    const store = await readStore();
    store[key] = value;
    await flush();
  },

  async clear(): Promise<void> {
    await readStore();
    storeCache = {};
    await flush();
  },
};
