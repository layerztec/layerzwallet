import { IStorage } from "@shared/types/IStorage";

import { getDesktopRpc } from "../modules/init-electrobun";

/** Encrypted-at-rest secrets via Bun RPC (separate from LayerzStorage). */
export const SecureStorage: IStorage = {
  async setItem(key: string, value: string) {
    await getDesktopRpc().request.secureStorageSetItem({ key, value });
  },

  async getItem(key: string): Promise<string> {
    return getDesktopRpc().request.secureStorageGetItem({ key });
  },
};
