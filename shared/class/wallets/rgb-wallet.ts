import ecc from '@bitcoinerlab/secp256k1';
import assert from 'assert';
import { BIP32Factory } from 'bip32';
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import { createHash } from 'crypto';
import type { GeneratedKeys, SendResult } from '@utexo/rgb-sdk';

import * as BlueElectrum from '@shared/blue_modules/BlueElectrum';
import { concatUint8Arrays } from '../../modules/uint8array-extras';
import { AllNetworkInfos } from '../../models/all-network-infos';
import { CommonTokenTransfer, CommonTransaction, TransactionStatus } from '../../types/common-transaction';
import { NETWORK_RGB, NETWORK_RGB_TESTNET } from '../../types/networks';
import { CachedTokenInfo } from '../../types/token-info';
import { InterfaceAccountBasedWallet } from './interface-account-based-wallet';
import { InterfaceCanHaveTokens } from './interface-can-have-tokens';
import type { DecodeRgbInvoiceResponseCustom, InvoiceRequestCustom, ListAssetsResponseCustom, RgbTransferCustom, TransactionCustom, UnspentCustom } from './rgb-types';

/**
 * RGB SDK type - derived from the @utexo/rgb-sdk package exports.
 * This is a type-only import, no runtime code is executed.
 * Both @utexo/rgb-sdk (web) and @utexo/rgb-sdk-rn (react native) should have compatible types.
 */
export type RGBSDK = typeof import('@utexo/rgb-sdk');

/**
 * Decoded RGB invoice type.
 * Re-exported from custom types for external consumers.
 */
export type RgbDecodedInvoice = DecodeRgbInvoiceResponseCustom;

type RGBNetwork = 'mainnet' | 'testnet';

export interface IRGBAdapter {
  initialize(): Promise<RGBSDK>;
  getDataDir(): string;
}

export class RGBWallet implements InterfaceAccountBasedWallet, InterfaceCanHaveTokens {
  protected adapter: IRGBAdapter;
  private _sdk: RGBSDK | undefined;
  private _secret: string | undefined;
  private _network: RGBNetwork = 'mainnet';
  private _transportEndpoint: string = 'rpc://rgb-node.thunderstack.org/json-rpc';
  private _indexerUrl: string = 'ssl://electrum.iriswallet.com:50003'; // Updated in constructor based on network
  public _wallet: InstanceType<RGBSDK['WalletManager']> | undefined;
  private _accountNumber: number = 0;
  private _tokenBalances: CachedTokenInfo[] = [];
  public _lastBalanceFetch: number = 0;
  public _lastTokensFetch: number = 0;
  private _preparingWallet: boolean = false;

  constructor(network: RGBNetwork) {
    this._network = network;
    if (network === 'testnet') {
      this._transportEndpoint = 'rpc://rgb-node.test.thunderstack.org/json-rpc';
      this._indexerUrl = 'ssl://electrum.iriswallet.com:50013'; // Testnet3 server
    } else {
      this._transportEndpoint = 'rpc://rgb-node.thunderstack.org/json-rpc';
      this._indexerUrl = 'ssl://electrum.iriswallet.com:50003'; // Mainnet server
    }
    this.adapter = globalThis.rgbAdapter;
  }

  public setSecret(secret: string) {
    this._secret = secret;
  }

  public setNetwork(network: RGBNetwork) {
    this._network = network;
  }

  public setAccountNumber(num: number) {
    this._accountNumber = num;
  }

  public getAccountNumber(): number {
    return this._accountNumber;
  }

