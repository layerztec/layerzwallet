import { SingleKey, Wallet, TxType } from '@arkade-os/sdk';
import { ArkadeLightning, BoltzSwapProvider, StorageProvider, decodeInvoice } from '@arkade-os/boltz-swap';
// import { AsyncStorage as RNAsyncStorageAdapter  } from '@arkade-os/boltz-swap';
// @ts-ignore fixme
import { Storage } from '@arkade-os/boltz-swap';
import ecc from '@bitcoinerlab/secp256k1';
import BIP32Factory from 'bip32';
import * as bip39 from 'bip39';
import assert from 'assert';

import { AbstractHDElectrumWallet } from './abstract-hd-electrum-wallet';
import { CommonTransaction } from '../../types/common-transaction';
import { NETWORK_ARK_MUTINYNET } from '../../types/networks';
import { createLightningInvoiceResponse, InterfaceLightningWallet, LightningPaymentLimitsResponse } from './interface-lightning-wallet';
import { IStorage } from '@shared/types/IStorage';

const bip32 = BIP32Factory(ecc);

export class ArkWallet extends AbstractHDElectrumWallet implements InterfaceLightningWallet {
  private _wallet: Wallet | undefined = undefined;
  private _arkadeLightning: ArkadeLightning | undefined = undefined;
  private _arkServerUrl: string = 'https://mutinynet.arkade.sh';
  private _arkServerPublicKey: string = '03fa73c6e4876ffb2dfc961d763cca9abc73d4b88efcb8f5e7ff92dc55e9aa553d';
  private _boltzApiUrl: string = '';
  private _accountNumber: number = 0;
  public allowLightning: true = true;

  setAccountNumber(value: number) {
    this._accountNumber = value;
  }

  setArkServerUrl(url: string) {
    assert(!this._wallet, 'Wallet already initialized');
    this._arkServerUrl = url;
  }

  setBoltzApiUrl(url: string) {
    assert(!this._arkadeLightning, 'Already initialized');
    this._boltzApiUrl = url;
  }

  setArkServerPublicKey(key: string) {
    assert(!this._wallet, 'Wallet already initialized');
    this._arkServerPublicKey = key;
  }

  _getIdentity() {
    assert(this.secret, 'No secret provided');
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

    return SingleKey.fromHex(hex);
  }

  async init() {
    const identity = this._getIdentity();

    this._wallet = await Wallet.create({
      identity,
      arkServerUrl: this._arkServerUrl,
      arkServerPublicKey: this._arkServerPublicKey,
    });
  }

  async initLightningSwaps(layerzStorage: IStorage) {
    assert(this._wallet, 'Ark wallet must be initialized first');
    assert(this._boltzApiUrl, 'Boltz Api Url is not set');

    class MyCustomStorage implements Storage {
      async getItem(key: string): Promise<string | null> {
        return await layerzStorage.getItem(key);
      }

      async setItem(key: string, value: string): Promise<void> {
        return await layerzStorage.setItem(key, value);
      }

      async removeItem(key: string): Promise<void> {
        // nop
      }

      async clear(): Promise<void> {
        // nop
      }
    }

    const customStorage = new MyCustomStorage();
    // @ts-ignore fixme
    const storageProvider = new StorageProvider(customStorage);

    // Initialize the Lightning swap provider
    const swapProvider = new BoltzSwapProvider({
      apiUrl: this._boltzApiUrl,
      network: 'bitcoin',
    });

    // const identity = this._getIdentity();

    // @ts-ignore remove when its fixed in Ark dep
    // this._wallet.sign = identity.sign.bind(identity);
    // @ts-ignore remove when its fixed in Ark dep
    // this._wallet.xOnlyPublicKey = identity.xOnlyPublicKey.bind(identity);
    // @ts-ignore remove when its fixed in Ark dep
    // this._wallet.signerSession = identity.signerSession.bind(identity);

    // Create the ArkadeLightning instance
    this._arkadeLightning = new ArkadeLightning({
      wallet: this._wallet,
      swapProvider,
      storageProvider, // optional
    });
  }

  async getOffchainBalance() {
    if (!this._wallet) throw new Error('Ark wallet not initialized');

    if (this._arkadeLightning) {
      // lets try to claim all pending incoming swaps
      const pendingReverseSwaps = this._arkadeLightning.getPendingReverseSwaps();
      if ((pendingReverseSwaps ?? []).length > 0) console.log('got', pendingReverseSwaps?.length ?? [], 'pending swaps');

      for (const swap of pendingReverseSwaps ?? []) {
        console.log('claiming...');
        try {
          await this._arkadeLightning.claimVHTLC(swap);
          console.log('claimed!');
        } catch (error: any) {
          console.log('could not claim:', error.message);
        }
      }
    }

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

  async createLightningInvoice(amountSats: number, memo: string): Promise<createLightningInvoiceResponse> {
    assert(this._arkadeLightning, 'Ark Lightning not initialized');
    assert(amountSats > 333, 'Only invoices > 333 sat allowed');

    const result = await this._arkadeLightning.createLightningInvoice({
      amount: amountSats,
      description: memo,
    });

    console.log('Expiry (seconds):', result.expiry);
    console.log('Lightning Invoice:', result.invoice);
    console.log('Payment Hash:', result.paymentHash);
    console.log('Pending swap', result.pendingSwap);
    console.log('Preimage', result.preimage);

    // Monitor the payment, it will resolve when the payment is received
    // console.log('calling waitAndClaim...');
    // const receivalResult = await this._arkadeLightning.waitAndClaim(result.pendingSwap);
    // console.log('Receival successful!');
    // console.log('Transaction ID:', receivalResult.txid);

    return {
      invoice: result.invoice,
      serviceFeeSat: 1, // FIXME: hardcoded till Ark sdk provides actual number
    };
  }

  fetchLightningLimits(): Promise<LightningPaymentLimitsResponse> {
    // fixme
    return Promise.resolve({
      receive: {
        minSat: 333,
        maxSat: 100000000,
        maxZeroConfSat: 0,
      },
      send: {
        minSat: 333,
        maxSat: 100000000,
        maxZeroConfSat: 0,
      },
    });
  }

  isInvoicePaid(invoice: string): Promise<boolean> {
    // todo: iterate through `this._arkadeLightning.getPendingReverseSwaps();` and find the record that has our invoice string and `status === "invoice.settled"`
    // throw new Error('Not implemented');
    return Promise.resolve(false);
  }

  async payLightningInvoice(invoice: string, masFeePercentage: number = 1): Promise<boolean> {
    assert(this._arkadeLightning, 'Ark Lightning not initialized');
    const invoiceDetails = decodeInvoice(invoice);

    console.log('Invoice amount:', invoiceDetails.amountSats, 'sats');
    console.log('Description:', invoiceDetails.description);
    console.log('Payment Hash:', invoiceDetails.paymentHash);

    const maxFeeSats = Math.ceil((invoiceDetails.amountSats / 100) * masFeePercentage);

    // Pay the Lightning invoice from your Arkade wallet
    const paymentResult = await this._arkadeLightning.sendLightningPayment({
      invoice, // Lightning invoice string
      maxFeeSats, // Optional: Maximum fee you're willing to pay (in sats)
    });

    console.log('Payment successful!');
    console.log('Amount:', paymentResult.amount);
    console.log('Preimage:', paymentResult.preimage);
    console.log('Transaction ID:', paymentResult.txid);
    return true;
  }
}
