import * as RNAPI from '@utexo/rgb-sdk-rn';
import { File, Paths } from 'expo-file-system';

import type { BtcBalance, GeneratedKeys, InvoiceReceiveData, SendResult } from '@utexo/rgb-sdk';
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

class RGBAdapter implements IRGBAdapter {
  private wallet: RNAPI.WalletManager | undefined;
  private cc: RGBConnection | undefined;
  private sdkLock: Promise<void> = Promise.resolve();
  private _dataDir: string | undefined;

  /**
   * Wraps a method to ensure wallet initialization and locking.
   * All RN SDK methods are async by default.
   */
  private withLockAndWallet<T, Args extends unknown[]>(fn: (...args: Args) => Promise<T>): (connection: RGBConnection, ...args: Args) => Promise<T> {
    return async (connection: RGBConnection, ...args: Args): Promise<T> => {
      let releaseLock: () => void = () => {};
      const lockPromise = new Promise<void>((resolve) => (releaseLock = resolve));
      await this.sdkLock;
      this.sdkLock = lockPromise;

      try {
        await this.getWallet(connection);
        return await fn(...args);
      } finally {
        releaseLock();
      }
    };
  }

  /**
   * Gets or creates a WalletManager for the given connection.
   * Reuses existing wallet if connection params match.
   */
  private async getWallet(connection: RGBConnection): Promise<RNAPI.WalletManager> {
    // Reuse existing wallet if same connection
    if (this.wallet && this.cc && connection.mnemonic === this.cc.mnemonic && connection.network === this.cc.network) {
      return this.wallet;
    }

    // Derive keys and create new wallet
    const keys = await RNAPI.deriveKeysFromMnemonic(connection.network, connection.mnemonic);
    this.wallet = new RNAPI.WalletManager({
      xpubVan: keys.accountXpubVanilla,
      xpubCol: keys.accountXpubColored,
      masterFingerprint: keys.masterFingerprint,
      mnemonic: keys.mnemonic,
      dataDir: connection.dataDir,
      transportEndpoint: connection.transportEndpoint,
      // FIXME: https://github.com/UTEXO-Protocol/rgb-sdk-rn/issues/1
      // network: connection.network,
      // indexerUrl: connection.indexerUrl,
    });
    this.cc = connection;
    return this.wallet;
  }

  // ============================================
  // Private method implementations (all async for RN)
  // ============================================

  private async _registerWallet(): Promise<{ address: string; btcBalance: BtcBalance }> {
    // RN SDK uses initialize() instead of registerWallet()
    await this.wallet!.initialize();
    const address = await this.wallet!.getAddress();
    const btcBalance = await this.wallet!.getBtcBalance();
    return { address, btcBalance } as { address: string; btcBalance: BtcBalance };
  }

  private async _refreshWallet(): Promise<void> {
    await this.wallet!.refreshWallet();
  }

  private async _getBtcBalance(): Promise<BtcBalance> {
    return (await this.wallet!.getBtcBalance()) as BtcBalance;
  }

  private async _getAddress(): Promise<string> {
    return await this.wallet!.getAddress();
  }

  private async _listUnspents(): Promise<UnspentCustom[]> {
    return (await this.wallet!.listUnspents()) as unknown as UnspentCustom[];
  }

  private async _listAssets(): Promise<ListAssetsResponseCustom> {
    return (await this.wallet!.listAssets()) as unknown as ListAssetsResponseCustom;
  }

  private async _sendBtcBegin(params: SendBtcParams): Promise<string> {
    return await this.wallet!.sendBtcBegin(params);
  }

  private async _sendBtcEnd(params: { signedPsbt: string }): Promise<string> {
    return await this.wallet!.sendBtcEnd(params);
  }

  private async _sendBegin(params: SendAssetParams): Promise<string> {
    return await this.wallet!.sendBegin(params);
  }

  private async _sendEnd(params: { signedPsbt: string }): Promise<SendResult> {
    return (await this.wallet!.sendEnd(params)) as SendResult;
  }

  private async _createUtxos(params: CreateUtxosParams): Promise<number> {
    return await this.wallet!.createUtxos(params);
  }

  private async _blindReceive(params: InvoiceRequestCustom): Promise<InvoiceReceiveData> {
    return (await this.wallet!.blindReceive(params as Parameters<RNAPI.WalletManager['blindReceive']>[0])) as InvoiceReceiveData;
  }

  private async _decodeRGBInvoice(params: { invoice: string }): Promise<DecodeRgbInvoiceResponseCustom> {
    return (await this.wallet!.decodeRGBInvoice(params)) as unknown as DecodeRgbInvoiceResponseCustom;
  }

  private async _listTransactions(): Promise<TransactionCustom[]> {
    return (await this.wallet!.listTransactions()) as unknown as TransactionCustom[];
  }

  private async _listTransfers(assetId: string): Promise<RgbTransferCustom[]> {
    return (await this.wallet!.listTransfers(assetId)) as unknown as RgbTransferCustom[];
  }

  private async _signPsbt(psbt: string): Promise<string> {
    return await this.wallet!.signPsbt(psbt);
  }

  private async _createBackup(params: CreateBackupParams): Promise<BackupResult> {
    return (await this.wallet!.createBackup(params)) as BackupResult;
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
    return (await RNAPI.deriveKeysFromMnemonic(network, mnemonic)) as GeneratedKeys;
  }

  getDataDir(): string {
    if (!this._dataDir) {
      // Strip file:// prefix - RGB SDK expects raw filesystem path, not URI
      const basePath = Paths.document.uri.replace(/^file:\/\//, '');
      this._dataDir = `${basePath}rgb-data`;
    }
    return this._dataDir;
  }

  // File operations for backup management
  async fileExists(path: string): Promise<boolean> {
    const file = new File(`file://${path}`);
    return file.exists;
  }

  async deleteFile(path: string): Promise<void> {
    const file = new File(`file://${path}`);
    await file.delete();
  }

  async renameFile(from: string, to: string): Promise<void> {
    // Use copy + delete instead of move (move fails on files created by native modules)
    const fromFile = new File(`file://${from}`);
    const toFile = new File(`file://${to}`);
    await fromFile.copy(toFile);
    await fromFile.delete();
  }
}

globalThis.rgbAdapter = new RGBAdapter();
