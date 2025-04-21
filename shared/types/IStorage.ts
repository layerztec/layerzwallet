export const STORAGE_KEY_MNEMONIC = 'STORAGE_KEY_MNEMONIC';
export const ENCRYPTED_PREFIX = 'encrypted://';
export const STORAGE_KEY_BTC_XPUB = 'STORAGE_KEY_BTC_XPUB';
export const STORAGE_KEY_EVM_XPUB = 'STORAGE_KEY_EVM_XPUB';
export const STORAGE_KEY_ARK_ADDRESS = 'STORAGE_KEY_ARK_ADDRESS';
export const STORAGE_KEY_WHITELIST = 'STORAGE_KEY_WHITELIST';
export const STORAGE_KEY_ACCEPTED_TOS = 'STORAGE_KEY_ACCEPTED_TOS';
export const STORAGE_KEY_LIQUID_XPUB = 'STORAGE_KEY_LIQUID_XPUB';
export const STORAGE_KEY_LIQUID_MBK = 'STORAGE_KEY_LIQUID_MBK';

export interface IStorage {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string>;
}
