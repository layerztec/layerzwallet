import { BIP85 } from 'bip85';

import { HDSegwitBech32Wallet } from '../class/wallets/hd-segwit-bech32-wallet';
import { WatchOnlyWallet } from '../class/wallets/watch-only-wallet';
import { SparkWallet } from '../class/wallets/spark-wallet';
import { IStorage, STORAGE_KEY_SUB_MNEMONIC, STORAGE_KEY_BTC_XPUB, getSerializedStorageKey } from '../types/IStorage';
import { NETWORK_ARK, NETWORK_ARK_MUTINYNET, NETWORK_BITCOIN, NETWORK_LIQUID, NETWORK_LIQUID_TESTNET, NETWORK_SPARK, Networks } from '../types/networks';
import { WalletSerializer } from './wallet-serializer';
import { BreezWallet, getBreezNetwork } from '../class/wallets/breez-wallet';
import { ArkWallet } from '../class/wallets/ark-wallet';
import assert from 'assert';

// Cache of wallets by network and account number
const cachedWallets: Record<TSupportedLazyInitWalletNetworks, Record<number, TLazyInitedWallets>> = {
  [NETWORK_BITCOIN]: {},
  [NETWORK_SPARK]: {},
  [NETWORK_ARK_MUTINYNET]: {},
  [NETWORK_ARK]: {},
  [NETWORK_LIQUID]: {},
  [NETWORK_LIQUID_TESTNET]: {},
};

const locks: Record<string, boolean> = {};

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

export type TSupportedLazyInitWalletNetworks =
  | typeof NETWORK_BITCOIN
  | typeof NETWORK_SPARK
  | typeof NETWORK_LIQUID
  | typeof NETWORK_LIQUID_TESTNET
  | typeof NETWORK_ARK_MUTINYNET
  | typeof NETWORK_ARK;
export type TLazyInitedWallets = WatchOnlyWallet | SparkWallet | BreezWallet | ArkWallet;

/**
 * Initialize and cache a wallet for the given network/account, using serialization if available.
 *
 * @param network Network type ("bitcoin")
 * @param accountNumber Account index
 * @param storage Storage instance (LayerzStorage or compatible)
 * @param secureStorage
 * @returns The initialized wallet instance
 */
export async function lazyInitWallet(network: TSupportedLazyInitWalletNetworks, accountNumber: number, storage: IStorage, secureStorage: IStorage): Promise<TLazyInitedWallets> {
  if (![NETWORK_BITCOIN, NETWORK_SPARK, NETWORK_LIQUID, NETWORK_LIQUID_TESTNET, NETWORK_ARK_MUTINYNET, NETWORK_ARK].includes(network)) {
    throw new Error(`Unsupported network for lazyInitWallet: ${network}`);
  }
  // cache hit
  if (cachedWallets[network]?.[accountNumber]) {
    return cachedWallets[network][accountNumber];
  }

  // lock so there is no concurrent wallet init:
  const lockKey = `${network}-${accountNumber}`;
  if (locks[lockKey]) {
    // wallet initing is in progress, so we just wait till its inited to return it
    let c = 0;
    while (!cachedWallets[network]?.[accountNumber]) {
      if (c++ > 30) {
        locks[lockKey] = false;
        throw new Error(`Timeout while waiting for ${network}[${accountNumber}] lock`);
      }
      await new Promise((resolve) => setTimeout(resolve, 500)); // sleep
    }

    locks[lockKey] = false; // release lock
    // cache hit
    return cachedWallets[network][accountNumber]; // return wallet
  }

  // cache miss, instantiating the wallet
  console.log(`lazyInitWallet ${network}[${accountNumber}]...`);

  // setting lock:
  locks[lockKey] = true;

  if (network === NETWORK_SPARK) {
    // we dont save it to storage
    const sw = new SparkWallet();
    const submnemonic = await secureStorage.getItem(STORAGE_KEY_SUB_MNEMONIC + accountNumber);
    sw.setSecret(submnemonic);
    await sw.init();
    cachedWallets[network][accountNumber] = sw;
    return sw;
  }

  if (network === NETWORK_ARK_MUTINYNET) {
    const aw = new ArkWallet();
    const submnemonic = await secureStorage.getItem(STORAGE_KEY_SUB_MNEMONIC + accountNumber);
    aw.setSecret(submnemonic);
    await aw.init();
    cachedWallets[network][accountNumber] = aw;
    return aw;
  }

  if (network === NETWORK_ARK) {
    const aw = new ArkWallet();
    const submnemonic = await secureStorage.getItem(STORAGE_KEY_SUB_MNEMONIC + accountNumber);
    aw.setSecret(submnemonic);
    assert(process.env.EXPO_PUBLIC_ARK_SERVER_URL && process.env.EXPO_PUBLIC_ARK_SERVER_PUBLIC_KEY && process.env.EXPO_PUBLIC_BOLTZ_API_URL, 'Ark env vars not set');
    // fixme: can be moved from env vars to hardcode once Ark mainnet goes public
    aw.setArkServerUrl(process.env.EXPO_PUBLIC_ARK_SERVER_URL);
    aw.setArkServerPublicKey(process.env.EXPO_PUBLIC_ARK_SERVER_PUBLIC_KEY);
    aw.setBoltzApiUrl(process.env.EXPO_PUBLIC_BOLTZ_API_URL);
    await aw.init();
    await aw.initLightningSwaps(storage);
    cachedWallets[network][accountNumber] = aw;
    return aw;
  }

  if (network === NETWORK_LIQUID || network === NETWORK_LIQUID_TESTNET) {
    // we dont save it to storage
    const submnemonic = await secureStorage.getItem(STORAGE_KEY_SUB_MNEMONIC + accountNumber);
    const bNetwork = getBreezNetwork(network);

    const bw = new BreezWallet(submnemonic, bNetwork);
    cachedWallets[network][accountNumber] = bw;
    return bw;
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

export function lazyInitWalletReady(network: TSupportedLazyInitWalletNetworks, accountNumber: number): boolean {
  return !!cachedWallets[network]?.[accountNumber];
}

export const sanitizeAndValidateMnemonic = (mnemonic: string): string => {
  // Remove extra spaces and newlines
  const sanitizedMnemonic = mnemonic.replace(/\s+/g, ' ').trim().toLocaleLowerCase();

  // Validate mnemonic length
  const words = sanitizedMnemonic.split(' ');
  if (words.length < 12 || words.length > 24) {
    throw new Error('Invalid mnemonic length. It should be 12 to 24 words.');
  }

  // Check if we can import it
  BIP85.fromMnemonic(sanitizedMnemonic);

  return sanitizedMnemonic;
};

export const clearWalletCache = () => {
  (Object.keys(cachedWallets) as TSupportedLazyInitWalletNetworks[]).forEach((network) => {
    cachedWallets[network] = {};
  });
};
