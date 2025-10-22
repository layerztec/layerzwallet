import assert from 'assert';
import { BIP85 } from 'bip85';

import { HDSegwitBech32Wallet } from '../class/wallets/hd-segwit-bech32-wallet';
import { WatchOnlyWallet } from '../class/wallets/watch-only-wallet';
import { SparkWallet } from '../class/wallets/spark-wallet';
import { IStorage, STORAGE_KEY_BTC_XPUB, getSerializedStorageKey } from '../types/IStorage';
import { NETWORK_ARK, NETWORK_ARK_MUTINYNET, NETWORK_BITCOIN, NETWORK_LIQUID, NETWORK_LIQUID_TESTNET, NETWORK_SPARK, Networks } from '../types/networks';
import { WalletSerializer } from './wallet-serializer';
import { BreezWallet, getBreezNetwork } from '../class/wallets/breez-wallet';
import { ArkWallet } from '../class/wallets/ark-wallet';
import { validateMnemonic } from '../blue_modules/bip39';

// cache of master seed after it was decrypted from the storage (with user's password).
let masterSeed: string = '';

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
 * Set the master seed after it was decrypted from the storage (with user's password).
 */
export function setMasterSeed(seed: string) {
  masterSeed = seed;
}

/**
 * Get the cached master seed
 */
export function getMasterSeed() {
  return masterSeed;
}

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

function getSubMnemonic(mnemonic: string, accountNum = 0) {
  const masterSeed = BIP85.fromMnemonic(mnemonic);

  const child = masterSeed.deriveBIP39(0, 12, accountNum); // 0 is English, 12 is 12 words
  return child.toMnemonic();
}

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

  if (network === NETWORK_LIQUID || network === NETWORK_LIQUID_TESTNET) {
    // breez sdk doesnt support account numbers, so we hardcode it to 0 so all liquid wallets
    // across accounts are the same
    // @see https://github.com/breez/breez-sdk-liquid/issues/1021
    // FIXME: remove once breez implements it ^^^
    // accountNumber = 0; // FIXME: uncomment this line once we get rid of BIP85: https://github.com/layerztec/layerzwallet/issues/416
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

  try {
    if (network === NETWORK_SPARK) {
      // we dont save it to storage
      assert(masterSeed, 'Master seed is not available');
      const sw = new SparkWallet();
      sw.setSecret(getSubMnemonic(masterSeed, accountNumber));
      // sw.setAccountNumber(accountNumber); // FIXME: uncomment this line once we get rid of BIP85: https://github.com/layerztec/layerzwallet/issues/416
      await sw.init();
      cachedWallets[network][accountNumber] = sw;
      return sw;
    }

    if (network === NETWORK_ARK_MUTINYNET) {
      assert(masterSeed, 'Master seed is not available');
      const aw = new ArkWallet();
      aw.setSecret(getSubMnemonic(masterSeed, accountNumber));
      // aw.setAccountNumber(accountNumber); // FIXME: uncomment this line once we get rid of BIP85: https://github.com/layerztec/layerzwallet/issues/416

      await aw.init(storage);
      cachedWallets[network][accountNumber] = aw;
      return aw;
    }

    if (network === NETWORK_ARK) {
      assert(masterSeed, 'Master seed is not available');
      const aw = new ArkWallet();
      aw.setSecret(getSubMnemonic(masterSeed, accountNumber));
      // aw.setAccountNumber(accountNumber); // FIXME: uncomment this line once we get rid of BIP85: https://github.com/layerztec/layerzwallet/issues/416
      aw.setArkServerUrl('https://arkade.computer');
      aw.setArkServerPublicKey('022b74c2011af089c849383ee527c72325de52df6a788428b68d49e9174053aaba');
      aw.setBoltzApiUrl('https://api.ark.boltz.exchange');
      await aw.init(storage);
      await aw.initLightningSwaps();
      cachedWallets[network][accountNumber] = aw;
      return aw;
    }

    if (network === NETWORK_LIQUID || network === NETWORK_LIQUID_TESTNET) {
      // we dont save it to storage
      assert(masterSeed, 'Master seed is not available');
      const bNetwork = getBreezNetwork(network);

      const bw = new BreezWallet(getSubMnemonic(masterSeed, accountNumber), bNetwork);
      // FIXME: account number!!!!!!!!!!!!!!
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
  } catch (e) {
    console.error(`Failed to initialize wallet for ${network} account ${accountNumber}:`, e);
    throw e;
  } finally {
    locks[lockKey] = false;
  }
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

  // Validate against BIP39 standards
  if (!validateMnemonic(sanitizedMnemonic)) {
    throw new Error('Invalid mnemonic. Please check that all words are correct and from the BIP39 word list.');
  }

  return sanitizedMnemonic;
};

export const clearWalletCache = () => {
  (Object.keys(cachedWallets) as TSupportedLazyInitWalletNetworks[]).forEach((network) => {
    cachedWallets[network] = {};
  });
};
