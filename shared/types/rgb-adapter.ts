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

/**
 * Asset-aware Lightning methods. Optional on `IRgbWallet`: mobile wires it via
 * `UtexoLsp` (rgb-sdk-rn beta.14+); extension's rgb-sdk-web has no LSP path
 * yet, so this is undefined there. Use the presence of the method as the
 * feature-detect handle in shared code.
 */
export interface IRgbLnReceive {
  lightningReceiveAsset(params: { amountSats: number; amountRgb: number; assetId: string; expirySeconds?: number }): Promise<RgbLnReceiveResult>;
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
