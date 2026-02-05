import ecc from '@bitcoinerlab/secp256k1';
import assert from 'assert';
import * as bitcoin from 'bitcoinjs-lib';
import type { BtcBalance, GeneratedKeys, InvoiceReceiveData, SendResult } from '@utexo/rgb-sdk';

import * as BlueElectrum from '@shared/blue_modules/BlueElectrum';
import { concatUint8Arrays } from '../../modules/uint8array-extras';
import { AllNetworkInfos } from '../../models/all-network-infos';
import { CommonTokenTransfer, CommonTransaction, TransactionStatus } from '../../types/common-transaction';
import { NETWORK_RGB, NETWORK_RGB_TESTNET } from '../../types/networks';
import { CachedTokenInfo } from '../../types/token-info';
import { InterfaceAccountBasedWallet } from './interface-account-based-wallet';
import { InterfaceCanHaveTokens } from './interface-can-have-tokens';
import type {
  BackupResult,
  CreateBackupParams,
  CreateUtxosParams,
  DecodeRgbInvoiceResponseCustom,
  InvoiceRequestCustom,
  ListAssetsResponseCustom,
  RgbTransferCustom,
  SendAssetParams,
  SendBtcParams,
  TransactionCustom,
  UnspentCustom,
} from './rgb-types';

/**
 * Decoded RGB invoice type.
 * Re-exported from custom types for external consumers.
 */
export type RgbDecodedInvoice = DecodeRgbInvoiceResponseCustom;

export type RGBNetwork = 'mainnet' | 'testnet';

/**
 * Connection parameters for RGB adapter.
 * Contains all information needed to initialize/identify a wallet session.
 */
export type RGBConnection = {
  mnemonic: string;
  network: RGBNetwork;
  dataDir: string;
  transportEndpoint: string;
  indexerUrl: string;
};

/**
 * RGB Adapter interface following the Breez adapter pattern.
 * All methods are async, adapters handle platform-specific SDK calls internally.
 */
export interface IRGBAdapter {
  api: {
    // Wallet Lifecycle
    registerWallet(connection: RGBConnection): Promise<{ address: string; btcBalance: BtcBalance }>;
    refreshWallet(connection: RGBConnection): Promise<void>;

    // Balance & Address
    getBtcBalance(connection: RGBConnection): Promise<BtcBalance>;
    getAddress(connection: RGBConnection): Promise<string>;
    listUnspents(connection: RGBConnection): Promise<UnspentCustom[]>;

    // Assets
    listAssets(connection: RGBConnection): Promise<ListAssetsResponseCustom>;

    // BTC Transactions (2-step)
    sendBtcBegin(connection: RGBConnection, params: SendBtcParams): Promise<string>;
    sendBtcEnd(connection: RGBConnection, params: { signedPsbt: string }): Promise<string>;

    // Token Transactions (2-step)
    sendBegin(connection: RGBConnection, params: SendAssetParams): Promise<string>;
    sendEnd(connection: RGBConnection, params: { signedPsbt: string }): Promise<SendResult>;

    // UTXO Management
    createUtxos(connection: RGBConnection, params: CreateUtxosParams): Promise<number>;

    // Invoices
    blindReceive(connection: RGBConnection, params: InvoiceRequestCustom): Promise<InvoiceReceiveData>;
    decodeRGBInvoice(connection: RGBConnection, params: { invoice: string }): Promise<DecodeRgbInvoiceResponseCustom>;

    // History
    listTransactions(connection: RGBConnection): Promise<TransactionCustom[]>;
    listTransfers(connection: RGBConnection, assetId: string): Promise<RgbTransferCustom[]>;

    // Signing
    signPsbt(connection: RGBConnection, psbt: string): Promise<string>;

    // Backup
    createBackup(connection: RGBConnection, params: CreateBackupParams): Promise<BackupResult>;
  };

  // Key derivation (standalone, doesn't need active connection)
  deriveKeysFromMnemonic(network: RGBNetwork, mnemonic: string): Promise<GeneratedKeys>;

  getDataDir(): string;
}

export class RGBWallet implements InterfaceAccountBasedWallet, InterfaceCanHaveTokens {
  protected adapter: IRGBAdapter;
  private _secret: string | undefined;
  private _network: RGBNetwork = 'mainnet';
  private _transportEndpoint: string = 'rpc://rgb-node.thunderstack.org/json-rpc';
  private _indexerUrl: string = 'ssl://electrum.iriswallet.com:50003';
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

