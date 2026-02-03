/**
 * Custom types for RGB SDK API calls.
 *
 * The rgb-sdk TypeScript definitions are inaccurate in several places,
 * causing type mismatches with actual runtime responses. These custom types
 * correct the discrepancies.
 *
 * GitHub Issue: https://github.com/RGB-OS/rgb-sdk/issues/6
 */

/**
 * Correct asset balance shape.
 * SDK incorrectly declares this as BtcBalance ({ vanilla: Balance; colored: Balance })
 * but runtime returns this flat structure for AssetNIA.balance
 */
export interface AssetBalanceCustom {
  settled: number;
  future: number;
  spendable: number;
  offchain_outbound: number;
  offchain_inbound: number;
}

/**
 * Correct decoded invoice shape.
 * SDK declares return type as SendAssetBeginRequestModel but runtime returns this shape.
 */
export interface DecodeRgbInvoiceResponseCustom {
  recipient_id: string;
  asset_schema: string | null;
  asset_id: string | null;
  assignment: { amount: number } | null;
  assignment_name: string;
  network: number;
  expiration_timestamp: number;
  transport_endpoints: string[];
}

/**
 * Extended Unspent with pending_blinded property.
 * SDK types are missing this property that exists at runtime.
 */
export interface UnspentCustom {
  utxo: {
    outpoint: { txid: string; vout: number };
    btc_amount: number;
    colorable: boolean;
  };
  rgb_allocations: Array<{ asset_id: string; amount: number; settled: boolean }>;
  pending_blinded?: boolean;
}

/**
 * Correct send result shape.
 * SDK WalletManager.sendBtcEnd() declares return as string but runtime returns this object.
 * SDK WalletManager.sendEnd() also returns this shape.
 */
export interface SendResultCustom {
  txid: string;
  batch_transfer_idx: number;
}

/**
 * Asset with correct balance type.
 * Mirrors SDK AssetNIA but with correct balance type.
 *
 * Required fields (always present based on integration tests):
 * - asset_id, name, ticker, precision, balance
 *
 * Optional fields:
 * - assetIface, details, issued_supply, timestamp, added_at, media
 */
export interface AssetNIACustom {
  asset_id: string;
  name: string;
  ticker: string;
  precision: number;
  balance: AssetBalanceCustom;
  assetIface?: string;
  details?: string;
  issued_supply?: number;
  timestamp?: number;
  added_at?: number;
  media?: { filePath?: string; mime?: string };
}

/**
 * List assets response with null instead of undefined.
 * SDK declares arrays as `Array<AssetNIA> | undefined` but runtime returns `null`.
 */
export interface ListAssetsResponseCustom {
  nia: AssetNIACustom[] | null;
  uda: AssetNIACustom[] | null;
  cfa: AssetNIACustom[] | null;
}

/**
 * Invoice request with optional asset_id.
 * SDK declares asset_id as required but runtime allows it to be optional
 * for wildcard invoices that can receive any asset.
 */
export interface InvoiceRequestCustom {
  amount: number;
  asset_id?: string;
}
