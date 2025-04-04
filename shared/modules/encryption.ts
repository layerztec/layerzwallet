import { scryptAsync } from '@noble/hashes/scrypt';
import { uint8ArrayToHex, hexToUint8Array } from './uint8array-extras';
import { ICsprng } from '../types/ICsprng';
// @ts-ignore dont want to install @types/browserify-cipher as it has incorrect definition of the func we use
import * as aes from 'browserify-cipher';
const createCipheriv = aes.createCipheriv;
const createDecipheriv = aes.createDecipheriv;

export interface IScryptConfig {
  N: number; // CPU/memory cost parameter
  r: number; // Block size parameter
  p: number; // Parallelization parameter
  dkLen: number; // Desired key length in bytes
}

/**
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
 */
export async function encrypt(scryptConfig: IScryptConfig, csprng: ICsprng, plaintext: string, password: string, saltValue: string): Promise<string> {
  const derivedKey = (await scryptAsync(normalizeString(password), saltValue, scryptConfig)) as Uint8Array;
  const initializationVector = await csprng.randomBytes(16);
  const encryptionCipher = createCipheriv('aes-256-gcm', derivedKey, initializationVector, { authTagLength: 16 });

  let ciphertextHex = encryptionCipher.update(plaintext, 'utf8', 'hex');
  ciphertextHex += encryptionCipher.final('hex');
  let authenticationTag = encryptionCipher.getAuthTag();

  // combine components into cryptogram string with format: <IV>:<Tag>:<Ciphertext>
  return [uint8ArrayToHex(initializationVector), authenticationTag.toString('hex'), ciphertextHex].join(':');
}

export async function decrypt(scryptConfig: IScryptConfig, encryptedData: string, password: string, saltValue: string): Promise<string> {
  let initializationVectorHex: string, authenticationTagHex: string, ciphertextHex: string;

  // Parse cryptogram string in format <InitializationVector>:<AuthenticationTag>:<Ciphertext>
  [initializationVectorHex, authenticationTagHex, ciphertextHex] = encryptedData.split(':');

  const derivedKey = (await scryptAsync(normalizeString(password), saltValue, scryptConfig)) as Uint8Array;

  const decryptionCipher = createDecipheriv('aes-256-gcm', derivedKey, hexToUint8Array(initializationVectorHex), { authTagLength: 16 });
  decryptionCipher.setAuthTag(hexToUint8Array(authenticationTagHex));
  let decryptedText = decryptionCipher.update(ciphertextHex, 'hex', 'utf8');
  decryptedText += decryptionCipher.final('utf8');

  return decryptedText;
}

/**
 * @see https://nodejs.org/api/crypto.html#using-strings-as-inputs-to-cryptographic-apis
 */
function normalizeString(input: string): string {
  return input.normalize('NFC');
}
