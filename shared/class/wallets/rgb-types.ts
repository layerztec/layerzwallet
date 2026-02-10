/**
 * Custom types for RGB SDK API calls.
 *
 * These types extend/override @utexo/rgb-sdk types where the SDK definitions
 * don't match actual runtime data. Verified against integration tests 2026-02-05.
 *
 * Issues found:
 * 1. AssetNIA.balance - SDK says BtcBalance, actual is Balance
 * 2. Unspent - SDK missing pendingBlinded and utxo.exists fields
 * 3. Transaction.transactionType - SDK says enum number, actual is string
 * 4. RgbTransfer - status/kind are strings not enums, amount replaced by requestedAssignment
 * 5. InvoiceRequest.assetId - SDK says required, but optional for wildcard invoices
 */

import type { AssetNIA, Balance, Utxo, Unspent, RgbTransfer, Transaction, InvoiceRequest, DecodeRgbInvoiceResponse } from '@utexo/rgb-sdk';

/**
 * Utxo with additional 'exists' field present in actual data.
 */
export interface UtxoCustom extends Utxo {
  exists?: boolean;
}

/**
 * Unspent with pendingBlinded field and corrected Utxo type.
 */
export interface UnspentCustom extends Omit<Unspent, 'utxo'> {
  utxo: UtxoCustom;
  pendingBlinded?: number; // Returns 0 or 1
}

/**
 * AssetNIA with correct balance type (Balance, not BtcBalance).
 */
export interface AssetNIACustom extends Omit<AssetNIA, 'balance'> {
  assetId: string; // Make required (SDK has optional)
  name: string;
  ticker: string;
  precision: number;
  balance: Balance; // SDK incorrectly says BtcBalance
}

/**
 * List assets response with non-optional arrays.
 */
export interface ListAssetsResponseCustom {
  nia: AssetNIACustom[];
  uda: AssetNIACustom[];
  cfa: AssetNIACustom[];
  ifa?: AssetNIACustom[];
}

/**
 * Invoice request with optional assetId for wildcard invoices.
 */
export interface InvoiceRequestCustom extends Omit<InvoiceRequest, 'assetId'> {
  assetId?: string;
}

/**
 * Decoded invoice response - SDK type is accurate, just re-type for clarity.
 */
export type DecodeRgbInvoiceResponseCustom = DecodeRgbInvoiceResponse;

/**
 * RGB Transfer with string enums and correct field names.
 * SDK has number enums and 'amount' field, actual has strings and 'requestedAssignment'.
 */
export interface RgbTransferCustom extends Omit<RgbTransfer, 'status' | 'kind' | 'amount' | 'transportEndpoints'> {
  status: 'WaitingCounterparty' | 'WaitingConfirmations' | 'Settled' | 'Failed';
  kind: 'Issuance' | 'ReceiveBlind' | 'ReceiveWitness' | 'Send' | 'Inflation';
  transportEndpoints: Array<{
    endpoint: string;
    transportType: string;
    used: boolean;
  }>;
  requestedAssignment?: { Fungible?: number; [key: string]: unknown };
  assignments?: Array<{ Fungible?: number; [key: string]: unknown }>;
  invoiceString?: string;
  consignmentPath?: string;
}

/**
 * Transaction with string transactionType instead of enum.
 */
export interface TransactionCustom extends Omit<Transaction, 'transactionType'> {
  transactionType: 'RgbSend' | 'Drain' | 'CreateUtxos' | 'User';
}

// ============================================
// Adapter Parameter Types
// ============================================

/**
 * Parameters for sending RGB assets.
 */
export interface SendAssetParams {
  invoice: string;
  assetId?: string;
  amount?: number;
  feeRate: number;
  minConfirmations?: number;
}

/**
 * Parameters for creating colorable UTXOs.
 */
export interface CreateUtxosParams {
  upTo?: boolean;
  num?: number;
  size?: number;
  feeRate: number;
}

/**
 * Parameters for sending BTC.
 */
export interface SendBtcParams {
  address: string;
  amount: number;
  feeRate: number;
}

/**
 * Parameters for creating backups.
 */
export interface CreateBackupParams {
  backupPath: string;
  password: string;
}

/**
 * Result from backup creation.
 */
export interface BackupResult {
  backupPath: string;
}
