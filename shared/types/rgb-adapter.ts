import type { UTEXOWalletCore, VssBackupConfig } from '@utexo/rgb-sdk-core';

export type RgbNetwork = 'mainnet' | 'testnet';

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
>;

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
