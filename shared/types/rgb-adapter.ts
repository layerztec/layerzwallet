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

/** Full BOLT11 decode via the SDK — pulls out the assetId / assetAmount TLV
 *  fields that pure-JS bolt11 libs don't know about. Optional on IRgbWallet
 *  for the same reason as the other LN surfaces. */
/** Platform note: mobile (rgb-sdk-rn beta.25) returns `expirySeconds`/`payee`,
 *  the extension's older web SDK returns `expirySec`/`payeePubkey` — both
 *  spellings are optional here so either build satisfies the shape. Consumers
 *  currently only read `assetId`/`assetAmount`. */
export interface RgbLnDecodedInvoice {
  amtMsat?: number;
  expirySec?: number;
  expirySeconds?: number;
  timestamp?: number;
  assetId?: string;
  assetAmount?: number;
  paymentHash: string;
  paymentSecret?: string;
  payeePubkey?: string;
  payee?: string;
  network?: string;
}
export interface IRgbLnDecode {
  decodeLnInvoice(invoice: string): Promise<RgbLnDecodedInvoice>;
}

/** Wait for the LSP to open/ready a JIT channel carrying `assetId`.
 *  Mobile-only debug/recovery surface; resolves when a usable channel
 *  exists, throws on timeout. */
export interface IRgbLnJitWait {
  waitForLspChannel(params: { assetId: string; timeoutMs?: number }): Promise<void>;
}

export interface IRgbLnChannelOps {
  openChannel(request: RgbLnOpenChannelRequest): Promise<RgbLnOpenChannelResponse>;
  listChannels(): Promise<RgbLnChannel[]>;
  closeChannel(channelId: string, peerPubkey: string, force: boolean): Promise<void>;
}

/** Native BOLT11 generation via the wallet's own node — no LSP intermediation.
 *  Use when the wallet already has a usable channel to a routing peer (e.g. the
 *  faucet bot in our test loop) so the invoice's route hints point at that peer
 *  instead of the LSP. Required for P2P where the payer has a different peer
 *  than the LSP: the LSP-mediated `lightningReceiveAsset` embeds LSP-only
 *  route hints, which fail with `NO_ROUTE` if the payer doesn't have a channel
 *  to the LSP. */
export interface RgbLnNativeInvoiceResult {
  lnInvoice: string;
}
export interface IRgbLnNativeReceive {
  createNativeLnInvoice(params: { amountSats: number; expirySeconds?: number; assetId?: string; assetAmount?: number }): Promise<RgbLnNativeInvoiceResult>;
}

export interface IRgbLnReceive {
  lightningReceiveAsset(params: { amountSats: number; amountRgb: number; assetId: string; expirySeconds?: number }): Promise<RgbLnReceiveResult>;
  /** Pay a recipient's RGB invoice via the LSP. The LSP fronts the BOLT11,
   *  we pay it, LSP forwards the asset on settle. */
  lightningSendAsset(params: { rgbInvoice: string; amountSats?: number }): Promise<RgbLnSendResult>;
  /** Pay a BOLT11 invoice directly from this wallet's LN node. For asset
   *  invoices `assetId` + `assetAmount` must match the invoice's tags;
   *  for plain sat invoices omit them. */
  /** `amountSats` sizes the outbound-liquidity pre-gate — pass the decoded
   *  invoice amount so the gate waits for enough msat instead of its
   *  1000-sat floor. */
  payLightningInvoice(params: { lnInvoice: string; assetId?: string; assetAmount?: number; amountSats?: number }): Promise<RgbLnSendResult>;
  /** Poll until the receive settles or times out. The UI uses this to flip
   *  from "Waiting for payment" to "Received". Throws on Failed / Expired.
   *  Pass an `AbortSignal` so unmount can stop the HTTP polling instead of
   *  letting it run out the timeout window. */
  awaitLightningReceiveSettlement(params: { lnInvoice: string; timeoutMs?: number; signal?: AbortSignal }): Promise<RgbLnSettlementOutcome>;
}

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

export type IRgbWallet = IRgbWalletBase & Partial<IRgbLnReceive> & Partial<IRgbLnNativeReceive> & Partial<IRgbLnChannelOps> & Partial<IRgbLnHistory> & Partial<IRgbLnDecode> & Partial<IRgbLnJitWait>;

export interface IRgbAdapterCreateParams {
  mnemonic: string;
  network: RgbNetwork;
  /** Optional override; defaults to the SDK's DEFAULT_VSS_SERVER_URL. */
  vssServerUrl?: string;
  /**
   * Skip the eager `wallet.createLsp()` call at init time. Default `true`
   * (preserves the LSP-JIT receive flow that everyday users rely on).
   * Set `false` for wallets that will ONLY use manually-opened channels
   * to arbitrary peers — `createLsp` bakes
   * `enableVirtualChannelsV0: true` + the LSP peer pubkey into node
   * params before `init()`, and there's evidence (UTEXO reference
   * `rgb-sdk-rn-demo` never calls `createLsp` for its P2P flow, plus
   * live signet HTLC failures against a bot-opened channel) that
   * virtual-channel mode prevents LDK from routing through
   * non-virtual channels.
   */
  useLsp?: boolean;
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
