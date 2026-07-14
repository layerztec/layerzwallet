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

/** LN channel management surface. Optional on `IRgbWallet` for the same
 *  reason as `IRgbLnReceive`: mobile (rgb-sdk-rn) exposes it, the extension
 *  build (rgb-sdk-web) doesn't. Used by the debug/tools flow that opens a
 *  channel to an arbitrary peer (e.g. the RGB faucet bot) when the canonical
 *  LSP-JIT path isn't available. */
export interface RgbLnOpenChannelRequest {
  /** `pubkey@host:port` — the full LN URI of the peer. */
  peerPubkeyAndOptAddr: string;
  capacitySat: number;
  pushMsat: number;
  public: boolean;
  withAnchors: boolean;
  feeBaseMsat?: number | null;
  feeProportionalMillionths?: number | null;
  temporaryChannelId?: string | null;
  assetId?: string | null;
  assetAmount?: number | null;
  pushAssetAmount?: number | null;
  virtualOpenMode?: string | null;
}

export interface RgbLnOpenChannelResponse {
  temporaryChannelId: string;
}

export interface RgbLnChannel {
  channelId?: string;
  peerPubkey?: string;
  peer_pubkey?: string;
  isUsable?: boolean;
  is_usable?: boolean;
  isReady?: boolean;
  is_ready?: boolean;
  isOutbound?: boolean;
  is_outbound?: boolean;
  isChannelReady?: boolean;
  is_channel_ready?: boolean;
  isAnnounced?: boolean;
  is_announced?: boolean;
  fundingTxid?: string | null;
  funding_txid?: string | null;
  channelValueSats?: number;
  channel_value_sats?: number;
  localBalanceMsat?: number;
  local_balance_msat?: number;
  outboundBalanceMsat?: number;
  outbound_balance_msat?: number;
  inboundBalanceMsat?: number;
  inbound_balance_msat?: number;
  assetId?: string | null;
  asset_id?: string | null;
  assetLocalAmount?: number | null;
  asset_local_amount?: number | null;
  assetRemoteAmount?: number | null;
  asset_remote_amount?: number | null;
}

/** LN payment history. `listPaymentsRaw` returns every send/receive tracked
 *  by the RLN node (outgoing invoices we paid + incoming HTLCs we accepted).
 *  Optional on IRgbWallet for the same reason as the other LN surfaces —
 *  ext build's rgb-sdk-web doesn't have it. */
export type RgbLnPaymentStatus = 'Pending' | 'Claimable' | 'Claiming' | 'Succeeded' | 'Cancelled' | 'Failed' | string;
export type RgbLnPaymentType = 'Outbound' | 'Inbound' | string;
export interface RgbLnPayment {
  paymentHash: string;
  paymentType?: RgbLnPaymentType;
  status?: RgbLnPaymentStatus;
  createdAt: number;
  updatedAt: number;
  payeePubkey: string;
  amtMsat?: number;
  assetAmount?: number;
  assetId?: string;
  preimage?: string;
}
export interface IRgbLnHistory {
  listPaymentsRaw(): Promise<RgbLnPayment[]>;
}

export interface IRgbLnChannelOps {
  openChannel(request: RgbLnOpenChannelRequest): Promise<RgbLnOpenChannelResponse>;
  listChannels(): Promise<RgbLnChannel[]>;
  closeChannel(channelId: string, peerPubkey: string, force: boolean): Promise<void>;
}

export interface IRgbLnReceive {
  lightningReceiveAsset(params: { amountSats: number; amountRgb: number; assetId: string; expirySeconds?: number }): Promise<RgbLnReceiveResult>;
  /** Pay a recipient's RGB invoice via the LSP. The LSP fronts the BOLT11,
   *  we pay it, LSP forwards the asset on settle. */
  lightningSendAsset(params: { rgbInvoice: string }): Promise<RgbLnSendResult>;
  /** Pay a BOLT11 invoice directly from this wallet's LN node. For asset
   *  invoices `assetId` + `assetAmount` must match the invoice's tags;
   *  for plain sat invoices omit them. */
  payLightningInvoice(params: { lnInvoice: string; assetId?: string; assetAmount?: number; maxFee?: number }): Promise<RgbLnSendResult>;
  /** Poll until the receive settles or times out. The UI uses this to flip
   *  from "Waiting for payment" to "Received". Throws on Failed / Expired.
   *  Pass an `AbortSignal` so unmount can stop the HTTP polling instead of
   *  letting it run out the timeout window. */
  awaitLightningReceiveSettlement(params: { lnInvoice: string; timeoutMs?: number; signal?: AbortSignal }): Promise<RgbLnSettlementOutcome>;
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
  Partial<IRgbLnReceive> &
  Partial<IRgbLnChannelOps> &
  Partial<IRgbLnHistory>;

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
