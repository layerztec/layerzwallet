import { Networks } from './networks';

/**
 * Swap status across different networks
 */
export type SwapStatus = 'pending' | 'confirmed' | 'failed' | 'cancelled' | 'claimable';

export type SwapDirection = 'send' | 'receive';

/**
 * Common swap structure that works across all chains.
 */
export interface CommonSwap {
  /** Transaction hash or other identifier */
  id: string;

  /** Network this swap occurred on */
  network: Networks;

  /** Swap direction */
  direction: SwapDirection;

  /** Swap status */
  status: SwapStatus;

  /** Swap timestamp (Unix timestamp in seconds) */
  timestamp?: number;

  /** Swap amount */
  amount: number;

  /** Explorer URL for the transaction */
  explorerUrl?: string;

  /** current confirmations */
  confirmations?: number;

  /** target confirmations. Confirmations needed to process the swap */
  targetConfirmations?: number;

  /** Original deposit txid (for claimed swaps where id is the spending tx) */
  depositTxid?: string;

  /** True if this swap was refunded rather than claimed */
  refunded?: boolean;
}
