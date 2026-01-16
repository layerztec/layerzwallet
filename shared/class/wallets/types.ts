/**
 * PORTED FROM  https://github.com/BlueWallet/BlueWallet/
 * LICENSE: MIT
 */
import * as bitcoin from 'bitcoinjs-lib';
import { CoinSelectOutput, CoinSelectReturnInput, CoinSelectUtxo } from 'coinselect';

import { TBitcoinUnit } from '../../models/bitcoinUnits';
import { HDSegwitBech32Wallet } from './hd-segwit-bech32-wallet';
import { LegacyWallet } from './legacy-wallet';
import { SegwitBech32Wallet } from './segwit-bech32-wallet';
import { SegwitP2SHWallet } from './segwit-p2sh-wallet';
import { TaprootWallet } from './taproot-wallet';
import { WatchOnlyWallet } from './watch-only-wallet';

export type Utxo = {
  // Returned by BlueElectrum
  height: number;
  address: string;
  txid: string;
  vout: number;
  value: number;

  // Others
  txhex?: string;
  confirmations?: number;
  wif?: string | false;
};

/**
 * same as coinselect.d.ts/CoinSelectUtxo
 */
export interface CreateTransactionUtxo extends CoinSelectUtxo {}

/**
 * if address is missing and `script.hex` is set - this is a custom script (like OP_RETURN)
 */
export type CreateTransactionTarget = {
  address?: string;
  value?: number;
  script?: {
    length?: number; // either length or hex should be present
    hex?: string;
  };
};

export type CreateTransactionResult = {
  tx?: bitcoin.Transaction;
  inputs: CoinSelectReturnInput[];
  outputs: CoinSelectOutput[];
  fee: number;
  psbt: bitcoin.Psbt;
};

type TransactionInput = {
  txid: string;
  vout: number;
  scriptSig: { asm: string; hex: string };
  txinwitness: string[];
  sequence: number;
  addresses?: string[];
  address?: string;
  value?: number;
};

export type TransactionOutput = {
  value: number;
  n: number;
  scriptPubKey: {
    asm: string;
    hex: string;
    reqSigs: number;
    type: string;
    addresses: string[];
  };
};

export interface DecodedInvoice {
  destination: string;
  payment_hash: string;
  num_satoshis: number;
  timestamp: number;
  expiry: number;
  description: string;
  description_hash: string;
  fallback_addr: string;
  cltv_expiry: string;
  route_hints: any[];
  [key: string]: any;
}

export type LightningTransaction = {
  memo?: string;
  type?: 'user_invoice' | 'payment_request' | 'bitcoind_tx' | 'paid_invoice';
  payment_hash?: string | { data: string };
  category?: 'receive';
  timestamp: number; // seconds, not milliseconds
  expire_time?: number;
  ispaid?: boolean;
  walletID?: string;
  value?: number;
  amt?: number;
  fee?: number;
  payment_preimage?: string;
  payment_request?: string;
  description?: string;
};

export type Transaction = {
  txid: string;
  hash: string;
  version: number;
  size: number;
  vsize: number;
  weight: number;
  locktime: number;
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
  blockhash: string;
  confirmations: number;
  time: number;
  blocktime: number;
  timestamp: number; // seconds, not milliseconds
  value?: number;

  /**
   * if known, who is on the other end of the transaction (BIP47 payment code)
   */
  counterparty?: string;
};

/**
 * Deep partial type for testing
 * https://stackoverflow.com/questions/61132262/typescript-deep-partial/61132308#61132308
 */
export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

/**
 * in some cases we add additional data to each tx object so the code that works with that transaction can find the
 * wallet that owns it etc
 */
export type ExtendedTransaction = Transaction & {
  walletID: string;
  walletPreferredBalanceUnit: TBitcoinUnit;
};

export type TWallet = HDSegwitBech32Wallet | LegacyWallet | SegwitBech32Wallet | SegwitP2SHWallet | TaprootWallet | WatchOnlyWallet;
