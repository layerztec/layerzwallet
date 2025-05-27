export const STORAGE_KEY_MNEMONIC = 'STORAGE_KEY_MNEMONIC';
export const ENCRYPTED_PREFIX = 'encrypted://';
export const STORAGE_KEY_BTC_XPUB = 'STORAGE_KEY_BTC_XPUB';
export const STORAGE_KEY_EVM_XPUB = 'STORAGE_KEY_EVM_XPUB';
export const STORAGE_KEY_ARK_ADDRESS = 'STORAGE_KEY_ARK_ADDRESS';
export const STORAGE_KEY_WHITELIST = 'STORAGE_KEY_WHITELIST';
export const STORAGE_KEY_ACCEPTED_TOS = 'STORAGE_KEY_ACCEPTED_TOS';
export const STORAGE_KEY_SERIALIZED = 'STORAGE_KEY_SERIALIZED';
export const STORAGE_KEY_SUB_MNEMONIC = 'STORAGE_KEY_SUB_MNEMONIC';

export interface IStorage {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string>;
}

export const getSerializedStorageKey = (network: string, accountNumber: number) => {
  return `${STORAGE_KEY_SERIALIZED}_${network}_${accountNumber}`;
};
