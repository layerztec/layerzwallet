import { InMemoryKey, Wallet, WalletConfig } from '@arklabs/wallet-sdk';
import BIP32Factory from 'bip32';
import * as bip39 from 'bip39';
import assert from 'assert';

import { AbstractHDElectrumWallet } from './abstract-hd-electrum-wallet';
import ecc from '@bitcoinerlab/secp256k1';

// NetworkName is not directly exported from the SDK
type NetworkName = WalletConfig['network'];

const bip32 = BIP32Factory(ecc);

export class ArkWallet extends AbstractHDElectrumWallet {
  private _wallet: Wallet | undefined = undefined;
  private _arkServerUrl: string = 'https://mutinynet.arkade.sh';
  private _arkServerPublicKey: string = '03fa73c6e4876ffb2dfc961d763cca9abc73d4b88efcb8f5e7ff92dc55e9aa553d';
  private _network: NetworkName = 'mutinynet';
  private _accountNumber: number = 0;

  setAccountNumber(value: number) {
    this._accountNumber = value;
  }

  setArkServerUrl(url: string) {
    this._arkServerUrl = url;
  }

  setArkServerPublicKey(key: string) {
    this._arkServerPublicKey = key;
  }

  setNetwork(network: NetworkName) {
    this._network = network;
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

    const identity = InMemoryKey.fromHex(hex);

    this._wallet = await Wallet.create({
      network: this._network, // 'bitcoin', 'testnet', 'regtest', 'signet' or 'mutinynet'
      identity: identity,
      arkServerUrl: this._arkServerUrl,
      arkServerPublicKey: this._arkServerPublicKey,
    });
  }

  async getOffchainBalance() {
    if (!this._wallet) throw new Error('Ark wallet not initialized');

    const balance = await this._wallet.getBalance();
    return balance.offchain.total;
  }

  async pay(address: string, amount: number): Promise<string> {
    if (!this._wallet) throw new Error('Ark wallet not initialized');

    console.log(`paying ${amount} sat...`);
    return await this._wallet.sendBitcoin(
      {
        address,
        amount,
        // feeRate: 1,
      },
      true
    );
  }

  async getOffchainReceiveAddress(): Promise<string | undefined> {
    if (!this._wallet) throw new Error('Ark wallet not initialized');

    const { offchain } = await this._wallet.getAddress();
    return offchain;
  }

  async getOffchainBalanceForAddress(address: string) {
    const url = `${this._arkServerUrl}/v1/vtxos/${address}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch VTXOs: ${response.statusText}`);
    }
    const data = await response.json();
    // Convert from server format to our internal VTXO format and only return spendable coins (settled or pending)
    const vtxos = [...(data.spendableVtxos || [])].map((vtxo) => ({
      txid: vtxo.outpoint.txid,
      vout: vtxo.outpoint.vout,
      value: Number(vtxo.amount),
      status: {
        confirmed: !!vtxo.roundTxid,
      },
      virtualStatus: {
        state: vtxo.isPending ? 'pending' : 'settled',
        batchTxID: vtxo.roundTxid,
        batchExpiry: vtxo.expireAt ? Number(vtxo.expireAt) : undefined,
      },
    }));

    const offchainSettled = vtxos.filter((coin) => coin.virtualStatus.state === 'settled').reduce((sum, coin) => sum + coin.value, 0);
    const offchainPending = vtxos.filter((coin) => coin.virtualStatus.state === 'pending').reduce((sum, coin) => sum + coin.value, 0);

    return offchainSettled + offchainPending;
  }
}
