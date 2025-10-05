import { SingleKey, Wallet, TxType, Ramps } from '@arkade-os/sdk';
import { ArkadeLightning, BoltzSwapProvider, decodeInvoice } from '@arkade-os/boltz-swap';
import ecc from '@bitcoinerlab/secp256k1';
import BIP32Factory from 'bip32';
import * as bip39 from 'bip39';
import assert from 'assert';

import { AbstractHDElectrumWallet } from './abstract-hd-electrum-wallet';
import { CommonTransaction } from '../../types/common-transaction';
import { NETWORK_ARKADE, NETWORK_ARKADE_MUTINYNET } from '../../types/networks';
import { createLightningInvoiceResponse, InterfaceLightningWallet, LightningPaymentLimitsResponse } from './interface-lightning-wallet';
import { IStorage } from '@shared/types/IStorage';
import { CommonSwap } from '@shared/types/common-swap';
import * as BlueElectrum from '../../blue_modules/BlueElectrum';

const bip32 = BIP32Factory(ecc);

export class ArkadeWallet extends AbstractHDElectrumWallet implements InterfaceLightningWallet {
  private _wallet: Wallet | undefined = undefined;
  private _arkadeLightning: ArkadeLightning | undefined = undefined;
  private _arkServerUrl: string = 'https://mutinynet.arkade.sh';
  private _arkServerPublicKey: string = '03fa73c6e4876ffb2dfc961d763cca9abc73d4b88efcb8f5e7ff92dc55e9aa553d';
  private _boltzApiUrl: string = '';
  private _accountNumber: number = 0;

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

