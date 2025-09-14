import { IStorage, STORAGE_KEY_MNEMONIC, STORAGE_KEY_EVM_XPUB } from '@shared/types/IStorage';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Promise to track if the first launch check has completed
let firstLaunchCheckPromise: Promise<void>;

// Check if this is a fresh install and clear secure data if needed
const checkAndClearOnFreshInstall = async () => {
  try {
    if (Platform.OS === 'ios') {
      // Check if user has existing EVM xpub - this indicates they're not a fresh install
      const evmXpub = await AsyncStorage.getItem(STORAGE_KEY_EVM_XPUB);
      
      if (!evmXpub) {
        // No EVM xpub found - this is a fresh install, clear secure storage
        console.log('Fresh install detected on iOS - clearing secure storage');
        await clearAllSecureData();
      } else {
        // EVM xpub exists - this is an existing user, preserve their data
        console.log('Existing user detected on iOS - preserving secure storage');
      }
    }
  } catch (error) {
    console.error('Error checking fresh install:', error);
  }
};

// Clear all secure storage data
const clearAllSecureData = async () => {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEY_MNEMONIC);
  } catch (error) {
    console.error('Error clearing secure data:', error);
  }
};

// Initialize the first launch check
firstLaunchCheckPromise = checkAndClearOnFreshInstall();

// Ensure the first launch check completes before any storage operations
const ensureFirstLaunchCheckComplete = async () => {
  await firstLaunchCheckPromise;
};

export const SecureStorage: IStorage = {
  async setItem(key: string, value: string) {
    await ensureFirstLaunchCheckComplete();
    await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  },

  async getItem(key: string): Promise<string> {
    await ensureFirstLaunchCheckComplete();
    try {
      let result = await SecureStore.getItemAsync(key);
      return result || '';
    } catch {
      return '';
    }
  },
};
