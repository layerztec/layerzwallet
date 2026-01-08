/**
 * Using Chrome Extension-approved way to store data
 *
 * @see https://developer.chrome.com/docs/extensions/reference/api/storage
 */
import { IStorage } from '@shared/types/IStorage';

export const LayerzStorage: IStorage = {
  async setItem(key: string, value: string) {
    return chrome.storage.local.set({ [key]: value });
  },

  async getItem(key: string): Promise<string> {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => {
        resolve(result[key] as string);
      });
    });
  },
};
