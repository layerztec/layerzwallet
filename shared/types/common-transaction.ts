import { Networks } from './networks';
import { TransferExecution } from './transfer';

/**
 * Simplified token transfer information for cross-chain compatibility
 */
export interface CommonTokenTransfer {
  /** Token symbol (e.g., 'USDT', 'DAI') */
  symbol?: string;
  /* full token name (NOT ticker) */
  name?: string;
  /* link to token icon if we are lucky */
  logoURI?: string;
  /* token decimals (like, amount of sats in bitcoin). default 0 cause when this data is absent we treat it like 0 */
  decimals: number | 0;
  /** Transfer amount in token's base units */
  amount?: number;
  /** Address the transfer is from (for receives) or to (for sends) */
  address?: string;
  /** Token contract address (for EVM chains) or identifier (for other chains) */
  tokenId: string;
}

/**
 * Transaction status across different networks
 */
export type TransactionStatus = 'pending' | 'confirmed' | 'failed' | 'cancelled';

/**
 * Common transaction structure that works across Bitcoin, Lightning, and EVM chains.
 * This provides a unified view without being over-fitted to any specific chain.
 */
export interface CommonTransaction {
  /** Transaction hash or identifier */
  txid: string;

  /** Network this transaction occurred on */
  network: Networks;

  /** Transaction timestamp (Unix timestamp in seconds) */
  timestamp: number;

  /** Transaction direction from wallet's perspective */
  direction: 'send' | 'receive' | 'swap' | 'other';

  /** Base amount in the network's main currency */
  amount?: number;

  /** Optional token transfers within this transaction */
  tokenTransfers?: CommonTokenTransfer[];

  /** Transaction status */
  status?: TransactionStatus;

  /** Transaction fee in network's base currency */
  fee?: number;

  /** Optional memo or note attached to transaction */
  memo?: string;

  /** Number of confirmations (not applicable to Lightning) */
  confirmations?: number;

  /** Counterparty address or identifier */
  counterparty?: string;

  /** Block height where transaction was included (not applicable to Lightning) */
  blockHeight?: number;

  /** Explorer URL for the transaction */
  explorerUrl?: string;

  /** Present when this row represents a transfer execution instead of a raw transaction. */
  transferExecution?: TransferExecution;
}
