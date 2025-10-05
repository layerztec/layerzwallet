import * as Application from 'expo-application';
import { Platform } from 'react-native';

/**
 * Gets a unique device identifier for Bugsnag tracking
 * Uses platform-specific stable device identifiers:
 * - iOS: IDFV (Identifier for Vendor)
 * - Android: ANDROID_ID
 * - Web/fallback: Generated UUID
 */
export async function getDeviceIdentifier(): Promise<string> {
  try {
    if (Platform.OS === 'ios') {
      const idfv = await Application.getIosIdForVendorAsync();
      if (idfv) {
        return idfv;
      }
    } else if (Platform.OS === 'android') {
      const androidId = Application.getAndroidId();
      if (androidId) {
        return androidId;
      }
    }

    // Fallback for web or if platform ID is unavailable
    return crypto.randomUUID ? crypto.randomUUID() : generateFallbackUUID();
  } catch (error) {
    console.error('Error getting device identifier:', error);
    // Fallback to a random UUID if platform API fails
    return crypto.randomUUID ? crypto.randomUUID() : generateFallbackUUID();
  }
}

/**
 * Fallback UUID v4 generator (only used if platform APIs fail)
 */
function generateFallbackUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
