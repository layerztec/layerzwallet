/**
 * Based on https://github.com/vulpemventures/marina-provider
 * LICENSE: MIT
 */

import type { TxOutput } from 'liquidjs-lib';

export type TransactionID = string;
export type PsetBase64 = string;
export type SignatureBase64 = string;
export type NativeSegwitAddress = string;
export type ECPublicKey = string;
export type EventListenerID = string;
export type RawHex = string;
export type AccountID = string;
export type NetworkString = 'liquid' | 'testnet' | 'regtest';

export interface SignedMessage {
  signature: SignatureBase64;
  address: NativeSegwitAddress;
  publicKey: ECPublicKey;
}

export interface Transaction {
  txId: string;
  hex?: string;
  height: number; // 0 means unconfirmed
  explorerURL: string;
}

export interface ScriptDetails {
  networks: NetworkString[];
  accountName: string;
  derivationPath?: string;
  blindingPrivateKey?: string;
}

export type Address = {
  confidentialAddress?: string;
  unconfidentialAddress?: string;
  // contract?: Contract; // Ionio contract
  script: string;
  publicKey: string; // the public key associated with the derivation path
} & ScriptDetails;

export interface UnblindingData {
  value: number;
  asset: string;
  assetBlindingFactor: string;
  valueBlindingFactor: string;
}

export interface UnblindedOutput {
  txid: string;
  vout: number;
  blindingData?: UnblindingData; // optional, if not present it means marina can't unblind the output
}

export type Utxo = UnblindedOutput & { witnessUtxo?: TxOutput; scriptDetails?: ScriptDetails };

// add an OP_RETURN output
export type DataRecipient = {
  data: string;
} & AssetValue;

export type AddressRecipient = {
  address: string; // the recipient address
} & AssetValue;

export type Recipient = AddressRecipient | DataRecipient;

interface AssetValue {
  value: number; // the amount of sats to send
  asset: string; // the asset to send
}

export interface Asset {
  assetHash: string;
  name: string;
  precision: number;
  ticker: string;
}

export interface Balance {
  asset: Asset;
  amount: number;
}

export type MarinaEventType = 'NEW_UTXO' | 'NEW_TX' | 'SPENT_UTXO' | 'ENABLED' | 'DISABLED' | 'NETWORK';

// return object from sendTransaction
export interface SentTransaction {
  txid: TransactionID;
  hex: RawHex;
}

export enum AccountType {
  P2WPKH = 'p2wpkh',
  Ionio = 'ionio',
}

export interface AccountInfo {
  accountID: AccountID;
  type: AccountType;
  masterXPub: string;
  baseDerivationPath: string;
  accountNetworks: NetworkString[];
}

export type PubKeyWithRelativeDerivationPath = {
  publicKey: Buffer;
  derivationPath: string;
};

export type Outpoint = Pick<UnblindedOutput, 'txid' | 'vout'>;

export interface CoinSelection {
  utxos: UnblindedOutput[];
  changeOutputs?: { asset: string; amount: number }[];
}

// the raw tx data, as returned by the node & persisted in the db
// we use that to compute the tx flow and build a TxDetailsExtended object used by the UI
export interface TxDetails {
  height?: number;
  hex?: string;
}

export class CoinSelectionError extends Error {
  constructor(
    public target: { amount: number; asset: string },
    public selectedAmount: number
  ) {
    super(`Coin selection failed for ${target.amount} with ${selectedAmount} selected (asset: ${target.asset}))`);
    this.name = 'CoinSelectionError';
  }
}
