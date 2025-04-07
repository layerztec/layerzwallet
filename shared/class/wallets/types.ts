/**
 * PORTED FROM  https://github.com/BlueWallet/BlueWallet/
 * LICENSE: MIT
 */
import bitcoin from 'bitcoinjs-lib';
import { CoinSelectOutput, CoinSelectReturnInput, CoinSelectUtxo } from 'coinselect';

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
export interface CreateTransactionUtxo extends CoinSelectUtxo {} // eslint-disable-line

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

export type LightningTransaction = {
  memo?: string;
  type?: 'user_invoice' | 'payment_request' | 'bitcoind_tx' | 'paid_invoice';
  payment_hash?: string | { data: string };
  category?: 'receive';
  timestamp?: number;
  expire_time?: number;
  ispaid?: boolean;
  walletID?: string;
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
  received?: number;
  value?: number;

  /**
   * if known, who is on the other end of the transaction (BIP47 payment code)
   */
  counterparty?: string;
};
