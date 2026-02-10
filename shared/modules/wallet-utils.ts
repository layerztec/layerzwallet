import assert from 'assert';

import { validateMnemonic } from '../blue_modules/bip39';
import { EvmWallet } from '../class/evm-wallet';
import { ArkWallet } from '../class/wallets/ark-wallet';
import { BreezWallet, getBreezNetwork } from '../class/wallets/breez-wallet';
import { HDSegwitBech32Wallet } from '../class/wallets/hd-segwit-bech32-wallet';
import { LegacyWallet } from '../class/wallets/legacy-wallet';
import { RGBWallet } from '../class/wallets/rgb-wallet';
import { SparkWallet } from '../class/wallets/spark-wallet';
import { StacksWallet } from '../class/wallets/stacks-wallet';
import { WatchOnlyWallet } from '../class/wallets/watch-only-wallet';
import { IStorage, STORAGE_KEY_BTC_XPUB, getSerializedStorageKey } from '../types/IStorage';
import {
  NETWORK_ALPEN_TESTNET,
  NETWORK_ARK,
  NETWORK_ARK_MUTINYNET,
  NETWORK_BITCOIN,
  NETWORK_BOTANIX,
  NETWORK_BOTANIX_TESTNET,
  NETWORK_CITREA_TESTNET,
  NETWORK_LIQUID,
  NETWORK_LIQUID_TESTNET,
  NETWORK_RGB,
  NETWORK_RGB_TESTNET,
  NETWORK_ROOTSTOCK,
  NETWORK_SEPOLIA,
  NETWORK_SPARK,
  NETWORK_STACKS,
  Networks,
} from '../types/networks';
import { WalletSerializer } from './wallet-serializer';

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
  [NETWORK_STACKS]: {},
  [NETWORK_RGB]: {},
  [NETWORK_RGB_TESTNET]: {},
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
    globalThis.handleError?.(error, 'wallet-utils.ts');
    console.error('Error saving wallet state:', error);
  }
}

export type TSupportedLazyInitWalletNetworks =
  | typeof NETWORK_BITCOIN
  | typeof NETWORK_SPARK
  | typeof NETWORK_LIQUID
  | typeof NETWORK_LIQUID_TESTNET
  | typeof NETWORK_ARK_MUTINYNET
  | typeof NETWORK_STACKS
  | typeof NETWORK_ARK
  | typeof NETWORK_RGB
  | typeof NETWORK_RGB_TESTNET;
export type TLazyInitedWallets = WatchOnlyWallet | SparkWallet | BreezWallet | ArkWallet | StacksWallet | RGBWallet;

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
  if (![NETWORK_BITCOIN, NETWORK_SPARK, NETWORK_LIQUID, NETWORK_LIQUID_TESTNET, NETWORK_ARK_MUTINYNET, NETWORK_ARK, NETWORK_STACKS, NETWORK_RGB, NETWORK_RGB_TESTNET].includes(network)) {
    throw new Error(`Unsupported network for lazyInitWallet: ${network}`);
  }

  if (network === NETWORK_LIQUID || network === NETWORK_LIQUID_TESTNET) {
    // breez sdk doesnt support account numbers, so we hardcode it to 0 so all liquid wallets
    // across accounts are the same
    // @see https://github.com/breez/breez-sdk-liquid/issues/1021
    // FIXME: remove once breez implements it ^^^
    accountNumber = 0;
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
      if (c++ > 90 /* 45 seconds */) {
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
      sw.setSecret(masterSeed);
      sw.setAccountNumber(accountNumber);
      await sw.init(storage);
      cachedWallets[network][accountNumber] = sw;
      return sw;
    }

    if (network === NETWORK_ARK_MUTINYNET) {
      assert(masterSeed, 'Master seed is not available');
      const aw = new ArkWallet();
      aw.setSecret(masterSeed);
      aw.setAccountNumber(accountNumber);

      await aw.init(storage);
      cachedWallets[network][accountNumber] = aw;
      return aw;
    }

    if (network === NETWORK_ARK) {
      assert(masterSeed, 'Master seed is not available');
      const aw = new ArkWallet();
      aw.setSecret(masterSeed);
      aw.setAccountNumber(accountNumber);
      aw.setArkServerUrl('https://arkade.computer');
      aw.setArkServerPublicKey('022b74c2011af089c849383ee527c72325de52df6a788428b68d49e9174053aaba');
      aw.setBoltzApiUrl('https://api.ark.boltz.exchange');
      await aw.init(storage);
      await aw.initLightningSwaps();
      cachedWallets[network][accountNumber] = aw;
      return aw;
    }

    if (network === NETWORK_STACKS) {
      assert(masterSeed, 'Master seed is not available');
      const sw = new StacksWallet();
      sw.setSecret(masterSeed);
      await sw.init(storage);
      sw.setAccountNumber(accountNumber);
      cachedWallets[network][accountNumber] = sw;
      return sw;
    }

    if (network === NETWORK_LIQUID || network === NETWORK_LIQUID_TESTNET) {
      // we dont save it to storage
      assert(masterSeed, 'Master seed is not available');
      const bNetwork = getBreezNetwork(network);

      const bw = new BreezWallet(masterSeed, bNetwork);
      // FIXME: account number!!!!!!!!!!!!!!
      cachedWallets[network][accountNumber] = bw;
      return bw;
    }

    if (network === NETWORK_RGB || network === NETWORK_RGB_TESTNET) {
      assert(masterSeed, 'Master seed is not available');
      const rgbNetwork = network === NETWORK_RGB ? 'mainnet' : 'testnet';
      const rw = new RGBWallet(rgbNetwork);
      rw.setSecret(masterSeed);
      rw.setAccountNumber(accountNumber);
      await rw.init();
      cachedWallets[network][accountNumber] = rw;
      return rw;
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
      globalThis.handleError?.(e, 'wallet-utils.ts');
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
    globalThis.handleError?.(e, 'wallet-utils.ts');
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

/**
 * Validates an address for a given network
 * @param network The network to validate the address for
 * @param address The address to validate
 * @returns true if the address is valid for the network, false otherwise
 */
export function validateAddress(network: Networks, address: string): boolean {
  try {
    const a = address.trim();
    if (!a) return false;
    switch (network) {
      case NETWORK_BITCOIN:
        return LegacyWallet.isAddressValid(a);
      case NETWORK_LIQUID:
      case NETWORK_LIQUID_TESTNET:
        return BreezWallet.isAddressValid(a);
      case NETWORK_SPARK:
        return SparkWallet.isAddressValid(a);
      case NETWORK_ARK:
      case NETWORK_ARK_MUTINYNET:
        return ArkWallet.isAddressValid(a);
      case NETWORK_STACKS:
        return StacksWallet.isAddressValid(a);
      case NETWORK_RGB:
      case NETWORK_RGB_TESTNET:
        return RGBWallet.isAddressValid(a);
      // EVM networks
      case NETWORK_ROOTSTOCK:
      case NETWORK_BOTANIX:
      case NETWORK_BOTANIX_TESTNET:
      case NETWORK_ALPEN_TESTNET:
      case NETWORK_SEPOLIA:
      case NETWORK_CITREA_TESTNET:
        return EvmWallet.isAddressValid(a);
      default:
        // For unknown networks, return false
        return false;
    }
  } catch (error) {
    globalThis.handleError?.(error, 'wallet-utils.ts');
    // If any error occurs during validation, consider the address invalid
    return false;
  }
}
