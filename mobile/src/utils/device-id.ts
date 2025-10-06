import * as Application from 'expo-application';
import { Platform } from 'react-native';

export async function getDeviceIdentifier(): Promise<string> {
  const deviceId = await Platform.select({
    ios: async () => (await Application.getIosIdForVendorAsync()) || '',
    android: async () => Application.getAndroidId() || '',
    default: async () => '',
  })()!;

  return deviceId;
}
