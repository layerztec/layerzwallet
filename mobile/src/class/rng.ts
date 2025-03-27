/**
 * @fileOverview creates an rng module that will bring all calls to 'crypto'
 * into one place to try and prevent mistakes when touching the crypto code.
 */
import * as Crypto from 'expo-crypto';
import { ICsprng } from '../../../shared/types/ICsprng';

export const Csprng: ICsprng = {
  async randomBytes(size: number): Promise<Uint8Array> {
    return await Crypto.getRandomBytesAsync(size);
  },
};
