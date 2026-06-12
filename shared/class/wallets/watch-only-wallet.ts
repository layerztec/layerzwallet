/**
 * PORTED FROM  https://github.com/BlueWallet/BlueWallet/
 * LICENSE: MIT
 */
import BIP32Factory from 'bip32';
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import ecc from '@bitcoinerlab/secp256k1';
import { ECPairFactory } from 'ecpair';

import * as BlueElectrum from '../../blue_modules/BlueElectrum';
import { CommonTransaction } from '../../types/common-transaction';
import { SendQuote, SendQuoteRequest } from '../../types/send-quote';
import { AbstractWallet } from './abstract-wallet';
import { HDSegwitBech32Wallet } from './hd-segwit-bech32-wallet';
import { InterfaceSendQuotable } from './interface-send-quotable';
import { LegacyWallet } from './legacy-wallet';

const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);

export class WatchOnlyWallet extends LegacyWallet implements InterfaceSendQuotable {
  static readonly type = 'watchOnly';
  static readonly typeReadable = 'Watch-only';
  // @ts-ignore: override
  public readonly type = WatchOnlyWallet.type;
  // @ts-ignore: override
  public readonly typeReadable = WatchOnlyWallet.typeReadable;
  public isWatchOnlyWarningVisible = true;

  public _hdWalletInstance?: HDSegwitBech32Wallet;
  use_with_hardware_wallet = false;
  masterFingerprint: number = 0;

  /**
   * @inheritDoc
   */
  getLastTxFetch() {
    if (this._hdWalletInstance) return this._hdWalletInstance.getLastTxFetch();
    return super.getLastTxFetch();
  }

  timeToRefreshTransaction() {
    if (this._hdWalletInstance) return this._hdWalletInstance.timeToRefreshTransaction();
    return super.timeToRefreshTransaction();
  }

  timeToRefreshBalance() {
    if (this._hdWalletInstance) return this._hdWalletInstance.timeToRefreshBalance();
    return super.timeToRefreshBalance();
  }

  allowSend() {
    return this.useWithHardwareWalletEnabled() && this.isHd() && this._hdWalletInstance!.allowSend();
  }

  allowSignVerifyMessage() {
    return false;
  }

  getAddress() {
    if (this.isAddressValid(this.secret)) return this.secret; // handling case when there is an XPUB there
    if (this._hdWalletInstance) throw new Error('Should not be used in watch-only HD wallets');
    throw new Error('Not initialized');
  }

