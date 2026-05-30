import { IStorage } from "@shared/types/IStorage";

import { getDesktopRpc } from "../modules/init-electrobun";

/** File-backed storage via Bun RPC — CEF does not persist views:// localStorage on Linux. */
export const LayerzStorage: IStorage = {
  async setItem(key: string, value: string) {
    await getDesktopRpc().request.storageSetItem({ key, value });
  },

  async getItem(key: string): Promise<string> {
    return getDesktopRpc().request.storageGetItem({ key });
  },
};
