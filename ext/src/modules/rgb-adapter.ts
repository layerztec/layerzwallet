import type { BtcBalance, GeneratedKeys, InvoiceReceiveData, SendResult, WalletManager } from '@utexo/rgb-sdk';

import type { IRGBAdapter, RGBConnection, RGBNetwork } from '@shared/class/wallets/rgb-wallet';
import type {
  CreateBackupParams,
  CreateUtxosParams,
  BackupResult,
  DecodeRgbInvoiceResponseCustom,
  InvoiceRequestCustom,
  ListAssetsResponseCustom,
  RgbTransferCustom,
  SendAssetParams,
  SendBtcParams,
  TransactionCustom,
  UnspentCustom,
} from '@shared/class/wallets/rgb-types';

type RGBSDK = typeof import('@utexo/rgb-sdk');

class RGBAdapter implements IRGBAdapter {
  private sdk: RGBSDK | undefined;
  private wallet: WalletManager | undefined;
  private cc: RGBConnection | undefined;
  private sdkLock: Promise<void> = Promise.resolve();
  private _dataDir: string = 'rgb-data';

  /**
   * Wraps a method to ensure SDK initialization and locking.
   * Handles sync→async conversion for Node.js SDK methods.
   */
  private withLockAndWallet<T, Args extends unknown[]>(fn: (wallet: WalletManager, ...args: Args) => Promise<T> | T): (connection: RGBConnection, ...args: Args) => Promise<T> {
    return async (connection: RGBConnection, ...args: Args): Promise<T> => {
      let releaseLock: () => void = () => {};
      const lockPromise = new Promise<void>((resolve) => (releaseLock = resolve));
      await this.sdkLock;
      this.sdkLock = lockPromise;

      try {
        const wallet = await this.getWallet(connection);
        const result = fn(wallet, ...args);
        return result instanceof Promise ? await result : result;
      } finally {
        releaseLock();
      }
    };
  }

  /**
   * Gets or creates a WalletManager for the given connection.
   * Reuses existing wallet if connection params match.
   */
  private async getWallet(connection: RGBConnection): Promise<WalletManager> {
    // Initialize SDK if needed
    if (!this.sdk) {
      this.sdk = await import('@utexo/rgb-sdk');
    }

    // Reuse existing wallet if same connection
    if (this.wallet && this.cc && connection.mnemonic === this.cc.mnemonic && connection.network === this.cc.network) {
      return this.wallet;
    }

    // Derive keys and create new wallet
    const keys = await this.sdk.deriveKeysFromMnemonic(connection.network, connection.mnemonic);
    this.wallet = new this.sdk.WalletManager({
      xpubVan: keys.accountXpubVanilla,
      xpubCol: keys.accountXpubColored,
      masterFingerprint: keys.masterFingerprint,
      mnemonic: keys.mnemonic,
      network: connection.network,
      dataDir: connection.dataDir,
      transportEndpoint: connection.transportEndpoint,
      indexerUrl: connection.indexerUrl,
    });
    this.cc = connection;
    return this.wallet;
  }

  // ============================================
  // Private method implementations
  // ============================================

  private _registerWallet(wallet: WalletManager): { address: string; btcBalance: BtcBalance } {
    return wallet.registerWallet();
  }

  private _refreshWallet(wallet: WalletManager): void {
    wallet.refreshWallet();
  }

  private _getBtcBalance(wallet: WalletManager): BtcBalance {
    return wallet.getBtcBalance();
  }

  private _getAddress(wallet: WalletManager): string {
    return wallet.getAddress();
  }

  private _listUnspents(wallet: WalletManager): UnspentCustom[] {
    return wallet.listUnspents() as unknown as UnspentCustom[];
  }

  private _listAssets(wallet: WalletManager): ListAssetsResponseCustom {
    return wallet.listAssets() as unknown as ListAssetsResponseCustom;
  }

  private _sendBtcBegin(wallet: WalletManager, params: SendBtcParams): string {
    return wallet.sendBtcBegin(params);
  }

  private _sendBtcEnd(wallet: WalletManager, params: { signedPsbt: string }): string {
    return wallet.sendBtcEnd(params);
  }

