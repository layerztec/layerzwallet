import { IStorage } from '@shared/types/IStorage';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const FIRST_LAUNCH_KEY = 'FIRST_LAUNCH_AFTER_INSTALL';

// Check if this is the first launch after a fresh install and clear secure data if needed
const checkAndClearOnFreshInstall = async () => {
  try {
    const hasLaunchedBefore = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
    
    if (hasLaunchedBefore === null) {
      // This is the first launch after install
      if (Platform.OS === 'ios') {
        // On iOS, keychain data persists across app installations
        // Clear all secure storage data on first launch
        console.log('First launch detected on iOS - clearing secure storage');
        await clearAllSecureData();
      }
      
      // Mark that the app has been launched at least once
      await AsyncStorage.setItem(FIRST_LAUNCH_KEY, 'true');
    }
  } catch (error) {
    console.error('Error checking first launch:', error);
  }
};

// Clear all secure storage data
const clearAllSecureData = async () => {
  try {
    // Get all possible secure storage keys and clear them
    const keysToCheck = [
      'STORAGE_KEY_MNEMONIC',
      'STORAGE_KEY_SUB_MNEMONIC0',
      'STORAGE_KEY_SUB_MNEMONIC1',
      'STORAGE_KEY_SUB_MNEMONIC2',
      'STORAGE_KEY_SUB_MNEMONIC3',
      'STORAGE_KEY_SUB_MNEMONIC4',
      'STORAGE_KEY_SUB_MNEMONIC5',
      'STORAGE_KEY_SUB_MNEMONIC6',
      'STORAGE_KEY_SUB_MNEMONIC7',
      'STORAGE_KEY_SUB_MNEMONIC8',
      'STORAGE_KEY_SUB_MNEMONIC9',
    ];
    
    for (const key of keysToCheck) {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {
        // Key might not exist, ignore error
      }
    }
  } catch (error) {
    console.error('Error clearing secure data:', error);
  }
};

// Initialize the first launch check
checkAndClearOnFreshInstall();

export const SecureStorage: IStorage = {
  async setItem(key: string, value: string) {
    await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
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
