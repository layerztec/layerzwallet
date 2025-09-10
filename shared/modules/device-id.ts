import { IStorage } from '../types/IStorage';
import { generateUUID } from './string-utils';
import { ICsprng } from '../types/ICsprng';

export const STORAGE_KEY_DEVICEID = 'STORAGE_KEY_DEVICEID';

export async function getDeviceID(secureStorage: IStorage, csprng: ICsprng): Promise<string> {
  try {
    const existingDeviceId = await secureStorage.getItem(STORAGE_KEY_DEVICEID);
    if (existingDeviceId) {
      return existingDeviceId;
    }
  } catch (_) {
    // SecureStorage error, continue to generate new ID
  }

  const newDeviceId = await generateUUID(csprng);
  await secureStorage.setItem(STORAGE_KEY_DEVICEID, newDeviceId);
  return newDeviceId;
}