  private _sendBegin(wallet: WalletManager, params: SendAssetParams): string {
    return wallet.sendBegin(params);
  }

  private _sendEnd(wallet: WalletManager, params: { signedPsbt: string }): SendResult {
    return wallet.sendEnd(params);
  }

  private async _createUtxos(wallet: WalletManager, params: CreateUtxosParams): Promise<number> {
    return await wallet.createUtxos(params);
  }

  private _blindReceive(wallet: WalletManager, params: InvoiceRequestCustom): InvoiceReceiveData {
    return wallet.blindReceive(params as Parameters<WalletManager['blindReceive']>[0]);
  }

  private _decodeRGBInvoice(wallet: WalletManager, params: { invoice: string }): DecodeRgbInvoiceResponseCustom {
    return wallet.decodeRGBInvoice(params) as unknown as DecodeRgbInvoiceResponseCustom;
  }

  private _listTransactions(wallet: WalletManager): TransactionCustom[] {
    return wallet.listTransactions() as unknown as TransactionCustom[];
  }

  private _listTransfers(wallet: WalletManager, assetId: string): RgbTransferCustom[] {
    return wallet.listTransfers(assetId) as unknown as RgbTransferCustom[];
  }

  private async _signPsbt(wallet: WalletManager, psbt: string): Promise<string> {
    return await wallet.signPsbt(psbt);
  }

  private _createBackup(wallet: WalletManager, params: CreateBackupParams): BackupResult {
    return wallet.createBackup(params);
  }

  // ============================================
  // Public API
  // ============================================

  get api() {
    const registerWallet = this.withLockAndWallet(this._registerWallet.bind(this));
    const refreshWallet = this.withLockAndWallet(this._refreshWallet.bind(this));
    const getBtcBalance = this.withLockAndWallet(this._getBtcBalance.bind(this));
    const getAddress = this.withLockAndWallet(this._getAddress.bind(this));
    const listUnspents = this.withLockAndWallet(this._listUnspents.bind(this));
    const listAssets = this.withLockAndWallet(this._listAssets.bind(this));
    const sendBtcBegin = this.withLockAndWallet(this._sendBtcBegin.bind(this));
    const sendBtcEnd = this.withLockAndWallet(this._sendBtcEnd.bind(this));
    const sendBegin = this.withLockAndWallet(this._sendBegin.bind(this));
    const sendEnd = this.withLockAndWallet(this._sendEnd.bind(this));
    const createUtxos = this.withLockAndWallet(this._createUtxos.bind(this));
    const blindReceive = this.withLockAndWallet(this._blindReceive.bind(this));
    const decodeRGBInvoice = this.withLockAndWallet(this._decodeRGBInvoice.bind(this));
    const listTransactions = this.withLockAndWallet(this._listTransactions.bind(this));
    const listTransfers = this.withLockAndWallet(this._listTransfers.bind(this));
    const signPsbt = this.withLockAndWallet(this._signPsbt.bind(this));
    const createBackup = this.withLockAndWallet(this._createBackup.bind(this));

    return {
      registerWallet,
      refreshWallet,
      getBtcBalance,
      getAddress,
      listUnspents,
      listAssets,
      sendBtcBegin,
      sendBtcEnd,
      sendBegin,
      sendEnd,
      createUtxos,
      blindReceive,
      decodeRGBInvoice,
      listTransactions,
      listTransfers,
      signPsbt,
      createBackup,
    };
  }

  async deriveKeysFromMnemonic(network: RGBNetwork, mnemonic: string): Promise<GeneratedKeys> {
    if (!this.sdk) {
      this.sdk = await import('@utexo/rgb-sdk');
    }
    return await this.sdk.deriveKeysFromMnemonic(network, mnemonic);
  }

  getDataDir(): string {
    return this._dataDir;
  }

  // File operations for backup management
  async fileExists(path: string): Promise<boolean> {
    try {
      const fs = await import('fs/promises');
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  async deleteFile(path: string): Promise<void> {
    const fs = await import('fs/promises');
    await fs.unlink(path);
  }

  async renameFile(from: string, to: string): Promise<void> {
    const fs = await import('fs/promises');
    await fs.rename(from, to);
  }
}

globalThis.rgbAdapter = new RGBAdapter();
