import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { uint8ArrayToHex } from "../mainview/shared-link/modules/uint8array-extras";
import { Utils } from "electrobun/bun";

import { Csprng } from "./csprng";
import { decrypt, encrypt } from "./encryption";

const SECURE_STORAGE_FILE = "layerz-secure-storage.enc";
const DEVICE_KEY_FILE = "layerz-device.key";
/** Scrypt salt for encrypting the secure-store blob (not the per-user mnemonic salt). */
const SECURE_STORAGE_SCRYPT_SALT = "com.layerzwallet.desktop/secure-storage";

let storeCache: Record<string, string> | null = null;

async function userDataDir(): Promise<string> {
  const dir = Utils.paths.userData;
  await mkdir(dir, { recursive: true });
  return dir;
}

async function deviceKeyMaterial(): Promise<string> {
  const path = join(await userDataDir(), DEVICE_KEY_FILE);
  try {
    const key = (await readFile(path, "utf-8")).trim();
    if (key.length >= 32) {
      return key;
    }
  } catch {
    // generate below
  }

  const key = uint8ArrayToHex(await Csprng.randomBytes(32));
  await writeFile(path, key, { mode: 0o600 });
  try {
    await chmod(path, 0o600);
  } catch {
    // best-effort on platforms that support it
  }
  return key;
}

async function secureStoragePath(): Promise<string> {
  return join(await userDataDir(), SECURE_STORAGE_FILE);
}

async function readStore(): Promise<Record<string, string>> {
  if (storeCache) {
    return storeCache;
  }

  try {
    const enc = (await readFile(await secureStoragePath(), "utf-8")).trim();
    const keyMaterial = await deviceKeyMaterial();
    const parsed = JSON.parse(
      await decrypt(enc, keyMaterial, SECURE_STORAGE_SCRYPT_SALT),
    );
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
  const keyMaterial = await deviceKeyMaterial();
  const enc = await encrypt(
    Csprng,
    JSON.stringify(store),
    keyMaterial,
    SECURE_STORAGE_SCRYPT_SALT,
  );
  const path = await secureStoragePath();
  await writeFile(path, enc, { mode: 0o600 });
  try {
    await chmod(path, 0o600);
  } catch {
    // best-effort
  }
}

/** Encrypted-at-rest secrets store (mnemonic, device id, …). Lives in the Bun process only. */
export const desktopSecureStorage = {
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