    return SingleKey.fromPrivateKey(child.privateKey);
  }

  async init(layerzStorage: IStorage) {
    const identity = this._getIdentity();

    class ArkCustomStorage {
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

    const storage = new ArkCustomStorage();

    this._wallet = await Wallet.create({
      storage,
      identity,
      arkServerUrl: this._arkServerUrl,
      arkServerPublicKey: this._arkServerPublicKey,
    });
  }

  async initLightningSwaps() {
    assert(this._wallet, 'Arkade wallet must be initialized first');
    assert(this._boltzApiUrl, 'Boltz Api Url is not set');

    // Initialize the Lightning swap provider
    const swapProvider = new BoltzSwapProvider({
      apiUrl: this._boltzApiUrl,
      network: 'bitcoin',
    });

    // Create the ArkadeLightning instance
    this._arkadeLightning = new ArkadeLightning({
      wallet: this._wallet,
      swapProvider,
    });
  }

  async getOffchainBalance() {
    if (!this._wallet) throw new Error('Arkade wallet not initialized');

    if (this._arkadeLightning) {
      await this._attemptToClaimPendingVHTLCs();
    }

    const balance = await this._wallet.getBalance();
    return balance.available;
  }

  async _attemptToClaimPendingVHTLCs() {
    assert(this._wallet, 'Arkade wallet not initialized');
    assert(this._arkadeLightning, 'Ark Lightning not initialized');

    const pendingReverseSwaps = await this._arkadeLightning.getPendingReverseSwaps();
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

  async pay(address: string, amount: number): Promise<string> {
    if (!this._wallet) throw new Error('Arkade wallet not initialized');

    console.log(`paying ${amount} sat...`);
    return await this._wallet.sendBitcoin({
      address,
      amount,
      // feeRate: 1,
    });
  }

  async getOffchainReceiveAddress(): Promise<string> {
    if (!this._wallet) throw new Error('Arkade wallet not initialized');

    const address = await this._wallet.getAddress();
    return address;
  }

  async getCommonTransactions(): Promise<CommonTransaction[]> {
    if (!this._wallet) throw new Error('Arkade wallet not initialized');

    const transactions = await this._wallet.getTransactionHistory();

    const commonTransactions: CommonTransaction[] = [];

    for (const transaction of transactions) {
      if (!transaction.key.arkTxid) continue; // here we only show arkadeade transactions

      const createdAt = transaction.createdAt || new Date().getTime(); // createdAt is 0 if tx is unconfirmed
      const timestamp = Math.floor(createdAt / 1000);
      commonTransactions.push({
        network: this._arkServerUrl.includes('mutiny') ? NETWORK_ARKADE_MUTINYNET : NETWORK_ARKADE, // hacky
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

    return {
      invoice: result.invoice,
      serviceFeeSat: 1, // FIXME: hardcoded till Arkade sdk provides actual number
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

  async isInvoicePaid(invoice: string): Promise<boolean> {
    assert(this._arkadeLightning, 'Ark Lightning not initialized');

    await this._attemptToClaimPendingVHTLCs();

    for (const swap of (await this._arkadeLightning.getSwapHistory()) ?? []) {
      if (swap.status === 'invoice.settled' && swap.type === 'reverse' && swap.response.invoice === invoice) {
        return true;
      }
    }
    return Promise.resolve(false);
  }

  async payLightningInvoice(invoice: string, masFeePercentage: number = 1): Promise<boolean> {
    assert(this._arkadeLightning, 'Ark Lightning not initialized');
    const invoiceDetails = decodeInvoice(invoice);

    console.log('Invoice amount:', invoiceDetails.amountSats, 'sats');
    console.log('Description:', invoiceDetails.description);
    console.log('Payment Hash:', invoiceDetails.paymentHash);

    const maxFeeSats = Math.ceil((invoiceDetails.amountSats / 100) * masFeePercentage);

    const paymentResult = await this._arkadeLightning.sendLightningPayment({
      invoice,
      maxFeeSats,
    });

    console.log('Payment successful!');
    console.log('Amount:', paymentResult.amount);
    console.log('Preimage:', paymentResult.preimage);
    console.log('Transaction ID:', paymentResult.txid);
    return true;
  }

  allowLightning() {
    return !!this._arkadeLightning;
  }

  async getOnchainDepositAddress(): Promise<string> {
    if (!this._wallet) throw new Error('Arkade wallet not initialized');

    return await this._wallet.getBoardingAddress();
  }

  async getCommonSwaps(): Promise<CommonSwap[]> {
    if (!this._wallet) throw new Error('Arkade wallet not initialized');
    if (!BlueElectrum.mainConnected) await BlueElectrum.connectMain();

    const swaps: CommonSwap[] = [];
    const network = this._arkServerUrl.includes('mutinynet') ? NETWORK_ARKADE_MUTINYNET : NETWORK_ARKADE;
    const transactions = await this._wallet.getTransactionHistory();

    // unclaimed swaps
    const unclaimedTxs = transactions.filter((tx) => tx.key.boardingTxid && !tx.settled);
    const txs1 = await BlueElectrum.multiGetTransactionByTxid([...unclaimedTxs.map((tx) => tx.key.boardingTxid)], true);
    const unclaimedSwaps: CommonSwap[] = unclaimedTxs.map((tx) => {
      const txDetails = txs1[tx.key.boardingTxid];
      const timestamp = tx.createdAt || new Date().getTime();
      const confirmations = txDetails.confirmations ?? 0;
      const claimable = confirmations >= 1; // can be claimed once it's unconfirmed
      return {
        network,
        id: tx.key.boardingTxid,
        status: claimable ? 'claimable' : 'pending',
        amount: tx.amount,
        timestamp,
        direction: 'receive',
        // we only want to show confirmations for 'pending' swaps
        confirmations: !claimable ? confirmations : undefined,
        targetConfirmations: !claimable ? 1 : undefined,
      };
    });
    swaps.push(...unclaimedSwaps);

    // claimed swaps
    const claimedTxs = transactions.filter((tx) => tx.key.boardingTxid && tx.settled);
    const claimedSwaps: CommonSwap[] = claimedTxs.map((tx) => {
      const timestamp = tx.createdAt || new Date().getTime();
      return {
        network,
        id: tx.key.boardingTxid,
        status: 'confirmed',
        timestamp,
        amount: tx.amount,
        direction: 'receive',
      };
    });
    swaps.push(...claimedSwaps);

    return swaps;
  }

  async claimDepositArk(txid: string): Promise<void> {
    if (!this._wallet) throw new Error('Arkade wallet not initialized');

    const boardingUtxos = (await this._wallet.getBoardingUtxos()).filter((utxo) => utxo.txid === txid);

    await new Ramps(this._wallet).onboard(boardingUtxos);
  }
}
