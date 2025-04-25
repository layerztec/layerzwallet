import { UnblindedOutput } from '@shared/class/wallets/liquid-deps/types';
import { LiquidWallet } from '@shared/class/wallets/liquid-wallet';
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
  GET_LIQUID_BALANCE,
  GET_LIQUID_SEND_DATA,
}

export interface SaveMnemonicResponse {
  success: boolean;
}

export interface GetBtcBalanceResponse {
  confirmed: number;
  unconfirmed: number;
}

export interface CreateMnemonicResponse {
  mnemonic: string;
}

export interface EncryptMnemonicResponse {
  success: boolean;
  message?: string;
}

export interface SignPersonalMessageResponse {
  bytes: string;
  success: boolean;
  message?: string;
}

export interface SignTypedDataResponse {
  bytes: string;
  success: boolean;
  message?: string;
}

// Request interfaces
export interface SaveMnemonicRequest {
  mnemonic: string;
}

export interface LogRequest {
  data: string;
}

export interface SignPersonalMessageRequest {
  message: string | Uint8Array;
  password: string;
  accountNumber: number;
}

export interface SignTypedDataRequest {
  message: any;
  password: string;
  accountNumber: number;
}

export interface GetBtcBalanceRequest {
  accountNumber: number;
}

export interface ProcessRPCRequest {
  method: string;
  params: any;
  id: number;
  from: string;
}

export interface EncryptMnemonicRequest {
  password: string;
}

export interface GetAddressRequest {
  network: Networks;
  accountNumber: number;
}

export type GetAddressResponse = string;

export interface GetBtcSendDataRequest {
  accountNumber: number;
}

export type GetBtcSendDataResponse = {
  utxos: CreateTransactionUtxo[];
  changeAddress: string;
};

export interface GetLiquidBalanceRequest {
  network: Networks;
  accountNumber: number;
}

export interface GetLiquidBalanceResponse {
  [key: string]: number;
}

export interface GetLiquidSendDataRequest {
  network: Networks;
  accountNumber: number;
}

export type GetLiquidSendDataResponse = {
  utxos: UnblindedOutput[];
  txDetails: LiquidWallet['txDetails'];
  outpointBlindingData: LiquidWallet['outpointBlindingData'];
  scriptsDetails: LiquidWallet['scriptsDetails'];
};

export interface IBackgroundCaller {
  getAddress(network: Networks, accountNumber: number): Promise<string>;
  acceptTermsOfService(): Promise<void>;
  hasAcceptedTermsOfService(): Promise<boolean>;
  hasMnemonic(): Promise<boolean>;
  hasEncryptedMnemonic(): Promise<boolean>;
  saveMnemonic(mnemonic: string): Promise<SaveMnemonicResponse>;
  createMnemonic(): Promise<CreateMnemonicResponse>;
  encryptMnemonic(password: string): Promise<EncryptMnemonicResponse>;
  getBtcBalance(accountNumber: number): Promise<GetBtcBalanceResponse>;
  whitelistDapp(dapp: string): Promise<void>;
  unwhitelistDapp(dapp: string): Promise<void>;
  getWhitelist(): Promise<string[]>;
  log(data: string): Promise<void>;
  signPersonalMessage(message: string | Uint8Array, accountNumber: number, password: string): Promise<SignPersonalMessageResponse>;
  signTypedData(message: any, accountNumber: number, password: string): Promise<SignTypedDataResponse>;
  openPopup(method: string, params: any, id: number, from: string): Promise<void>;
  getBtcSendData(accountNumber: number): Promise<GetBtcSendDataResponse>;
  getLiquidBalance(network: Networks, accountNumber: number): Promise<GetLiquidBalanceResponse>;
  getLiquidSendData(network: Networks, accountNumber: number): Promise<GetLiquidSendDataResponse>;
}
