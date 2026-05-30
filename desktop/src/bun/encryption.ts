import {
  decrypt as decryptRaw,
  encrypt as encryptRaw,
  IScryptConfig,
} from "../mainview/shared-link/modules/encryption";
import type { ICsprng } from "../mainview/shared-link/types/ICsprng";

const desktopScryptConfig: IScryptConfig = {
  N: 2 ** 17,
  r: 8,
  p: 1,
  dkLen: 32,
};

export async function encrypt(
  csprng: ICsprng,
  plaintext: string,
  password: string,
  saltValue: string,
): Promise<string> {
  return encryptRaw(
    desktopScryptConfig,
    csprng,
    plaintext,
    password,
    saltValue,
  );
}

export async function decrypt(
  encryptedData: string,
  password: string,
  saltValue: string,
): Promise<string> {
  return decryptRaw(desktopScryptConfig, encryptedData, password, saltValue);
}
