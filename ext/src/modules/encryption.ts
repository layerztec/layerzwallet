import { decrypt as decryptRaw, encrypt as encryptRaw, IScryptConfig } from '@shared/modules/encryption';
import { ICsprng } from '@shared/types/ICsprng';

const extScryptConfig: IScryptConfig = { N: 2 ** 17, r: 8, p: 1, dkLen: 32 };

export async function encrypt(csprng: ICsprng, plaintext: string, password: string, saltValue: string): Promise<string> {
  return await encryptRaw(extScryptConfig, csprng, plaintext, password, saltValue);
}

export async function decrypt(encryptedData: string, password: string, saltValue: string): Promise<string> {
  return await decryptRaw(extScryptConfig, encryptedData, password, saltValue);
}
