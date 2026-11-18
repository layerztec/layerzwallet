export type RgbNetwork = 'mainnet' | 'testnet';

/**
 * Wallet surface that `shared/` consumes. Platform adapters return either the
 * real UTEXOWallet instance (mobile, behind a compat Proxy) or a forwarding
 * shim (extension popup → offscreen document), both of which satisfy this
 * shape.
 *
 * Deliberately NOT derived from SDK types: rgb-sdk-core 1.0.0-beta.5 removed
 * `UTEXOWalletCore` and the two platforms now ship different core versions
 * (mobile beta.5, extension beta.3), so Pick-ing from either package's types
 * breaks the other build. Signatures below mirror the calls shared code
 * actually makes; loosely-typed members are pass-throughs whose shapes shared
 * code treats structurally.
 */
export interface IRgbWalletBase {
  dispose(): Promise<void>;
  getAddress(): Promise<string>;
  getBtcBalance(): Promise<any>;
  listAssets(): Promise<any>;
  getAssetBalance(assetId: string): Promise<any>;
  listUnspents(): Promise<any[]>;
  listTransactions(): Promise<any[]>;
  listTransfers(assetId?: string): Promise<any[]>;
  blindReceive(params: any): Promise<any>;
  witnessReceive(params: any): Promise<any>;
  decodeRGBInvoice(params: { invoice: string }): Promise<any>;
  /** On-chain RGB send against a full `rgb:`/`utxob:` invoice. Mobile maps
   *  this to the SDK's `onchainSend` (beta.25 rename); web still calls `send`. */
  send(params: { invoice: string; assetId?: string; amount?: number; feeRate?: number }): Promise<{ txid: string }>;
  sendBtc(params: any): Promise<string>;
  createUtxos(params: { upTo?: boolean; num?: number; size?: number; feeRate?: number }): Promise<number>;
  /** Bare sat/vB number or `{ <blocks>: rate }` map depending on platform/indexer. */
  estimateFeeRate(blocks: number): Promise<number | Record<number, number>>;
  issueAssetNia(params: any): Promise<any>;
  refreshWallet(): Promise<void>;
  syncWallet(): Promise<void>;
  failTransfers(params: any): Promise<boolean>;
  vssBackup(): Promise<number>;
  vssBackupInfo(): Promise<{ backupExists: boolean; [key: string]: any }>;
  configureVssBackup(config?: any): Promise<void>;
  disableVssAutoBackup(): Promise<void>;
  getDefaultVssConfig(): Promise<any>;
}

export type IRgbWallet = IRgbWalletBase;

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
