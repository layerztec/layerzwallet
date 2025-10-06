import * as Application from 'expo-application';
import { Platform } from 'react-native';

export async function getDeviceIdentifier(): Promise<string> {
  try {
    const deviceId = await Platform.select({
      ios: async () => await Application.getIosIdForVendorAsync(),
      android: async () => Application.getAndroidId(),
      default: async () => null,
    })();

    if (deviceId) {
      return deviceId;
    }

    return crypto.randomUUID ? crypto.randomUUID() : generateFallbackUUID();
  } catch (error) {
    console.error('Error getting device identifier:', error);
    return crypto.randomUUID ? crypto.randomUUID() : generateFallbackUUID();
  }
}

function generateFallbackUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
