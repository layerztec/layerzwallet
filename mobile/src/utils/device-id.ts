import * as Application from 'expo-application';
import { Platform } from 'react-native';

export async function getDeviceIdentifier(): Promise<string> {
  if (Platform.OS === 'ios') {
    const id = await Application.getIosIdForVendorAsync();
    if (!id) throw new Error('Failed to get iOS device identifier');
    return id;
  }

  if (Platform.OS === 'android') {
    const id = Application.getAndroidId();
    if (!id) throw new Error('Failed to get Android device identifier');
    return id;
  }

  throw new Error('Unsupported platform for device identifier');
}
