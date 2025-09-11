import { IStorage, STORAGE_KEY_MNEMONIC } from '@shared/types/IStorage';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const HAS_LAUNCHED_KEY = 'HAS_LAUNCHED_BEFORE';

// Promise to track if the first launch check has completed
let firstLaunchCheckPromise: Promise<void> | null = null;

// Check if this is the first launch after a fresh install and clear secure data if needed
const checkAndClearOnFreshInstall = async () => {
  try {
    const hasLaunchedBefore = await AsyncStorage.getItem(HAS_LAUNCHED_KEY);
    
    if (hasLaunchedBefore === null) {
      // This is the first launch after install
      if (Platform.OS === 'ios') {
        // On iOS, keychain data persists across app installations
        // Clear all secure storage data on first launch
        console.log('First launch detected on iOS - clearing secure storage');
        await clearAllSecureData();
      }
      
      // Mark that the app has been launched at least once
      await AsyncStorage.setItem(HAS_LAUNCHED_KEY, 'true');
    }
  } catch (error) {
    console.error('Error checking first launch:', error);
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
  if (firstLaunchCheckPromise) {
    await firstLaunchCheckPromise;
  }
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
