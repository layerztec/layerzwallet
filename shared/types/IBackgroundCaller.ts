import { CreateTransactionUtxo } from '../class/wallets/types';
import { Networks } from '../types/networks';

// Message types for background script communication
export enum MessageType {
  CREATE_MNEMONIC,
  SAVE_MNEMONIC,
  LOG,
  GET_BTC_BALANCE,
  ENCRYPT_MNEMONIC,
  SIGN_PERSONAL_MESSAGE,
  SIGN_TYPED_DATA,
  OPEN_POPUP,
  GET_ADDRESS,
  GET_BTC_SEND_DATA,
  GET_SUB_MNEMONIC,
}

// Message types for background script communication
export type MessageTypeMap = {
  [MessageType.GET_ADDRESS]: {
    params: GetAddressParams;
    response: GetAddressResponse;
  };
  [MessageType.SAVE_MNEMONIC]: {
    params: SaveMnemonicParams;
    response: SaveMnemonicResponse;
  };
  [MessageType.CREATE_MNEMONIC]: {
    params: [];
    response: CreateMnemonicResponse;
  };
  [MessageType.ENCRYPT_MNEMONIC]: {
    params: EncryptMnemonicRequest;
    response: EncryptMnemonicResponse;
  };
  [MessageType.GET_BTC_BALANCE]: {
    params: GetBtcBalanceRequest;
    response: GetBtcBalanceResponse;
  };
  [MessageType.LOG]: {
    params: LogRequest;
    response: void;
  };
  [MessageType.SIGN_PERSONAL_MESSAGE]: {
    params: SignPersonalMessageRequest;
    response: SignPersonalMessageResponse;
  };
  [MessageType.SIGN_TYPED_DATA]: {
    params: SignTypedDataRequest;
    response: SignTypedDataResponse;
  };
  [MessageType.OPEN_POPUP]: {
    params: OpenPopupRequest;
    response: void;
  };
  [MessageType.GET_BTC_SEND_DATA]: {
    params: GetBtcSendDataRequest;
    response: GetBtcSendDataResponse;
  };
  [MessageType.GET_SUB_MNEMONIC]: {
    params: GetSubMnemonicRequest;
    response: GetSubMnemonicResponse;
  };
};

export type GetAddressParams = [network: Networks, accountNumber: number];
export type GetAddressResponse = string;

export type SaveMnemonicParams = [mnemonic: string];
export type SaveMnemonicResponse = boolean;

export type CreateMnemonicResponse = { mnemonic: string };

export type EncryptMnemonicRequest = [password: string];
export type EncryptMnemonicResponse = { success: boolean; message?: string };

export type GetBtcBalanceRequest = [accountNumber: number];
export type GetBtcBalanceResponse = { confirmed: number; unconfirmed: number };

export type LogRequest = [data: string];

export type SignPersonalMessageRequest = [message: string | Uint8Array, accountNumber: number, password: string];
export type SignPersonalMessageResponse = { bytes: string; success: boolean; message?: string };

export type SignTypedDataRequest = [message: any, accountNumber: number, password: string];
export type SignTypedDataResponse = { bytes: string; success: boolean; message?: string };

export type OpenPopupRequest = [method: string, params: any, id: number, from: string];

export type GetBtcSendDataRequest = [accountNumber: number];
export type GetBtcSendDataResponse = { utxos: CreateTransactionUtxo[]; changeAddress: string };

export type GetSubMnemonicRequest = [accountNumber: number];
export type GetSubMnemonicResponse = string;

export interface ProcessRPCRequest {
  method: string;
  params: any;
  id: number;
  from: string;
}

export interface IBackgroundCaller {
  getAddress(...params: GetAddressParams): Promise<GetAddressResponse>;
  acceptTermsOfService(): Promise<void>;
  hasAcceptedTermsOfService(): Promise<boolean>;
  hasMnemonic(): Promise<boolean>;
  hasEncryptedMnemonic(): Promise<boolean>;
  saveMnemonic(...params: SaveMnemonicParams): Promise<SaveMnemonicResponse>;
  createMnemonic(): Promise<CreateMnemonicResponse>;
  encryptMnemonic(...params: EncryptMnemonicRequest): Promise<EncryptMnemonicResponse>;
  getBtcBalance(...params: GetBtcBalanceRequest): Promise<GetBtcBalanceResponse>;
  whitelistDapp(dapp: string): Promise<void>;
  unwhitelistDapp(dapp: string): Promise<void>;
  getWhitelist(): Promise<string[]>;
  log(...params: LogRequest): Promise<void>;
  signPersonalMessage(...params: SignPersonalMessageRequest): Promise<SignPersonalMessageResponse>;
  signTypedData(...params: SignTypedDataRequest): Promise<SignTypedDataResponse>;
  openPopup(...params: OpenPopupRequest): Promise<void>;
  getBtcSendData(...params: GetBtcSendDataRequest): Promise<GetBtcSendDataResponse>;
  getSubMnemonic(...params: GetSubMnemonicRequest): Promise<GetSubMnemonicResponse>;
}
