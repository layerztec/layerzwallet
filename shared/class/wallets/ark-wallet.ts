import { SingleKey, Wallet, TxType } from '@arkade-os/sdk';
import ecc from '@bitcoinerlab/secp256k1';
import BIP32Factory from 'bip32';
import * as bip39 from 'bip39';
import assert from 'assert';

import { AbstractHDElectrumWallet } from './abstract-hd-electrum-wallet';
import { CommonTransaction } from '../../types/common-transaction';
import { NETWORK_ARK_MUTINYNET } from '../../types/networks';

const bip32 = BIP32Factory(ecc);

export class ArkWallet extends AbstractHDElectrumWallet {
  private _wallet: Wallet | undefined = undefined;
  private _arkServerUrl: string = 'https://mutinynet.arkade.sh';
  private _arkServerPublicKey: string = '03fa73c6e4876ffb2dfc961d763cca9abc73d4b88efcb8f5e7ff92dc55e9aa553d';
  private _accountNumber: number = 0;

  /**
   * Check if this wallet supports Lightning payments
   */
  get isLightningSupported(): boolean {
    return false; // Base ArkWallet doesn't support Lightning
  }

  setAccountNumber(value: number) {
    this._accountNumber = value;
  }

  setArkServerUrl(url: string) {
    this._arkServerUrl = url;
  }

  setArkServerPublicKey(key: string) {
    this._arkServerPublicKey = key;
  }

  async init() {
    const mnemonic = this.secret;
    const passphrase = this.passphrase;
    const seed = bip39.mnemonicToSeedSync(mnemonic, passphrase);

    const index = 0;
    const internal = 0;
    const accountNumber = this._accountNumber;
    const root = bip32.fromSeed(seed);
    const path = `m/86'/0'/${accountNumber}'/${internal}/${index}`;
    const child = root.derivePath(path);
    assert(child.privateKey, 'Internal error: no private key for child');
    const hex = child.privateKey?.toString('hex');

    const identity = SingleKey.fromHex(hex);

    this._wallet = await Wallet.create({
      identity: identity,
      arkServerUrl: this._arkServerUrl,
      arkServerPublicKey: this._arkServerPublicKey,
    });
  }

  async getOffchainBalance() {
    if (!this._wallet) throw new Error('Ark wallet not initialized');

    const balance = await this._wallet.getBalance();
    return balance.available;
  }

  async pay(address: string, amount: number): Promise<string> {
    if (!this._wallet) throw new Error('Ark wallet not initialized');

    console.log(`paying ${amount} sat...`);
    return await this._wallet.sendBitcoin({
      address,
      amount,
      // feeRate: 1,
    });
  }

  async getOffchainReceiveAddress(): Promise<string> {
    if (!this._wallet) throw new Error('Ark wallet not initialized');

    const address = await this._wallet.getAddress();
    return address;
  }

  async getCommonTransactions(): Promise<CommonTransaction[]> {
    if (!this._wallet) throw new Error('Ark wallet not initialized');

    const transactions = await this._wallet.getTransactionHistory();

    const commonTransactions: CommonTransaction[] = [];

    for (const transaction of transactions) {
      const timestamp = Math.floor(transaction.createdAt / 1000);
      commonTransactions.push({
        network: NETWORK_ARK_MUTINYNET,
        txid: transaction.key.arkTxid,
        timestamp,
        direction: transaction.type === TxType.TxSent ? 'send' : 'receive',
        amount: transaction.amount,
      });
    }

    return commonTransactions;
  }
}