  /**
   * Custom method to derive keys from mnemonic
   * same as deriveKeysFromMnemonic, but with custom account number
   * @returns The derived keys
   */
  public async customDeriveKeysFromMnemonic(): Promise<GeneratedKeys> {
    assert(this._secret, 'RGBWallet secret is not set. Call setSecret() first.');
    const DERIVATION_PURPOSE = 86;
    const COIN_RGB_MAINNET = 827166;
    const COIN_RGB_TESTNET = 827167;
    const COIN_BITCOIN_MAINNET = 0;
    const COIN_BITCOIN_TESTNET = 1;

    const isMainnet = this._network === 'mainnet';
    const coinTypeBtc = isMainnet ? COIN_BITCOIN_MAINNET : COIN_BITCOIN_TESTNET;
    const coinTypeRgb = isMainnet ? COIN_RGB_MAINNET : COIN_RGB_TESTNET;

    const BIP32_VERSIONS = isMainnet ? { public: 0x0488b21e, private: 0x0488ade4 } : { public: 0x043587cf, private: 0x04358394 };

    const seed = bip39.mnemonicToSeedSync(this._secret);
    const bip32 = BIP32Factory(ecc);
    const root = bip32.fromSeed(seed, { bip32: BIP32_VERSIONS, wif: isMainnet ? 128 : 239 });

    // Calculate master fingerprint
    const pubkey = root.publicKey;
    const sha256Hash = createHash('sha256').update(pubkey).digest();
    const ripemd160Hash = createHash('ripemd160').update(sha256Hash).digest();
    const masterFingerprint = ripemd160Hash.subarray(0, 4).toString('hex');

    // Derive account xpubs with custom account number
    const vanillaPath = `m/${DERIVATION_PURPOSE}'/${coinTypeBtc}'/${this._accountNumber}'`;
    const coloredPath = `m/${DERIVATION_PURPOSE}'/${coinTypeRgb}'/${this._accountNumber}'`;

    const accountXpubVanilla = root.derivePath(vanillaPath).neutered().toBase58();
    const accountXpubColored = root.derivePath(coloredPath).neutered().toBase58();

    return {
      mnemonic: this._secret,
      xpub: root.neutered().toBase58(),
      xpriv: root.toBase58(),
      accountXpubVanilla,
      accountXpubColored,
      masterFingerprint,
    };
  }

  async init() {
    assert(this._secret, 'RGBWallet secret is not set. Call setSecret() first.');
    this._sdk = await this.adapter.initialize();
    // Can't use customDeriveKeysFromMnemonic() here because server throws 400 error while initialize
    // const restoredKeys = await this.customDeriveKeysFromMnemonic();
    const restoredKeys = await this._sdk.deriveKeysFromMnemonic(this._network, this._secret);
    this._wallet = new this._sdk.WalletManager({
      xpubVan: restoredKeys.accountXpubVanilla,
      xpubCol: restoredKeys.accountXpubColored,
      masterFingerprint: restoredKeys.masterFingerprint,
      mnemonic: restoredKeys.mnemonic,
      network: this._network,
      dataDir: this.adapter.getDataDir(),
      transportEndpoint: this._transportEndpoint,
      indexerUrl: this._indexerUrl,
    });
    this._wallet.registerWallet();
    setTimeout(() => this.prepareWallet(), 1000); // we don't want to block the main thread
  }

  /**
   * Check available colorable UTXOs and create new ones if needed.
   * Only runs in low-fee environment and when we have 1 or fewer available colorable UTXOs.
   */
  async prepareWallet(): Promise<void> {
    assert(this._wallet, 'RGBWallet not initialized. Call init() first.');

    // Prevent concurrent calls
    if (this._preparingWallet) return;
    this._preparingWallet = true;

    try {
      // Fee check (only proceed in low-fee environment)
      const fees = await this.getFeeEstimates();
      if (fees.medium > 3) {
        console.log('RGB prepareWallet: fees.medium > 3, skipping');
        return;
      }

      // Check available colorable UTXOs
      const unspents = this.listUnspents();
      if (unspents.length === 0) {
        console.log('RGB prepareWallet: no UTXOs available, skipping');
        return;
      }
      const availableColorable = unspents.filter((u) => u.utxo.colorable && !u.pendingBlinded && (!u.rgbAllocations || u.rgbAllocations.length === 0));

      // Only proceed if 1 or fewer available
      if (availableColorable.length > 1) {
        console.log('RGB prepareWallet: availableColorable.length > 1, skipping');
        return;
      }

      // Create UTXOs (server validates balance, upTo:true creates as many as affordable)
      await this._wallet.createUtxos({
        upTo: true,
        num: 5,
        size: 1000,
        feeRate: fees.slow,
      });
      console.log('RGB prepareWallet: UTXOs created');
    } catch (error) {
      console.error('[RGB] prepareWallet failed:', error);
    } finally {
      this._preparingWallet = false;
    }
  }

  get sdk(): RGBSDK {
    assert(this._sdk, 'RGBWallet not initialized. Call init() first.');
    return this._sdk;
  }

