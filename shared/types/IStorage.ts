export const STORAGE_KEY_MNEMONIC = 'STORAGE_KEY_MNEMONIC';
export const ENCRYPTED_PREFIX = 'encrypted://';
export const STORAGE_KEY_BTC_XPUB = 'STORAGE_KEY_BTC_XPUB';
export const STORAGE_KEY_EVM_XPUB = 'STORAGE_KEY_EVM_XPUB';
export const STORAGE_KEY_WHITELIST = 'STORAGE_KEY_WHITELIST';
export const STORAGE_KEY_ACCEPTED_TOS = 'STORAGE_KEY_ACCEPTED_TOS';
export const STORAGE_KEY_SERIALIZED = 'STORAGE_KEY_SERIALIZED';
export const STORAGE_KEY_SETTINGS = 'STORAGE_KEY_SETTINGS';
export const STORAGE_KEY_SEED_VERIFIED = 'STORAGE_KEY_SEED_VERIFIED';
export const STORAGE_KEY_SIDESHIFT_TRANSFERS = 'STORAGE_KEY_SIDESHIFT_TRANSFERS';
export const STORAGE_KEY_NATIVE_DEPOSIT_TRANSFERS = 'STORAGE_KEY_NATIVE_DEPOSIT_TRANSFERS';
export const STORAGE_KEY_GARDEN_TRANSFERS = 'STORAGE_KEY_GARDEN_TRANSFERS';
export const STORAGE_KEY_SYMBIOSIS_TRANSFERS = 'STORAGE_KEY_SYMBIOSIS_TRANSFERS';
export const STORAGE_KEY_FLASHNET_TRANSFERS = 'STORAGE_KEY_FLASHNET_TRANSFERS';
export const STORAGE_KEY_SPARK_REFUNDED_DEPOSITS = 'STORAGE_KEY_SPARK_REFUNDED_DEPOSITS';
/** Set after the first successful RGB wallet init per network. Used to detect
 *  the dangerous "had a backup, now VSS says missing" case during a later
 *  unlock — see tasks/rgb-backup-failure-handling.md. */
export const STORAGE_KEY_RGB_INITIALIZED = 'STORAGE_KEY_RGB_INITIALIZED';
/** Persistent ledger of RGB backup state per network/account: pending mutation
 *  count + last failure classification. Survives force-quit so the warning
 *  banner can't be hidden by killing the app. See
 *  tasks/rgb-backup-failure-handling.md. */
export const STORAGE_KEY_RGB_BACKUP_STATE = 'STORAGE_KEY_RGB_BACKUP_STATE';

export interface IStorage {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string>;
}

export const getSerializedStorageKey = (network: string, accountNumber: number) => {
  return `${STORAGE_KEY_SERIALIZED}_${network}_${accountNumber}`;
};

export const getRgbInitializedStorageKey = (network: string) => {
  return `${STORAGE_KEY_RGB_INITIALIZED}_${network}`;
};

export const getRgbBackupStateStorageKey = (network: string, accountNumber: number) => {
  return `${STORAGE_KEY_RGB_BACKUP_STATE}_${network}_${accountNumber}`;
};