  /**
   * Returns the connection parameters for the current wallet session.
   * Used by adapter methods to identify the wallet context.
   */
  private get connection(): RGBConnection {
    assert(this._secret, 'RGBWallet secret is not set. Call setSecret() first.');
    return {
      mnemonic: this._secret,
      network: this._network,
      dataDir: this.adapter.getDataDir(),
      transportEndpoint: this._transportEndpoint,
      indexerUrl: this._indexerUrl,
    };
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

  async init() {
    assert(this._secret, 'RGBWallet secret is not set. Call setSecret() first.');
    const result = await this.adapter.api.registerWallet(this.connection);
    console.info('RGBWallet initialized', result);
    setTimeout(() => this.prepareWallet(), 1000); // we don't want to block the main thread
  }

  /**
   * Check available colorable UTXOs and create new ones if needed.
   * Only runs in low-fee environment and when we have 1 or fewer available colorable UTXOs.
   */
  async prepareWallet(): Promise<void> {
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
      const unspents = await this.adapter.api.listUnspents(this.connection);
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
      await this.adapter.api.createUtxos(this.connection, {
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

  /**
   * Create a backup of the wallet state.
   * @param backupPath - Path to save the backup file
   * @param password - Password to encrypt the backup
   * @returns The backup file path
   */
  async createBackup(backupPath: string, password: string): Promise<string> {
    const response = await this.adapter.api.createBackup(this.connection, { backupPath, password });
    return response.backupPath;
  }

  // ============================================
  // Public Methods
  // ============================================

  public async getBalance(): Promise<number> {
    const balance = await this.adapter.api.getBtcBalance(this.connection);
    return balance.vanilla.spendable + balance.colored.spendable;
  }

  // InterfaceAccountBasedWallet implementation

  async getOffchainReceiveAddress(): Promise<string> {
    return await this.adapter.api.getAddress(this.connection);
  }

  async getOffchainBalance(): Promise<number> {
    const balance = await this.adapter.api.getBtcBalance(this.connection);
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
    const psbt = await this.adapter.api.sendBtcBegin(this.connection, {
      address,
      amount,
      feeRate,
    });
    return await this.adapter.api.signPsbt(this.connection, psbt);
  }

  /**
   * Broadcast a signed BTC transaction
   * @param signedPsbt - Signed PSBT from sendBtcPrepare
   * @returns Transaction ID
   */
  async sendBtcBroadcast(signedPsbt: string): Promise<string> {
    return await this.adapter.api.sendBtcEnd(this.connection, { signedPsbt });
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
    assert(amount > 0, 'Amount must be greater than 0');
    // SDK declares assetId as required but runtime allows it to be optional for any-asset invoices
    const invoiceRequest: InvoiceRequestCustom = { amount };
    const receiveData = await this.adapter.api.blindReceive(this.connection, invoiceRequest);
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
    assert(amount > 0, 'Amount must be greater than 0');

    // Ensure UTXOs are available for the invoice
    await this.ensureColorableUtxos(feeRate);

    // Generate the blind invoice
    const invoiceRequest: InvoiceRequestCustom = { amount };
    if (assetId) {
      invoiceRequest.assetId = assetId;
    }

    try {
      const receiveData = await this.adapter.api.blindReceive(this.connection, invoiceRequest);
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
        const receiveData = await this.adapter.api.blindReceive(this.connection, invoiceRequest);
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
    const unspents = await this.adapter.api.listUnspents(this.connection);
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
    // Get fee rate if not provided
    if (!feeRate) {
      const fees = await this.getFeeEstimates();
      feeRate = fees.slow;
    }

    console.log(`[RGB] Creating colorable UTXOs with fee rate: ${feeRate} sats/vB`);
    await this.adapter.api.createUtxos(this.connection, {
      upTo: true, // Create as many as affordable up to 'num'
      num: 5, // Target number of UTXOs
      size: 1000, // Size in sats for each UTXO
      feeRate,
    });
    console.log('[RGB] Colorable UTXOs created successfully');
  }

  // InterfaceCanHaveTokens implementation

  async fetchTokenBalances(): Promise<void> {
    const assets = await this.adapter.api.listAssets(this.connection);
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
    const network = this._network === 'mainnet' ? NETWORK_RGB : NETWORK_RGB_TESTNET;
    const explorerBase = AllNetworkInfos[network].explorerUrl;

    // Map to store transactions by txid for merging
    const txMap = new Map<string, CommonTransaction>();

    // Fetch Bitcoin on-chain transactions
    // TransactionType: RGB_SEND=0, DRAIN=1, CREATE_UTXOS=2, USER=3
    const btcTransactions = await this.adapter.api.listTransactions(this.connection);

    for (const tx of btcTransactions) {
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
    const assets = await this.adapter.api.listAssets(this.connection);

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
      const transfers = await this.adapter.api.listTransfers(this.connection, assetId);

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
      await this.createBackup(backupPath, 'auto-backup');
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
    return await this.adapter.api.decodeRGBInvoice(this.connection, { invoice });
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
    // Decode the invoice first to understand what it expects
    const decodedInvoice = await this.adapter.api.decodeRGBInvoice(this.connection, { invoice });

    // Build sendBegin params
    const sendParams: SendAssetParams = {
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
    const psbt = await this.adapter.api.sendBegin(this.connection, sendParams);

    // Sign the PSBT
    return await this.adapter.api.signPsbt(this.connection, psbt);
  }

  /**
   * Broadcast a signed RGB token transfer
   * @param signedPsbt - Signed PSBT from sendTokenPrepare
   * @returns Transaction ID
   */
  async sendTokenBroadcast(signedPsbt: string): Promise<string> {
    const result = await this.adapter.api.sendEnd(this.connection, { signedPsbt });
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
