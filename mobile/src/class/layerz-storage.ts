import AsyncStorage from '@react-native-async-storage/async-storage';
import { IStorage } from '@shared/types/IStorage';

export const LayerzStorage: IStorage = {
  async setItem(key: string, value: string) {
    return AsyncStorage.setItem(key, value);
  },

  async getItem(key: string): Promise<string> {
    try {
      const value = await AsyncStorage.getItem(key);
      return value || '';
    } catch {
      return '';
    }
  },
};
