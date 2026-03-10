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
  /** Estimated fee in smallest unit of native currency */
  fee: string;
  /** Ticker of the fee currency (e.g. "RBTC", "L-BTC") */
  feeTicker: string;
  /** Wallet-specific prepared data needed for execution. Opaque to consumers. */
  _prepared: unknown;
}
