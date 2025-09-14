import { IStorage, STORAGE_KEY_MNEMONIC, STORAGE_KEY_EVM_XPUB, STORAGE_KEY_ACCEPTED_TOS } from '@shared/types/IStorage';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const HAS_LAUNCHED_KEY = 'HAS_LAUNCHED_BEFORE';

// Promise to track if the first launch check has completed
let firstLaunchCheckPromise: Promise<void>;

// Check if user has existing data that indicates they're not a fresh install
const checkForExistingUserData = async (): Promise<boolean> => {
  try {
    // Check for key indicators that user has existing data
    // These are stored in different storage mechanisms:
    
    // 1. Check AsyncStorage for wallet-related data
    const evmXpub = await AsyncStorage.getItem(STORAGE_KEY_EVM_XPUB);
    const acceptedTos = await AsyncStorage.getItem(STORAGE_KEY_ACCEPTED_TOS);
    
    // 2. Check SecureStorage for mnemonic (this is the most critical data)
    let hasMnemonic = false;
    try {
      const mnemonic = await SecureStore.getItemAsync(STORAGE_KEY_MNEMONIC);
      hasMnemonic = !!mnemonic;
    } catch (error) {
      // SecureStore might throw if key doesn't exist, that's fine
      hasMnemonic = false;
    }
    
    // If any of these exist, user has existing data
    const hasExistingData = !!(evmXpub || acceptedTos || hasMnemonic);
    
    if (hasExistingData) {
      console.log('Existing user data found:', {
        hasEvmXpub: !!evmXpub,
        hasAcceptedTos: !!acceptedTos,
        hasMnemonic
      });
    }
    
    return hasExistingData;
  } catch (error) {
    console.error('Error checking for existing user data:', error);
    // If we can't check, err on the side of caution and assume existing user
    return true;
  }
};

// Check if this is the first launch after a fresh install and clear secure data if needed
const checkAndClearOnFreshInstall = async () => {
  try {
    const hasLaunchedBefore = await AsyncStorage.getItem(HAS_LAUNCHED_KEY);

    if (hasLaunchedBefore === null) {
      // This might be the first launch after install, but we need to check if user has existing data
      // to avoid clearing storage for existing users upgrading to this version
      
      if (Platform.OS === 'ios') {
        // Check if user already has existing data that indicates they're not a fresh install
        const hasExistingData = await checkForExistingUserData();
        
        if (!hasExistingData) {
          // This is truly a fresh install - clear all secure storage data
          console.log('Fresh install detected on iOS - clearing secure storage');
          await clearAllSecureData();
        } else {
          // This is an existing user upgrading to this version - don't clear their data
          console.log('Existing user detected on iOS - preserving secure storage');
        }
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
