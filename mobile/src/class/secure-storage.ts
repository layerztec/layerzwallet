import { IStorage } from '@shared/types/IStorage';
import * as SecureStore from 'expo-secure-store';

export const SecureStorage: IStorage = {
  async setItem(key: string, value: string) {
    // Prefer most restrictive accessibility where supported; noop on platforms not supporting options
    try {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      } as any);
    } catch (_) {
      await SecureStore.setItemAsync(key, value);
    }
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
