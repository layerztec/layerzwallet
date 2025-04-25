import { ArkWallet } from '../class/wallets/ark-wallet';
import { HDSegwitBech32Wallet } from '../class/wallets/hd-segwit-bech32-wallet';
import { LiquidWallet } from '../class/wallets/liquid-wallet';
import { WatchOnlyWallet } from '../class/wallets/watch-only-wallet';
import {
  getSerializedStorageKey,
  IStorage,
  STORAGE_KEY_ARK_ADDRESS,
  STORAGE_KEY_BTC_XPUB,
  STORAGE_KEY_LIQUID_MBK,
  STORAGE_KEY_LIQUID_XPUB,
  STORAGE_KEY_LIQUIDTESTNET_MBK,
  STORAGE_KEY_LIQUIDTESTNET_XPUB,
} from '../types/IStorage';
import { NETWORK_BITCOIN, NETWORK_LIQUID, NETWORK_LIQUIDTESTNET, Networks } from '../types/networks';
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
 * Save Liquid XPUBs and master blinding keys for accounts 0-5 to storage (mainnet and testnet).
 * @param storage Storage instance (LayerzStorage or compatible)
 * @param mnemonic The mnemonic to derive XPUBs and blinding keys from
 */
export async function saveLiquidXpubs(storage: IStorage, mnemonic: string) {
  for (let accountNum = 0; accountNum <= 5; accountNum++) {
    // mainnet
    const main = new LiquidWallet(undefined, false);
    main.setDerivationPath(`m/84'/1776'/${accountNum}'`); // BIP84
    const mainData = main.generateXpubAndMasterBlindingKey(mnemonic);
    await storage.setItem(STORAGE_KEY_LIQUID_XPUB + accountNum, mainData.xpub);
    if (accountNum === 0) {
      await storage.setItem(STORAGE_KEY_LIQUID_MBK, mainData.masterBlindingKey);
    }
    // testnet
    const test = new LiquidWallet('testnet', false);
    test.setDerivationPath(`m/84'/1'/${accountNum}'`); // BIP84
    const testData = test.generateXpubAndMasterBlindingKey(mnemonic);
    await storage.setItem(STORAGE_KEY_LIQUIDTESTNET_XPUB + accountNum, testData.xpub);
    if (accountNum === 0) {
      await storage.setItem(STORAGE_KEY_LIQUIDTESTNET_MBK, testData.masterBlindingKey);
    }
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

export async function saveWalletState(storage: IStorage, wallet: WatchOnlyWallet | LiquidWallet, network: Networks, accountNumber: number) {
  try {
    const serialized = await WalletSerializer.serialize(wallet);
    const storageKey = getSerializedStorageKey(network, accountNumber);
    await storage.setItem(storageKey, serialized);
  } catch (error) {
    console.error('Error saving wallet state:', error);
  }
}

type SupportedWalletNetworks = typeof NETWORK_BITCOIN | typeof NETWORK_LIQUID | typeof NETWORK_LIQUIDTESTNET;

/**
 * Initialize and cache a wallet for the given network/account, using serialization if available.
 * Supports Bitcoin (WatchOnlyWallet) and Liquid (LiquidWallet) networks.
 *
 * @param network Network type ("bitcoin", "liquid", or "liquidtest")
 * @param accountNumber Account index
 * @param cachedWallets Cache object to store/retrieve wallets
 * @param storage Storage instance (LayerzStorage or compatible)
 * @returns The initialized wallet instance
 */
export async function lazyInitWallet(
  network: SupportedWalletNetworks,
  accountNumber: number,
  cachedWallets: Record<string, Record<number, any>>,
  storage: IStorage
): Promise<WatchOnlyWallet | LiquidWallet> {
  if (![NETWORK_BITCOIN, NETWORK_LIQUID, NETWORK_LIQUIDTESTNET].includes(network)) {
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
  let wallet: WatchOnlyWallet | LiquidWallet;
  switch (network) {
    case NETWORK_BITCOIN: {
      const xpub = await storage.getItem(STORAGE_KEY_BTC_XPUB + accountNumber);
      if (!xpub) throw new Error('No xpub for this account number');
      wallet = new WatchOnlyWallet();
      wallet.setSecret(xpub);
      wallet.init();
      break;
    }
    case NETWORK_LIQUID: {
      const xpub = await storage.getItem(STORAGE_KEY_LIQUID_XPUB + accountNumber);
      if (!xpub) throw new Error('No xpub for this account. Key: ' + STORAGE_KEY_BTC_XPUB + accountNumber);
      const masterBlindingKey = await storage.getItem(STORAGE_KEY_LIQUID_MBK);
      if (!masterBlindingKey) throw new Error('No Master Blind Key for this account number. Key: ' + STORAGE_KEY_LIQUID_MBK);
      wallet = new LiquidWallet();
      await wallet.init({ xpub, masterBlindingKey });
      break;
    }
    case NETWORK_LIQUIDTESTNET: {
      const xpub = await storage.getItem(STORAGE_KEY_LIQUIDTESTNET_XPUB + accountNumber);
      if (!xpub) throw new Error('No xpub for this account.');
      const masterBlindingKey = await storage.getItem(STORAGE_KEY_LIQUIDTESTNET_MBK);
      if (!masterBlindingKey) throw new Error('No Master Blind Key for this account number. Key: ' + STORAGE_KEY_LIQUIDTESTNET_MBK);
      wallet = new LiquidWallet('testnet');
      await wallet.init({ xpub, masterBlindingKey });
      break;
    }
    default:
      throw new Error(`Unsupported network: ${network}`);
  }
  cachedWallets[network][accountNumber] = wallet;
  await saveWalletState(storage, wallet, network, accountNumber);
  return wallet;
}
