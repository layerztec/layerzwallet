import { decrypt as decryptRaw, encrypt as encryptRaw, IScryptConfig } from '@shared/modules/encryption';
import { ICsprng } from '@shared/types/ICsprng';

const mobileScryptConfig: IScryptConfig = { N: 2 ** 11, r: 8, p: 1, dkLen: 32 };

export async function encrypt(csprng: ICsprng, plaintext: string, password: string, saltValue: string): Promise<string> {
  return await encryptRaw(mobileScryptConfig, csprng, plaintext, password, saltValue);
}

export async function decrypt(encryptedData: string, password: string, saltValue: string): Promise<string> {
  return await decryptRaw(mobileScryptConfig, encryptedData, password, saltValue);
}
