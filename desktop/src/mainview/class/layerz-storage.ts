import { IStorage } from '@shared/types/IStorage';

import { DesktopMessageType } from '../../shared/desktop-messages';
import { Messenger } from '../modules/messenger';

/** File-backed storage via Bun RPC — CEF does not persist views:// localStorage on Linux. */
export const LayerzStorage: IStorage = {
  async setItem(key: string, value: string) {
    await Messenger.send(DesktopMessageType.STORAGE_SET_ITEM, [key, value]);
  },

  async getItem(key: string): Promise<string> {
    return Messenger.send(DesktopMessageType.STORAGE_GET_ITEM, [key]);
  },
};
