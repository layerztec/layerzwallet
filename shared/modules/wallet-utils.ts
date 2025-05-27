import { BIP85 } from 'bip85';

import { ArkWallet } from '../class/wallets/ark-wallet';
import { HDSegwitBech32Wallet } from '../class/wallets/hd-segwit-bech32-wallet';
import { WatchOnlyWallet } from '../class/wallets/watch-only-wallet';
import { IStorage, STORAGE_KEY_ARK_ADDRESS, STORAGE_KEY_SUB_MNEMONIC, STORAGE_KEY_BTC_XPUB, getSerializedStorageKey } from '../types/IStorage';
import { NETWORK_BITCOIN, Networks } from '../types/networks';
import { WalletSerializer } from './wallet-serializer';

/**
 * Save Bitcoin XPUBs for accounts 0-5 to storage.
 * @param storage Storage instance (LayerzStorage or compatible)
 * @param mnemonic The mnemonic to derive XPUBs from
 */
export async function saveBitcoinXpubs(storage: IStorage, mnemonic: string) {
  for (let accountNum = 0; accountNum <= 5; accountNum++) {
    const btcWallet = new HDSegwitBech32Wallet();
    btcWallet.setSecret(mnemonic);
    btcWallet.setDerivationPath(`m/84'/0'/${accountNum}'`); // BIP84
    const btcXpub = btcWallet.getXpub();
    await storage.setItem(STORAGE_KEY_BTC_XPUB + accountNum, btcXpub);
  }
}

/**
 * Save Ark addresses for accounts 0-5 to storage.
 * @param storage Storage instance (LayerzStorage or compatible)
 * @param mnemonic The mnemonic to derive Ark addresses from
 */
export async function saveArkAddresses(storage: IStorage, mnemonic: string) {
  for (let accountNum = 0; accountNum <= 5; accountNum++) {
    const ark = new ArkWallet();
    ark.setSecret(mnemonic);
    ark.setAccountNumber(accountNum);
    await ark.init();
    const address = await ark.getOffchainReceiveAddress();
    if (address) {
      await storage.setItem(STORAGE_KEY_ARK_ADDRESS + accountNum, address);
    }
  }
}

/**
 * Generate and save sub mnemonics using bip85 for accounts 0-5 to storage.
 * @param storage Storage instance (LayerzStorage or compatible)
 * @param mnemonic The mnemonic to derive sub mnemonics from
 */
export async function saveSubMnemonics(storage: IStorage, mnemonic: string) {
  const masterSeed = BIP85.fromMnemonic(mnemonic);
  for (let accountNum = 0; accountNum <= 5; accountNum++) {
    const child = masterSeed.deriveBIP39(0, 12, accountNum); // 0 is English, 12 is 12 words
    const newMnemonic = child.toMnemonic();
    await storage.setItem(STORAGE_KEY_SUB_MNEMONIC + accountNum, newMnemonic);
  }
}

export async function saveWalletState(storage: IStorage, wallet: WatchOnlyWallet, network: Networks, accountNumber: number) {
  try {
    const serialized = await WalletSerializer.serialize(wallet);
    const storageKey = getSerializedStorageKey(network, accountNumber);
    await storage.setItem(storageKey, serialized);
  } catch (error) {
    console.error('Error saving wallet state:', error);
  }
}

type SupportedWalletNetworks = typeof NETWORK_BITCOIN;

/**
 * Initialize and cache a wallet for the given network/account, using serialization if available.
 * Supports Bitcoin (WatchOnlyWallet) networks.
 *
 * @param network Network type ("bitcoin")
 * @param accountNumber Account index
 * @param cachedWallets Cache object to store/retrieve wallets
 * @param storage Storage instance (LayerzStorage or compatible)
 * @returns The initialized wallet instance
 */
export async function lazyInitWallet(network: SupportedWalletNetworks, accountNumber: number, cachedWallets: Record<string, Record<number, any>>, storage: IStorage): Promise<WatchOnlyWallet> {
  if (![NETWORK_BITCOIN].includes(network)) {
    throw new Error(`Unsupported network for lazyInitWallet: ${network}`);
  }
  // cache hit
  if (cachedWallets[network]?.[accountNumber]) {
    return cachedWallets[network][accountNumber];
  }
  // try to restore wallet from the storage
  const storageKey = getSerializedStorageKey(network, accountNumber);
  try {
    const serializedData = await storage.getItem(storageKey);
    if (serializedData) {
      const wallet = await WalletSerializer.deserialize(serializedData);
      cachedWallets[network][accountNumber] = wallet;
      return wallet;
    }
  } catch (e) {
    console.error(`Failed to deserialize wallet for ${network} account ${accountNumber}:`, e);
  }
  // create brand new wallet instance
  let wallet: WatchOnlyWallet;
  switch (network) {
    case NETWORK_BITCOIN: {
      const xpub = await storage.getItem(STORAGE_KEY_BTC_XPUB + accountNumber);
      if (!xpub) throw new Error('No xpub for this account number');
      wallet = new WatchOnlyWallet();
      wallet.setSecret(xpub);
      wallet.init();
      break;
    }
    default:
      throw new Error(`Unsupported network: ${network}`);
  }
  cachedWallets[network][accountNumber] = wallet;
  await saveWalletState(storage, wallet, network, accountNumber);
  return wallet;
}