  valid() {
    if (this.secret.startsWith('xpub') || this.secret.startsWith('ypub') || this.secret.startsWith('zpub')) return this.isXpubValid();

    try {
      bitcoin.address.toOutputScript(this.getAddress());
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * this method creates appropriate HD wallet class, depending on whether we have zpub
   * as a property of `this`, and in case such property exists - it recreates it and copies data from old one.
   * this is needed after serialization/save/load/deserialization procedure.
   */
  init() {
    let hdWalletInstance: HDSegwitBech32Wallet;
    if (this.secret.startsWith('xpub')) throw new Error('xpub not supported');
    else if (this.secret.startsWith('ypub')) throw new Error('ypub not supported');
    else if (this.secret.startsWith('zpub')) hdWalletInstance = new HDSegwitBech32Wallet();
    else return this;
    hdWalletInstance._xpub = this.secret;

    // if derivation path recovered from JSON file it should be moved to hdWalletInstance
    if (this._derivationPath) {
      hdWalletInstance._derivationPath = this._derivationPath;
    }

    if (this._hdWalletInstance) {
      // now, porting all properties from old object to new one
      for (const k of Object.keys(this._hdWalletInstance)) {
        // @ts-ignore: JS magic here
        hdWalletInstance[k] = this._hdWalletInstance[k];
      }

      // deleting properties that cant survive serialization/deserialization:
      delete hdWalletInstance._node1;
      delete hdWalletInstance._node0;
    }
    this._hdWalletInstance = hdWalletInstance;

    return this;
  }

  prepareForSerialization() {
    if (this._hdWalletInstance) {
      delete this._hdWalletInstance._node0;
      delete this._hdWalletInstance._node1;
      delete this._hdWalletInstance._bip47_instance;
    }
  }

  getBalance() {
    if (this._hdWalletInstance) return this._hdWalletInstance.getBalance();
    return super.getBalance();
  }

  getTransactions() {
    if (this._hdWalletInstance) return this._hdWalletInstance.getTransactions();
    return super.getTransactions();
  }

  async fetchBalance() {
    if (this.secret.startsWith('xpub') || this.secret.startsWith('ypub') || this.secret.startsWith('zpub')) {
      if (!this._hdWalletInstance) this.init();
      if (!this._hdWalletInstance) throw new Error('Internal error: _hdWalletInstance is not initialized');
      return this._hdWalletInstance.fetchBalance();
    } else {
      // return LegacyWallet.prototype.fetchBalance.call(this);
      return super.fetchBalance();
    }
  }

  async fetchTransactions() {
    if (this.secret.startsWith('xpub') || this.secret.startsWith('ypub') || this.secret.startsWith('zpub')) {
      if (!this._hdWalletInstance) this.init();
      if (!this._hdWalletInstance) throw new Error('Internal error: _hdWalletInstance is not initialized');
      return this._hdWalletInstance.fetchTransactions();
    } else {
      // return LegacyWallet.prototype.fetchBalance.call(this);
      return super.fetchTransactions();
    }
  }

  async getAddressAsync(): Promise<string> {
    if (this.isAddressValid(this.secret)) return new Promise((resolve) => resolve(this.secret));
    if (this._hdWalletInstance) return this._hdWalletInstance.getAddressAsync();
    throw new Error('Not initialized');
  }

  _getExternalAddressByIndex(index: number) {
    if (this._hdWalletInstance) return this._hdWalletInstance._getExternalAddressByIndex(index);
    throw new Error('Not initialized');
  }

  _getInternalAddressByIndex(index: number) {
    if (this._hdWalletInstance) return this._hdWalletInstance._getInternalAddressByIndex(index);
    throw new Error('Not initialized');
  }

  getNextFreeAddressIndex() {
    if (this._hdWalletInstance) return this._hdWalletInstance.next_free_address_index;
    throw new Error('Not initialized');
  }

  getNextFreeChangeAddressIndex() {
    if (this._hdWalletInstance) return this._hdWalletInstance.next_free_change_address_index;
    throw new Error('Not initialized');
  }

  async getChangeAddressAsync() {
    if (this._hdWalletInstance) return this._hdWalletInstance.getChangeAddressAsync();
    throw new Error('Not initialized');
  }

  async fetchUtxo() {
    if (this._hdWalletInstance) return this._hdWalletInstance.fetchUtxo();
    throw new Error('Not initialized');
  }

  getUtxo(...args: Parameters<HDSegwitBech32Wallet['getUtxo']>) {
    if (this._hdWalletInstance) return this._hdWalletInstance.getUtxo(...args);
    throw new Error('Not initialized');
  }

  combinePsbt(...args: Parameters<HDSegwitBech32Wallet['combinePsbt']>) {
    if (this._hdWalletInstance) return this._hdWalletInstance.combinePsbt(...args);
    throw new Error('Not initialized');
  }

  broadcastTx(...args: Parameters<HDSegwitBech32Wallet['broadcastTx']>) {
    if (this._hdWalletInstance) return this._hdWalletInstance.broadcastTx(...args);
    throw new Error('Not initialized');
  }

  /**
   * signature of this method is the same ad BIP84 createTransaction, BUT this method should be used to create
   * unsinged PSBT to be used with HW wallet (or other external signer)
   */
  createTransaction(...args: Parameters<HDSegwitBech32Wallet['createTransaction']>) {
    const [utxos, targets, feeRate, changeAddress, sequence] = args;
    if (this._hdWalletInstance && this.isHd()) {
      const masterFingerprint = this.getMasterFingerprint();
      return this._hdWalletInstance.createTransaction(utxos, targets, feeRate, changeAddress, sequence, true, masterFingerprint);
    } else {
      throw new Error('Not a HD watch-only wallet, cant create PSBT (or just not initialized)');
    }
  }

  getMasterFingerprint() {
    return this.masterFingerprint;
  }

  getMasterFingerprintHex() {
    if (!this.masterFingerprint) return '00000000';
    let masterFingerprintHex = Number(this.masterFingerprint).toString(16);
    if (masterFingerprintHex.length < 8) masterFingerprintHex = '0' + masterFingerprintHex; // conversion without explicit zero might result in lost byte
    // poor man's little-endian conversion:
    // ¯\_(ツ)_/¯
    return (
      masterFingerprintHex[6] +
      masterFingerprintHex[7] +
      masterFingerprintHex[4] +
      masterFingerprintHex[5] +
      masterFingerprintHex[2] +
      masterFingerprintHex[3] +
      masterFingerprintHex[0] +
      masterFingerprintHex[1]
    );
  }

  isHd() {
    return this.secret.startsWith('xpub') || this.secret.startsWith('ypub') || this.secret.startsWith('zpub');
  }

  weOwnAddress(address: string) {
    if (this.isHd()) {
      if (this._hdWalletInstance) return this._hdWalletInstance.weOwnAddress(address);
      throw new Error('Not initialized');
    }

    if (address && address.startsWith('BC1')) address = address.toLowerCase();

    return this.getAddress() === address;
  }

  allowMasterFingerprint() {
    return this.getSecret().startsWith('zpub') || this.getSecret().startsWith('ypub') || this.getSecret().startsWith('xpub');
  }

  useWithHardwareWalletEnabled() {
    return !!this.use_with_hardware_wallet;
  }

  setUseWithHardwareWalletEnabled(enabled: boolean) {
    this.use_with_hardware_wallet = !!enabled;
  }

  /**
   * @inheritDoc
   */
  getAllExternalAddresses() {
    if (this._hdWalletInstance) return this._hdWalletInstance.getAllExternalAddresses();
    return super.getAllExternalAddresses();
  }

  isXpubValid() {
    let xpub;

    try {
      if (this.secret.startsWith('zpub')) {
        xpub = this._zpubToXpub(this.secret);
      } else if (this.secret.startsWith('ypub')) {
        xpub = AbstractWallet._ypubToXpub(this.secret);
      } else {
        xpub = this.secret;
      }

      const hdNode = bip32.fromBase58(xpub);
      hdNode.derive(0);
      return true;
    } catch (_) {}

    return false;
  }

  addressIsChange(...args: Parameters<HDSegwitBech32Wallet['addressIsChange']>) {
    if (this._hdWalletInstance) return this._hdWalletInstance.addressIsChange(...args);
    return super.addressIsChange(...args);
  }

  getUTXOMetadata(...args: Parameters<HDSegwitBech32Wallet['getUTXOMetadata']>) {
    if (this._hdWalletInstance) return this._hdWalletInstance.getUTXOMetadata(...args);
    return super.getUTXOMetadata(...args);
  }

  setUTXOMetadata(...args: Parameters<HDSegwitBech32Wallet['setUTXOMetadata']>) {
    if (this._hdWalletInstance) return this._hdWalletInstance.setUTXOMetadata(...args);
    return super.setUTXOMetadata(...args);
  }

  getDerivationPath(...args: Parameters<HDSegwitBech32Wallet['getDerivationPath']>) {
    if (this._hdWalletInstance) return this._hdWalletInstance.getDerivationPath(...args);
    throw new Error("Not a HD watch-only wallet, can't use derivation path");
  }

  setDerivationPath(...args: Parameters<HDSegwitBech32Wallet['setDerivationPath']>) {
    if (this._hdWalletInstance) return this._hdWalletInstance.setDerivationPath(...args);
    throw new Error("Not a HD watch-only wallet, can't use derivation path");
  }

  isSegwit(): boolean {
    if (this._hdWalletInstance) return this._hdWalletInstance.isSegwit();
    return super.isSegwit();
  }

  wasEverUsed(): Promise<boolean> {
    if (this._hdWalletInstance) return this._hdWalletInstance.wasEverUsed();
    return super.wasEverUsed();
  }

  async getCommonTransactions(afterTxid?: string, limit?: number): Promise<CommonTransaction[]> {
    if (this._hdWalletInstance) {
      return this._hdWalletInstance.getCommonTransactions(afterTxid, limit);
    }
    return [];
  }

  async getSendQuote(request: SendQuoteRequest): Promise<SendQuote> {
    if (!this._hdWalletInstance) this.init();
    if (!this._hdWalletInstance) throw new Error('WatchOnlyWallet not initialized');

    if (!BlueElectrum.mainConnected) await BlueElectrum.connectMain();
    await this.fetchBalance();
    await this.fetchUtxo();

    const feeRate = request.feeRate ?? (await BlueElectrum.estimateFee(6));
    const changeAddress = await this.getChangeAddressAsync();
    const targets = [{ address: request.toAddress, value: Number(request.amount) }];

    const { fee, psbt } = this.createTransaction(this.getUtxo(), targets, feeRate, changeAddress);

    return {
      request,
      fee: String(fee),
      feeTicker: 'BTC',
      _prepared: { psbt },
    };
  }

  async executeSendQuote(quote: SendQuote, mnemonic?: string, _accountNumber?: number): Promise<string> {
    if (!mnemonic) throw new Error('mnemonic is required for Bitcoin executeSendQuote');

    const { psbt } = quote._prepared as { psbt: bitcoin.Psbt };
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = bip32.fromSeed(seed as Buffer);

    for (let i = 0; i < psbt.inputCount; i++) {
      const derivations = psbt.data.inputs[i].bip32Derivation ?? [];
      let signed = false;
      let lastError: unknown;
      for (const der of derivations) {
        try {
          const child = root.derivePath(der.path);
          if (!child.privateKey) continue;
          psbt.signInput(i, ECPair.fromPrivateKey(child.privateKey));
          signed = true;
        } catch (e) {
          lastError = e;
        }
      }
      if (!signed) {
        // Without this, finalizeAllInputs() fails with an opaque "Can not finalize input #N".
        const paths = derivations.map((d) => d.path).join(', ') || '(none)';
        const reason = lastError instanceof Error ? lastError.message : 'no signable key derived';
        throw new Error(`Could not sign input #${i} (bip32 derivation paths: ${paths}): ${reason}`);
      }
    }

    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();
    if (!BlueElectrum.mainConnected) await BlueElectrum.connectMain();
    await BlueElectrum.broadcastV2(tx.toHex());
    return tx.getId();
  }
}
