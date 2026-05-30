import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { Utils } from "electrobun/bun";

const STORAGE_FILE = "layerz-storage.json";

let storeCache: Record<string, string> | null = null;

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

async function writeStore(store: Record<string, string>): Promise<void> {
  storeCache = store;
  await writeFile(await storageFilePath(), JSON.stringify(store), "utf-8");
}

export const desktopStorage = {
  async getItem(key: string): Promise<string> {
    const store = await readStore();
    return store[key] ?? "";
  },

  async setItem(key: string, value: string): Promise<void> {
    const store = await readStore();
    store[key] = value;
    await writeStore(store);
  },

  async clear(): Promise<void> {
    await writeStore({});
  },
};
