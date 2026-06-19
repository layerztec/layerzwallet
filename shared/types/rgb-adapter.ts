import type { UTEXOWalletCore, VssBackupConfig } from '@utexo/rgb-sdk-core';

export type RgbNetwork = 'mainnet' | 'testnet';

/**
 * RGB-over-Lightning receive result. The LSP issues both invoices in lockstep:
 *   - `lnInvoice` is paid by anyone with sats (LSP fronts the asset).
 *   - `rgbInvoice` is paid by anyone with the on-chain RGB asset.
 * Either path settles the same logical receive.
 */
export interface RgbLnReceiveResult {
  lnInvoice: string;
  rgbInvoice: string;
  mappingId: string;
}

/** Outcome shape for `lightningSendAsset` — narrowed from the SDK's full
 *  response so shared code doesn't depend on rgb-sdk-rn / rgb-sdk-web types. */
export interface RgbLnSendResult {
  /** On-chain RGB transfer txid the LSP submits once the LN payment settles.
   *  This is the only persistent identifier the SDK returns; use it as the
   *  payment receipt and to look the transfer up in `listTransfers`. */
  txid: string;
  /** Best-effort status echo from the LSP. May still settle async. */
  status?: string;
}

/**
 * Asset-aware Lightning methods. Optional on `IRgbWallet`: mobile wires it via
 * `UtexoLsp` (rgb-sdk-rn beta.14+); extension's rgb-sdk-web has no LSP path
 * yet, so this is undefined there. Use the presence of the method as the
 * feature-detect handle in shared code.
 */
export type RgbLnSettlementOutcome = 'settled' | 'timed_out';

export interface IRgbLnReceive {
  lightningReceiveAsset(params: { amountSats: number; amountRgb: number; assetId: string; expirySeconds?: number }): Promise<RgbLnReceiveResult>;
  /** Pay a recipient's RGB invoice via the LSP. The LSP fronts the BOLT11,
   *  we pay it, LSP forwards the asset on settle. */
  lightningSendAsset(params: { rgbInvoice: string }): Promise<RgbLnSendResult>;
  /** Poll until the receive settles or times out. The UI uses this to flip
   *  from "Waiting for payment" to "Received". Throws on Failed / Expired. */
  awaitLightningReceiveSettlement(params: { lnInvoice: string; timeoutMs?: number }): Promise<RgbLnSettlementOutcome>;
}

/**
 * Subset of UTEXOWalletCore that `shared/` consumes. Platform adapters return
 * either the real UTEXOWallet instance (mobile) or a forwarding shim (extension
 * popup → offscreen document), both of which satisfy this shape.
 */
export type IRgbWallet = Pick<
  UTEXOWalletCore,
  | 'dispose'
  | 'getAddress'
  | 'getXpub'
  | 'getBtcBalance'
  | 'listAssets'
  | 'getAssetBalance'
  | 'listUnspents'
  | 'listTransactions'
  | 'listTransfers'
  | 'blindReceive'
  | 'witnessReceive'
  | 'decodeRGBInvoice'
  | 'send'
  | 'sendBegin'
  | 'sendEnd'
  | 'sendBtc'
  | 'sendBtcBegin'
  | 'sendBtcEnd'
  | 'createUtxos'
  | 'createUtxosBegin'
  | 'createUtxosEnd'
  | 'estimateFeeRate'
  | 'issueAssetNia'
  | 'signPsbt'
  | 'refreshWallet'
  | 'syncWallet'
  | 'failTransfers'
  | 'vssBackup'
  | 'vssBackupInfo'
  | 'configureVssBackup'
  | 'disableVssAutoBackup'
  | 'getDefaultVssConfig'
> &
  Partial<IRgbLnReceive>;

export interface IRgbAdapterCreateParams {
  mnemonic: string;
  network: RgbNetwork;
  /** Optional override; defaults to the SDK's DEFAULT_VSS_SERVER_URL. */
  vssServerUrl?: string;
}

/**
 * Platform adapter: the shared RgbWallet talks to the SDK through this factory.
 * Mobile uses `@utexo/rgb-sdk-rn`, extension uses `@utexo/rgb-sdk-web` (hosted
 * in an offscreen document). Adapters are installed on globalThis at startup.
 */
export interface IRgbAdapter {
  /**
   * Create or reopen a wallet. On mobile the wallet lives on the filesystem; on
   * the extension it lives in IndexedDB inside the offscreen document.
   */
  createWallet(params: IRgbAdapterCreateParams): Promise<IRgbWallet>;

  /**
   * Restore wallet state from VSS cloud backup, then return an initialised wallet.
   * Idempotent: if VSS has no backup for this mnemonic yet, the returned wallet
   * is a fresh instance (same state as createWallet would produce).
   */
  restoreFromVss(params: IRgbAdapterCreateParams): Promise<IRgbWallet>;

  /** Feature flags so shared code can gate UI. Lightning is not supported in v1. */
  readonly capabilities: {
    lightning: boolean;
  };
}

export type { VssBackupConfig };
