import { Messenger } from './messenger';
import { GetBtcSendDataResponse, IBackgroundCaller, MessageType, GetCommonTransactionsResponse } from '@shared/types/IBackgroundCaller';
import { ENCRYPTED_PREFIX, STORAGE_KEY_MNEMONIC, STORAGE_KEY_SEED_VERIFIED } from '@shared/types/IStorage';
import { LayerzStorage } from '../class/layerz-storage';
import { SecureStorage } from '../class/secure-storage';
import { NETWORK_SPARK } from '@shared/types/networks';
import { SparkWallet } from '@shared/class/wallets/spark-wallet';
import {
  lazyInitWallet as lazyInitWalletOrig,
  TSupportedLazyInitWalletNetworks,
  lazyInitWalletReady as lazyInitWalletReadyOrig,
  getMasterSeed as getMasterSeedOrig,
  setMasterSeed as setMasterSeedOrig,
} from '@shared/modules/wallet-utils';
import assert from 'assert';

const STORAGE_KEY_WHITELIST = 'STORAGE_KEY_WHITELIST';
const STORAGE_KEY_ACCEPTED_TOS = 'STORAGE_KEY_ACCEPTED_TOS';

/**
 * Makes calls to the background script and handles responses. The background script executes sensitive operations
 * in an isolated context for security. Communication is handled via the `Messenger` service
 */
export const BackgroundCaller: IBackgroundCaller = {
  async getMasterSeed() {
    // master seed can exist in both background script and popup contexts, and they should be the same. lets first try local context:
    const masterSeedLocal = getMasterSeedOrig();
    if (masterSeedLocal) {
      return masterSeedLocal;
    }

    // cache miss!
    const masterSeed = await Messenger.sendGenericMessageToBackground(MessageType.GET_MASTER_SEED, []);

    if (masterSeed) {
      setMasterSeedOrig(masterSeed); // also set it in local context, as a cache

      return masterSeed;
    }

    throw new Error('Internal error: master seed not loaded');
  },

  async setMasterSeed(...params) {
    // we are setting master seed in current (popup?) context as well as in background script:
    setMasterSeedOrig(params[0]);
    await Messenger.sendGenericMessageToBackground(MessageType.SET_MASTER_SEED, params);
  },

  /**
   * ACHTUNG!
   *
   * this will create a wallet object that will exist in the __context where it was called__.
   * there might be a situation (in ext) when same wallet was created in background script and popup
   */
  async lazyInitWallet(network: TSupportedLazyInitWalletNetworks, accountNumber: number) {
    return lazyInitWalletOrig(network, accountNumber, LayerzStorage, SecureStorage);
  },

  lazyInitWalletReady(network: TSupportedLazyInitWalletNetworks, accountNumber: number) {
    return lazyInitWalletReadyOrig(network, accountNumber);
  },

  async getAddress(...params) {
    const [network, accountNumber] = params;
    if (network === NETWORK_SPARK) {
      // executing in Popup context instead of background script context since spark lib cant work there (expects `window.`)
      // @see https://github.com/buildonspark/spark/issues/32  // fixme
      const sp = await BackgroundCaller.lazyInitWallet(network, accountNumber);
      assert(sp instanceof SparkWallet);
      return String(await sp.getOffchainReceiveAddress());
    }

    return await Messenger.sendGenericMessageToBackground(MessageType.GET_ADDRESS, params);
  },

  async acceptTermsOfService() {
    await LayerzStorage.setItem(STORAGE_KEY_ACCEPTED_TOS, 'true');
  },

  async hasAcceptedTermsOfService() {
    return !!(await LayerzStorage.getItem(STORAGE_KEY_ACCEPTED_TOS));
  },

  async hasMnemonic() {
    const mnemonic = await SecureStorage.getItem(STORAGE_KEY_MNEMONIC);
    return !!mnemonic;
  },

  async hasEncryptedMnemonic() {
    const mnemonic = await SecureStorage.getItem(STORAGE_KEY_MNEMONIC);
    return !!mnemonic && mnemonic.startsWith(ENCRYPTED_PREFIX);
  },

  async saveMnemonic(...params) {
    return await Messenger.sendGenericMessageToBackground(MessageType.SAVE_MNEMONIC, params);
  },

  async createMnemonic(...params) {
    return await Messenger.sendGenericMessageToBackground(MessageType.CREATE_MNEMONIC, params);
  },

  async encryptMnemonic(...params) {
    return await Messenger.sendGenericMessageToBackground(MessageType.ENCRYPT_MNEMONIC, params);
  },

  async getBtcBalance(...params) {
    return await Messenger.sendGenericMessageToBackground(MessageType.GET_BTC_BALANCE, params);
  },

  async whitelistDapp(dapp) {
    let whitelist: string[] = [];
    try {
      whitelist = JSON.parse(await LayerzStorage.getItem(STORAGE_KEY_WHITELIST));
    } catch (_) {}

    try {
      whitelist.push(dapp);
      const unique = [...new Set(whitelist)];
      await LayerzStorage.setItem(STORAGE_KEY_WHITELIST, JSON.stringify(unique));
    } catch (_) {}
  },

  async unwhitelistDapp(dapp: string) {
    alert('Implement me'); // todo
  },

  async getWhitelist() {
    try {
      return JSON.parse(await LayerzStorage.getItem(STORAGE_KEY_WHITELIST)) || [];
    } catch (_) {
      return [];
    }
  },

  async log(...params) {
    return await Messenger.sendGenericMessageToBackground(MessageType.LOG, params);
  },

  async openPopup(...params) {
    return await Messenger.sendGenericMessageToBackground(MessageType.OPEN_POPUP, params);
  },

  async getBtcSendData(...params): Promise<GetBtcSendDataResponse> {
    return await Messenger.sendGenericMessageToBackground(MessageType.GET_BTC_SEND_DATA, params);
  },

  async getCommonTransactions(...params): Promise<GetCommonTransactionsResponse> {
    return await Messenger.sendGenericMessageToBackground(MessageType.GET_COMMON_TRANSACTIONS, params);
  },

  async clear(...params) {
    return await Messenger.sendGenericMessageToBackground(MessageType.CLEAR, params);
  },

  async hasSeedVerified() {
    return !!(await LayerzStorage.getItem(STORAGE_KEY_SEED_VERIFIED));
  },

  async setSeedVerified() {
    await LayerzStorage.setItem(STORAGE_KEY_SEED_VERIFIED, 'true');
  },

  async getMnemonicForVerification() {
    const mnemonic = await SecureStorage.getItem(STORAGE_KEY_MNEMONIC);
    // During onboarding, mnemonic should not be encrypted yet
    if (mnemonic && !mnemonic.startsWith(ENCRYPTED_PREFIX)) {
      return mnemonic;
    }
    return null;
  },
};
