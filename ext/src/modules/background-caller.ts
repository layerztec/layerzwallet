import { Messenger } from '@shared/modules/messenger';
import {
  CreateMnemonicResponse,
  EncryptMnemonicRequest,
  EncryptMnemonicResponse,
  GetAddressRequest,
  GetBtcBalanceRequest,
  GetBtcBalanceResponse,
  GetBtcSendDataRequest,
  GetBtcSendDataResponse,
  GetLiquidBalanceResponse,
  GetLiquidSendDataRequest,
  GetLiquidSendDataResponse,
  IBackgroundCaller,
  LogRequest,
  MessageType,
  ProcessRPCRequest,
  SaveMnemonicRequest,
  SaveMnemonicResponse,
  SignPersonalMessageRequest,
  SignPersonalMessageResponse,
  SignTypedDataRequest,
  SignTypedDataResponse,
} from '@shared/types/IBackgroundCaller';
import { ENCRYPTED_PREFIX, STORAGE_KEY_MNEMONIC } from '@shared/types/IStorage';
import { Networks } from '@shared/types/networks';
import { LayerzStorage } from '../class/layerz-storage';
import { SecureStorage } from '../class/secure-storage';

const STORAGE_KEY_WHITELIST = 'STORAGE_KEY_WHITELIST';
const STORAGE_KEY_ACCEPTED_TOS = 'STORAGE_KEY_ACCEPTED_TOS';

/**
 * Makes calls to the background script and handles responses. The background script executes sensitive operations
 * in an isolated context for security. Communication is handled via the `Messenger` service
 */
export const BackgroundCaller: IBackgroundCaller = {
  async getAddress(network: Networks, accountNumber: number): Promise<string> {
    return await Messenger.sendGenericMessageToBackground({
      type: MessageType.GET_ADDRESS,
      network,
      accountNumber,
    } as GetAddressRequest);
  },

  async acceptTermsOfService(): Promise<void> {
    await LayerzStorage.setItem(STORAGE_KEY_ACCEPTED_TOS, 'true');
  },

  async hasAcceptedTermsOfService(): Promise<boolean> {
    return !!(await LayerzStorage.getItem(STORAGE_KEY_ACCEPTED_TOS));
  },

  async hasMnemonic(): Promise<boolean> {
    const mnemonic = await SecureStorage.getItem(STORAGE_KEY_MNEMONIC);
    return !!mnemonic;
  },

  async hasEncryptedMnemonic(): Promise<boolean> {
    const mnemonic = await SecureStorage.getItem(STORAGE_KEY_MNEMONIC);
    return !!mnemonic && mnemonic.startsWith(ENCRYPTED_PREFIX);
  },

  async saveMnemonic(mnemonic: string): Promise<SaveMnemonicResponse> {
    return await Messenger.sendGenericMessageToBackground({
      type: MessageType.SAVE_MNEMONIC,
      mnemonic,
    } as SaveMnemonicRequest);
  },

  async createMnemonic(): Promise<CreateMnemonicResponse> {
    return await Messenger.sendGenericMessageToBackground({
      type: MessageType.CREATE_MNEMONIC,
    });
  },

  async encryptMnemonic(password: string): Promise<EncryptMnemonicResponse> {
    return await Messenger.sendGenericMessageToBackground({
      type: MessageType.ENCRYPT_MNEMONIC,
      password,
    } as EncryptMnemonicRequest);
  },

  async getBtcBalance(accountNumber: number): Promise<GetBtcBalanceResponse> {
    return await Messenger.sendGenericMessageToBackground({
      type: MessageType.GET_BTC_BALANCE,
      accountNumber,
    } as GetBtcBalanceRequest);
  },

  async whitelistDapp(dapp: string): Promise<void> {
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

  async unwhitelistDapp(dapp: string): Promise<void> {
    alert('Implement me'); // todo
  },

  async getWhitelist(): Promise<string[]> {
    try {
      return JSON.parse(await LayerzStorage.getItem(STORAGE_KEY_WHITELIST)) || [];
    } catch (_) {
      return [];
    }
  },

  async log(data: string): Promise<void> {
    return await Messenger.sendGenericMessageToBackground({
      type: MessageType.LOG,
      data,
    } as LogRequest);
  },

  async signPersonalMessage(message: string | Uint8Array, accountNumber: number, password: string): Promise<SignPersonalMessageResponse> {
    return await Messenger.sendGenericMessageToBackground({
      type: MessageType.SIGN_PERSONAL_MESSAGE,
      accountNumber,
      message,
      password,
    } as SignPersonalMessageRequest);
  },

  async signTypedData(message: any, accountNumber: number, password: string): Promise<SignTypedDataResponse> {
    return await Messenger.sendGenericMessageToBackground({
      type: MessageType.SIGN_TYPED_DATA,
      accountNumber,
      message,
      password,
    } as SignTypedDataRequest);
  },

  async openPopup(method: string, params: any, id: number, from: string): Promise<void> {
    return await Messenger.sendGenericMessageToBackground({
      type: MessageType.OPEN_POPUP,
      method,
      params,
      id,
      from,
    } as ProcessRPCRequest);
  },

  async getBtcSendData(accountNumber: number): Promise<GetBtcSendDataResponse> {
    return await Messenger.sendGenericMessageToBackground({
      type: MessageType.GET_BTC_SEND_DATA,
      accountNumber,
    } as GetBtcSendDataRequest);
  },

  async getLiquidBalance(accountNumber: number): Promise<GetLiquidBalanceResponse> {
    return await Messenger.sendGenericMessageToBackground({
      type: MessageType.GET_LIQUID_BALANCE,
      accountNumber,
    } as GetBtcBalanceRequest);
  },

  async getLiquidSendData(accountNumber: number): Promise<GetLiquidSendDataResponse> {
    return await Messenger.sendGenericMessageToBackground({
      type: MessageType.GET_LIQUID_SEND_DATA,
      accountNumber,
    } as GetLiquidSendDataRequest);
  },
};