  // ============================================
  // SDK Wrapper Methods (with corrected types)
  // ============================================
  // The @utexo/rgb-sdk uses camelCase properties.
  // These wrappers provide correct return types. See rgb-types.ts for details.

  private listUnspents(): UnspentCustom[] {
    assert(this._wallet, 'RGBWallet not initialized. Call init() first.');
    return this._wallet.listUnspents() as unknown as UnspentCustom[];
  }

  private listAssets(): ListAssetsResponseCustom {
    assert(this._wallet, 'RGBWallet not initialized. Call init() first.');
    return this._wallet.listAssets() as unknown as ListAssetsResponseCustom;
  }

  private decodeInvoice(invoice: string): DecodeRgbInvoiceResponseCustom {
    assert(this._wallet, 'RGBWallet not initialized. Call init() first.');
    return this._wallet.decodeRGBInvoice({ invoice }) as unknown as DecodeRgbInvoiceResponseCustom;
  }

  private completeBtcSend(signedPsbt: string): string {
    assert(this._wallet, 'RGBWallet not initialized. Call init() first.');
    return this._wallet.sendBtcEnd({ signedPsbt });
  }

  private completeTokenSend(signedPsbt: string): SendResult {
    assert(this._wallet, 'RGBWallet not initialized. Call init() first.');
    return this._wallet.sendEnd({ signedPsbt });
  }

  private blindReceive(request: InvoiceRequestCustom) {
    assert(this._wallet, 'RGBWallet not initialized. Call init() first.');
    return this._wallet.blindReceive(request as Parameters<typeof this._wallet.blindReceive>[0]);
  }

  /**
   * Create a backup of the wallet state.
   * @param backupPath - Path to save the backup file
   * @param password - Password to encrypt the backup
   * @returns The backup file path
   */
  createBackup(backupPath: string, password: string): string {
    assert(this._wallet, 'RGBWallet not initialized. Call init() first.');
    const response = this._wallet.createBackup({ backupPath, password });
    return response.backupPath;
  }

  // ============================================
  // Public Methods
  // ============================================

  public async getBalance() {
    assert(this._wallet, 'RGBWallet not initialized. Call init() first.');
    const balance = this._wallet.getBtcBalance();
    return balance.vanilla.spendable + balance.colored.spendable;
  }

  // InterfaceAccountBasedWallet implementation

  async getOffchainReceiveAddress(): Promise<string> {
    assert(this._wallet, 'RGBWallet not initialized. Call init() first.');
    return this._wallet.getAddress();
  }

  async getOffchainBalance(): Promise<number> {
    assert(this._wallet, 'RGBWallet not initialized. Call init() first.');
    const balance = this._wallet.getBtcBalance();
    this._lastBalanceFetch = Date.now();
    await this.fetchTokenBalances();
    return balance.vanilla.spendable + balance.colored.spendable;
  }

  /**
   * Prepare a BTC send transaction (sign but don't broadcast)
   * @param address - Recipient taproot address (bc1p/tb1p)
   * @param amount - Amount in satoshis
   * @param feeRate - Fee rate in sats/vB
   * @returns Signed PSBT ready for broadcast
   */
  async sendBtcPrepare(address: string, amount: number, feeRate: number): Promise<string> {
    assert(this._wallet, 'RGBWallet not initialized. Call init() first.');
    assert(this._sdk, 'RGBWallet SDK not initialized.');
    const psbt = this._wallet.sendBtcBegin({
      address,
      amount,
      feeRate,
    });
    return await this._wallet.signPsbt(psbt);
  }

  /**
   * Broadcast a signed BTC transaction
   * @param signedPsbt - Signed PSBT from sendBtcPrepare
   * @returns Transaction ID
   */
  async sendBtcBroadcast(signedPsbt: string): Promise<string> {
    return this.completeBtcSend(signedPsbt);
  }

  /**
   * Send BTC (convenience method that combines prepare and broadcast)
   * @param address - Recipient taproot address
   * @param amount - Amount in satoshis
   * @param feeRate - Fee rate in sats/vB (optional, defaults to medium)
   * @returns Transaction ID
   */
  async pay(address: string, amount: number, feeRate?: number): Promise<string> {
    throw new Error('Not implemented');
  }

