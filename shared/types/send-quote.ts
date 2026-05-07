export interface SendQuoteRequest {
  toAddress: string;
  /** Amount in smallest unit (wei for EVM, sats for Liquid/Bitcoin) */
  amount: string;
  /** Token contract address / asset ID for token transfers */
  tokenId?: string;
  /** Required for EVM (stateless wallet, needs sender address) */
  fromAddress?: string;
  /** sat/vbyte for Bitcoin (future) */
  feeRate?: number;
  /** Optional memo (Stacks, etc.) */
  memo?: string;
}

export interface SendQuote {
  /** Echo of the original request */
  request: SendQuoteRequest;
  /** Estimated fee in smallest unit of the fee currency */
  fee: string;
  /** Ticker of the fee currency (e.g. "RBTC", "L-BTC") */
  feeTicker: string;
  /** Decimals of the fee currency (e.g. 18 for wei, 8 for sats, 6 for microSTX) */
  feeDecimals: number;
  /** Wallet-specific prepared data needed for execution. Opaque to consumers.
   *  Omit when the quote carries no pre-broadcast artifact (e.g. Ark/Spark). */
  _prepared?: unknown;
}
