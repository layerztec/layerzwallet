import { IStorage } from '@shared/types/IStorage';
import * as SecureStore from 'expo-secure-store';

export const SecureStorage: IStorage = {
  async setItem(key: string, value: string) {
    await SecureStore.setItemAsync(key, value);
  },

  async getItem(key: string): Promise<string> {
    try {
      let result = await SecureStore.getItemAsync(key);
      return result || '';
    } catch {
      return '';
    }
  },
};