  /**
   * Generate a witness receive invoice for receiving RGB tokens.
   * This creates an invoice that can receive any token without specifying which one.
   * @param amount - Amount to receive (in base units)
   * @returns The RGB invoice string
   */
  async getWitnessReceiveInvoice(amount: number): Promise<string> {
    assert(this._wallet, 'RGBWallet not initialized. Call init() first.');
    assert(amount > 0, 'Amount must be greater than 0');
    // SDK declares assetId as required but runtime allows it to be optional for any-asset invoices
    const invoiceRequest: InvoiceRequestCustom = { amount };
    const receiveData = this.blindReceive(invoiceRequest);
    return receiveData.invoice;
  }

  /**
   * Generate a blind receive invoice for receiving RGB tokens.
   * This method ensures colorable UTXOs are available before creating the invoice.
   * If insufficient colorable UTXOs exist, it will automatically create new ones.
   *
   * Similar to IRIS wallet's invoice generation flow that handles UTXO management automatically.
   *
   * @param amount - Amount to receive (in base units). Required for the invoice.
   * @param assetId - Optional asset ID. If not provided, creates a wildcard invoice that can receive any token.
   * @param feeRate - Optional fee rate for UTXO creation (sats/vB). If not provided, uses slow fee estimate.
   * @returns Object containing the invoice string and expiration timestamp
   * @throws Error if wallet has no balance and cannot create UTXOs
   */
  async createBlindInvoice(amount: number, assetId?: string, feeRate?: number): Promise<{ invoice: string; expirationTimestamp: number }> {
    assert(this._wallet, 'RGBWallet not initialized. Call init() first.');
    assert(amount > 0, 'Amount must be greater than 0');

    // Ensure UTXOs are available for the invoice
    await this.ensureColorableUtxos(feeRate);

    // Generate the blind invoice
    const invoiceRequest: InvoiceRequestCustom = { amount };
    if (assetId) {
      invoiceRequest.assetId = assetId;
    }

    try {
      const receiveData = this.blindReceive(invoiceRequest);
      return {
        invoice: receiveData.invoice,
        expirationTimestamp: receiveData.expirationTimestamp ?? Math.floor(Date.now() / 1000) + 86400, // default 24h
      };
    } catch (error: unknown) {
      // Handle InsufficientAllocationSlots - retry after creating UTXOs
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('InsufficientAllocationSlots') || errorMessage.includes('allocation') || errorMessage.includes('slot')) {
        console.log('[RGB] blindReceive failed with allocation error, creating UTXOs and retrying');
        await this.createColorableUtxos(feeRate);
        const receiveData = this.blindReceive(invoiceRequest);
        return {
          invoice: receiveData.invoice,
          expirationTimestamp: receiveData.expirationTimestamp ?? Math.floor(Date.now() / 1000) + 86400,
        };
      }
      throw error;
    }
  }

  /**
   * Ensure at least one colorable UTXO is available for RGB operations.
   * Creates new UTXOs if none are available.
   *
   * @param feeRate - Optional fee rate for UTXO creation (sats/vB). Defaults to slow fee estimate.
   * @throws Error if wallet has no balance to create UTXOs
   */
  async ensureColorableUtxos(feeRate?: number): Promise<void> {
    const unspents = this.listUnspents();
    const availableColorable = unspents.filter((u) => u.utxo.colorable && !u.pendingBlinded && (!u.rgbAllocations || u.rgbAllocations.length === 0));

    // Create UTXOs if none available
    if (availableColorable.length === 0) {
      // Check if we have any UTXOs at all (need balance to create colorable UTXOs)
      if (unspents.length === 0) {
        throw new Error('No UTXOs available. Please fund the wallet with Bitcoin first.');
      }
      await this.createColorableUtxos(feeRate);
    }
  }

  /**
   * Create colorable UTXOs for RGB operations.
   * Creates up to 5 UTXOs of 1000 sats each (the SDK will create as many as the balance allows).
   *
   * @param feeRate - Optional fee rate for UTXO creation (sats/vB). Defaults to slow fee estimate.
   */
  async createColorableUtxos(feeRate?: number): Promise<void> {
    assert(this._wallet, 'RGBWallet not initialized. Call init() first.');

    // Get fee rate if not provided
    if (!feeRate) {
      const fees = await this.getFeeEstimates();
      feeRate = fees.slow;
    }

    console.log(`[RGB] Creating colorable UTXOs with fee rate: ${feeRate} sats/vB`);
    await this._wallet.createUtxos({
      upTo: true, // Create as many as affordable up to 'num'
      num: 5, // Target number of UTXOs
      size: 1000, // Size in sats for each UTXO
      feeRate,
    });
    console.log('[RGB] Colorable UTXOs created successfully');
  }

  // InterfaceCanHaveTokens implementation

  async fetchTokenBalances(): Promise<void> {
    const assets = this.listAssets();
    this._tokenBalances = [];
    const chainId = this._network === 'mainnet' ? 20 : 21;

    for (const key of ['nia', 'uda', 'cfa'] as (keyof ListAssetsResponseCustom)[]) {
      if (!assets[key]) continue;
      for (const asset of assets[key]) {
        this._tokenBalances.push({
          id: asset.assetId,
          name: asset.name,
          symbol: asset.ticker,
          decimals: asset.precision,
          chainId,
          balance: String(asset.balance.settled),
        });
      }
    }
    this._lastTokensFetch = Date.now();
  }

  getTokenBalances(): CachedTokenInfo[] {
    return this._tokenBalances;
  }

  /**
   * Get unified transaction history including both Bitcoin on-chain transactions and RGB token transfers
   * Merges BTC transactions and RGB transfers with matching txids into single entries
   * Also creates a backup after fetching transactions
   * @returns Array of CommonTransaction objects
   */
  async getCommonTransactions(): Promise<CommonTransaction[]> {
    assert(this._wallet, 'RGBWallet not initialized. Call init() first.');

    const network = this._network === 'mainnet' ? NETWORK_RGB : NETWORK_RGB_TESTNET;
    const explorerBase = AllNetworkInfos[network].explorerUrl;

    // Map to store transactions by txid for merging
    const txMap = new Map<string, CommonTransaction>();

    // Fetch Bitcoin on-chain transactions
    // TransactionType: RGB_SEND=0, DRAIN=1, CREATE_UTXOS=2, USER=3
    const btcTransactions = this._wallet.listTransactions();

    for (const tx of btcTransactions as unknown as TransactionCustom[]) {
      const status: TransactionStatus = tx.confirmationTime ? 'confirmed' : 'pending';
      const timestamp = tx.confirmationTime?.timestamp ?? Math.floor(Date.now() / 1000);

      // Determine direction and amount based on transactionType
      // Note: SDK declares transactionType as enum (number), but actual data is string
      let direction: 'send' | 'receive' | 'swap';
      let amount: number = 0;

      switch (tx.transactionType) {
        case 'RgbSend': // RGB token send, amount is 0
          direction = 'send';
          break;
        case 'CreateUtxos': // Internal UTXO management
          direction = 'swap';
          amount = -tx.fee;
          break;
        default: // User - regular Bitcoin transaction
          if (tx.received > 0 && tx.sent > 0) {
            // Both received and sent - this is a swap/consolidation
            direction = 'swap';
            amount = tx.received - tx.sent;
          } else if (tx.received > 0) {
            // Only received - incoming payment
            direction = 'receive';
            amount = tx.received;
          } else {
            // Only sent - outgoing payment
            direction = 'send';
            amount = tx.sent;
          }
          break;
      }

      txMap.set(tx.txid, {
        network,
        txid: tx.txid,
        amount,
        timestamp,
        status,
        direction,
        fee: tx.fee,
        blockHeight: tx.confirmationTime?.height,
        explorerUrl: explorerBase ? `${explorerBase}/tx/${tx.txid}` : undefined,
      });
    }

    // Fetch RGB token transfers for each known asset
    const assets = this.listAssets();

    // Build asset info map for quick lookup (all asset types for token info)
    const assetInfoMap = new Map<string, { name: string; symbol: string; decimals: number }>();
    for (const key of ['nia', 'uda', 'cfa'] as (keyof ListAssetsResponseCustom)[]) {
      if (!assets[key]) continue;
      for (const asset of assets[key]) {
        if (asset.assetId) {
          assetInfoMap.set(asset.assetId, {
            name: asset.name ?? 'Unknown',
            symbol: asset.ticker ?? '???',
            decimals: asset.precision ?? 0,
          });
        }
      }
    }

    // Only fetch transfers for NIA assets (listTransfers may not support other types)
    const niaAssetIds: string[] = [];
    if (assets.nia) {
      for (const asset of assets.nia) {
        if (asset.assetId) {
          niaAssetIds.push(asset.assetId);
        }
      }
    }

    // Process transfers for each NIA asset
    for (const assetId of niaAssetIds) {
      const assetInfo = assetInfoMap.get(assetId)!;
      const transfers = this._wallet.listTransfers(assetId) as unknown as RgbTransferCustom[];

      for (const transfer of transfers) {
        // Map RGB transfer status to CommonTransaction status
        // Note: SDK declares status as enum (number), but actual data is string
        let rgbStatus: TransactionStatus;
        switch (transfer.status) {
          case 'Settled':
            rgbStatus = 'confirmed';
            break;
          case 'Failed':
            rgbStatus = 'failed';
            break;
          default: // WaitingCounterparty or WaitingConfirmations
            rgbStatus = 'pending';
        }

        // Determine direction based on kind field
        // Note: SDK declares kind as enum (number), but actual data is string
        const direction = transfer.kind === 'Send' ? 'send' : 'receive';

        // Amount is in requestedAssignment.Fungible, not in amount field
        const amount = transfer.requestedAssignment?.Fungible ?? 0;

        const tokenTransfer: CommonTokenTransfer = {
          tokenId: assetId,
          name: assetInfo.name,
          symbol: assetInfo.symbol,
          decimals: assetInfo.decimals,
          amount,
          address: transfer.recipientId,
        };

        const txid = transfer.txid ?? `rgb-transfer-${transfer.idx}-${transfer.batchTransferIdx}`;
        const existingTx = txMap.get(txid);

        if (existingTx) {
          // Merge with existing BTC transaction
          existingTx.tokenTransfers = existingTx.tokenTransfers || [];
          existingTx.tokenTransfers.push(tokenTransfer);
          existingTx.counterparty = transfer.recipientId;
          // For RGB transfers, the RGB status takes precedence over BTC status
          // A transfer isn't complete until RGB state is settled, even if BTC is confirmed
          if (rgbStatus === 'pending') {
            existingTx.status = 'pending';
          }
        } else {
          // No matching BTC transaction, create standalone RGB transfer entry
          txMap.set(txid, {
            network,
            txid,
            timestamp: transfer.updatedAt || transfer.createdAt,
            status: rgbStatus,
            direction,
            tokenTransfers: [tokenTransfer],
            counterparty: transfer.recipientId,
            explorerUrl: transfer.txid && explorerBase ? `${explorerBase}/tx/${transfer.txid}` : undefined,
          });
        }
      }
    }

    // Convert map to array and sort by timestamp, newest first
    const commonTransactions = Array.from(txMap.values());
    commonTransactions.sort((a, b) => b.timestamp - a.timestamp);

    // Create backup after fetching transactions
    try {
      const backupPath = `${this.adapter.getDataDir()}/backup_${Date.now()}.rgbbackup`;
      this.createBackup(backupPath, 'auto-backup');
      console.log('[RGB] Auto-backup created:', backupPath);
    } catch (error) {
      console.error('[RGB] Failed to create auto-backup:', error);
    }

    return commonTransactions;
  }

  /**
   * Decode and validate an RGB invoice
   * Use this to validate invoices before attempting to send
   * @param invoice - RGB invoice string (rgb:... format)
   * @returns Decoded invoice info including assetId, amount, expiration, etc.
   * @throws Error if invoice is invalid
   */
  async decodeRgbInvoice(invoice: string): Promise<RgbDecodedInvoice> {
    return this.decodeInvoice(invoice);
  }

  /**
   * Prepare an RGB token send (sign but don't broadcast)
   * @param tokenId - Asset ID of the token to send
   * @param amount - Amount in base units (considering token decimals)
   * @param invoice - RGB invoice (rgb:... format)
   * @param feeRate - Fee rate in sats/vB
   * @returns Signed PSBT ready for broadcast
   */
  async sendTokenPrepare(tokenId: string, amount: bigint, invoice: string, feeRate: number): Promise<string> {
    assert(this._wallet, 'RGBWallet not initialized. Call init() first.');
    assert(this._sdk, 'RGBWallet SDK not initialized.');

    // Decode the invoice first to understand what it expects
    const decodedInvoice = this.decodeInvoice(invoice);

    // Build sendBegin params
    const sendParams: {
      invoice: string;
      minConfirmations: number;
      feeRate: number;
      assetId?: string;
      amount?: number;
    } = {
      invoice,
      minConfirmations: 1,
      feeRate,
    };

    // Only pass assetId if invoice doesn't specify one (wildcard invoice)
    if (!decodedInvoice.assetId) {
      sendParams.assetId = tokenId;
    } else if (decodedInvoice.assetId !== tokenId) {
      throw new Error(`Invoice asset (${decodedInvoice.assetId}) does not match selected token (${tokenId})`);
    }

    // Only pass amount if invoice doesn't specify one
    if (!decodedInvoice.assignment?.amount) {
      sendParams.amount = Number(amount);
    }

    // Use sendBegin to create unsigned PSBT for token transfer
    const psbt = this._wallet.sendBegin(sendParams);

    // Sign the PSBT
    return await this._wallet.signPsbt(psbt);
  }

  /**
   * Broadcast a signed RGB token transfer
   * @param signedPsbt - Signed PSBT from sendTokenPrepare
   * @returns Transaction ID
   */
  async sendTokenBroadcast(signedPsbt: string): Promise<string> {
    const result = this.completeTokenSend(signedPsbt);
    return result.txid;
  }

  /**
   * Send an RGB token (convenience method that combines prepare and broadcast)
   * @param tokenId - Asset ID of the token to send
   * @param amount - Amount in base units (considering token decimals)
   * @param invoice - RGB invoice (rgb:... format) - passed as 'address' to match interface
   * @param feeRateStr - Fee rate in sats/vB as string (optional, defaults to medium). Passed as 'memo' to match interface.
   * @returns Transaction ID
   */
  async transferToken(tokenId: string, amount: bigint, invoice: string, feeRateStr?: string): Promise<string> {
    assert(this._wallet, 'RGBWallet not initialized. Call init() first.');

    let feeRate = feeRateStr ? Number(feeRateStr) : undefined;
    if (!feeRate || isNaN(feeRate)) {
      const fees = await this.getFeeEstimates();
      feeRate = fees.medium;
    }

    const signedPsbt = await this.sendTokenPrepare(tokenId, amount, invoice, feeRate);
    return await this.sendTokenBroadcast(signedPsbt);
  }

  /**
   * Static method to validate RGB addresses without creating an instance
   * RGB uses bitcoin taproot addresses or RGB invoices
   * @param address The address to validate
   * @returns true if the address is valid, false otherwise
   */
  static isAddressValid(address: string): boolean {
    // Accept valid taproot addresses or RGB invoices
    return RGBWallet.isTaprootAddress(address) || RGBWallet.isRgbInvoice(address);
  }

  /**
   * Static method to check if a string is an RGB invoice
   * @param str The string to check
   * @returns true if the string is an RGB invoice
   */
  static isRgbInvoice(str: string): boolean {
    return str.startsWith('rgb:');
  }

  /**
   * Static method to check if a string is a valid taproot address
   * Validates using bitcoinjs-lib to ensure proper format and checksum
   * @param str The string to check
   * @returns true if the string is a valid taproot address
   */
  static isTaprootAddress(str: string): boolean {
    if (!str.startsWith('bc1p') && !str.startsWith('tb1p')) {
      return false;
    }

    try {
      const decoded = bitcoin.address.fromBech32(str);
      if (decoded.version !== 1) return false; // Taproot is segwit version 1
      if (decoded.data.length !== 32) return false; // Taproot public key must be 32 bytes
      const pubkey = concatUint8Arrays([new Uint8Array([2]), decoded.data]); // Validate it's a valid point on the curve (prepend 0x02 prefix for compressed pubkey)
      if (!ecc.isPoint(pubkey)) return false;
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Instance method to validate addresses
   */
  isAddressValid(address: string): boolean {
    return RGBWallet.isAddressValid(address);
  }

  /**
   * Get fee estimates for transactions
   * @returns Fee estimates (slow, medium, fast) in sats/vB
   */
  async getFeeEstimates(): Promise<{ slow: number; medium: number; fast: number }> {
    if (!BlueElectrum.mainConnected) {
      await BlueElectrum.connectMain();
    }
    return await BlueElectrum.estimateFees();
  }
}
