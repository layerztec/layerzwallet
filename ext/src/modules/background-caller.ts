import { Messenger } from './messenger';
import { GetSubMnemonicResponse, GetBtcSendDataResponse, IBackgroundCaller, MessageType } from '@shared/types/IBackgroundCaller';
import { ENCRYPTED_PREFIX, STORAGE_KEY_MNEMONIC } from '@shared/types/IStorage';
import { LayerzStorage } from '../class/layerz-storage';
import { SecureStorage } from '../class/secure-storage';
import { NETWORK_SPARK } from '@shared/types/networks';
import { SparkWallet } from '@shared/class/wallets/spark-wallet';

const STORAGE_KEY_WHITELIST = 'STORAGE_KEY_WHITELIST';
const STORAGE_KEY_ACCEPTED_TOS = 'STORAGE_KEY_ACCEPTED_TOS';

/**
 * Makes calls to the background script and handles responses. The background script executes sensitive operations
 * in an isolated context for security. Communication is handled via the `Messenger` service
 */
export const BackgroundCaller: IBackgroundCaller = {
  async getAddress(...params) {
    const [network, accountNumber] = params;
    if (network === NETWORK_SPARK) {
      // executing in Popup context instead of background script context since spark lib cant work there (expects `window.`)
      // @see https://github.com/buildonspark/spark/issues/32  // fixme
      const sp = new SparkWallet();
      const submnemonic = await BackgroundCaller.getSubMnemonic(accountNumber);
      sp.setSecret(submnemonic);
      await sp.init();
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

  async signPersonalMessage(...params) {
    return await Messenger.sendGenericMessageToBackground(MessageType.SIGN_PERSONAL_MESSAGE, params);
  },

  async signTypedData(...params) {
    return await Messenger.sendGenericMessageToBackground(MessageType.SIGN_TYPED_DATA, params);
  },

  async openPopup(...params) {
    return await Messenger.sendGenericMessageToBackground(MessageType.OPEN_POPUP, params);
  },

  async getBtcSendData(...params): Promise<GetBtcSendDataResponse> {
    return await Messenger.sendGenericMessageToBackground(MessageType.GET_BTC_SEND_DATA, params);
  },

  async getSubMnemonic(...params): Promise<GetSubMnemonicResponse> {
    return await Messenger.sendGenericMessageToBackground(MessageType.GET_SUB_MNEMONIC, params);
  },
};
