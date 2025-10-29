import { CreateTransactionUtxo } from '../class/wallets/types';
import { Networks } from '../types/networks';
import { TLazyInitedWallets, TSupportedLazyInitWalletNetworks } from '../modules/wallet-utils';
import { CommonTransaction } from './common-transaction';

// Message types for background script communication
export enum MessageType {
  CREATE_MNEMONIC,
  SAVE_MNEMONIC,
  LOG,
  GET_BTC_BALANCE,
  ENCRYPT_MNEMONIC,
  OPEN_POPUP,
  GET_ADDRESS,
  GET_BTC_SEND_DATA,
  GET_COMMON_TRANSACTIONS,
  CLEAR,
  GET_MASTER_SEED,
  SET_MASTER_SEED,
  VALIDATE_ADDRESS,
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
  [MessageType.OPEN_POPUP]: {
    params: OpenPopupRequest;
    response: void;
  };
  [MessageType.GET_BTC_SEND_DATA]: {
    params: GetBtcSendDataRequest;
    response: GetBtcSendDataResponse;
  };
  [MessageType.GET_COMMON_TRANSACTIONS]: {
    params: GetCommonTransactionsRequest;
    response: GetCommonTransactionsResponse;
  };
  [MessageType.CLEAR]: {
    params: [];
    response: void;
  };
  [MessageType.GET_MASTER_SEED]: {
    params: [];
    response: GetMasterSeedResponse;
  };
  [MessageType.SET_MASTER_SEED]: {
    params: SetMasterSeedParams;
    response: void;
  };
  [MessageType.VALIDATE_ADDRESS]: {
    params: ValidateAddressRequest;
    response: ValidateAddressResponse;
  };
};

export type GetAddressParams = [network: Networks, accountNumber: number];
export type GetAddressResponse = string;

export type SaveMnemonicParams = [mnemonic: string];
export type SaveMnemonicResponse = boolean;

export type SetMasterSeedParams = [seed: string];
export type GetMasterSeedResponse = string;

export type CreateMnemonicResponse = { mnemonic: string };

export type EncryptMnemonicRequest = [password: string];
export type EncryptMnemonicResponse = { success: boolean; message?: string };

export type GetBtcBalanceRequest = [accountNumber: number];
export type GetBtcBalanceResponse = { confirmed: number; unconfirmed: number };

export type LogRequest = [data: string];

export type OpenPopupRequest = [method: string, params: any, id: number, from: string];

export type GetBtcSendDataRequest = [accountNumber: number];
export type GetBtcSendDataResponse = { utxos: CreateTransactionUtxo[]; changeAddress: string };

export type GetCommonTransactionsRequest = [network: Networks, accountNumber: number, afterTxid?: string, limit?: number];
export type GetCommonTransactionsResponse = CommonTransaction[];

export type ValidateAddressRequest = [network: Networks, accountNumber: number, address: string];
export type ValidateAddressResponse = boolean;

export interface ProcessRPCRequest {
  method: string;
  params: any;
  id: number;
  from: string;
}

export interface IBackgroundCaller {
  setMasterSeed(seed: string): Promise<void>;
  getMasterSeed(): Promise<string>;
  lazyInitWallet(network: TSupportedLazyInitWalletNetworks, accountNumber: number): Promise<TLazyInitedWallets>;
  lazyInitWalletReady(network: TSupportedLazyInitWalletNetworks, accountNumber: number): boolean;
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
  openPopup(...params: OpenPopupRequest): Promise<void>;
  getBtcSendData(...params: GetBtcSendDataRequest): Promise<GetBtcSendDataResponse>;
  getCommonTransactions(...params: GetCommonTransactionsRequest): Promise<GetCommonTransactionsResponse>;
  clear(): Promise<void>;
  hasSeedVerified(): Promise<boolean>;
  setSeedVerified(): Promise<void>;
  getMnemonicForVerification(): Promise<string | null>;
  validateAddress(...params: ValidateAddressRequest): Promise<ValidateAddressResponse>;
}
