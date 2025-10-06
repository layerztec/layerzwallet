import * as Application from 'expo-application';
import { Platform } from 'react-native';

export async function getDeviceIdentifier(): Promise<string> {
  const deviceId = await Platform.select({
    ios: async () => {
      const id = await Application.getIosIdForVendorAsync();
      if (!id) throw new Error('Failed to get iOS device identifier');
      return id;
    },
    android: async () => {
      const id = Application.getAndroidId();
      if (!id) throw new Error('Failed to get Android device identifier');
      return id;
    },
    default: async () => {
      throw new Error('Unsupported platform for device identifier');
    },
  })()!;

  return deviceId;
}
