import type { AssetId } from './asset';
export { ASSET_IDS, ASSET_IDS as TRANSFER_ASSET_IDS, type AssetId, type AssetInfo } from './asset';

export type Denomination = 'Native' | 'Fiat';

/** Represents a directional transfer pair: sendAssetId → receiveAssetId */
export interface TransferPair {
  sendAssetId: AssetId;
  receiveAssetId: AssetId;
}

export interface TransferPairInfo {
  min: string;
  max: string;
  rate: string;
}

export interface TransferQuote {
  id: string;
  sendAsset: AssetId;
  receiveAsset: AssetId;
  sendAmount: string;
  receiveAmount: string;
  /** Human-readable rate, e.g. "1 BTC = 120,000 USDT" */
  rate: string;
  /** Fee amount as string */
  fee: string;
  /** Ticker for the fee denomination */
  feeTicker: string;
  /** Estimated completion time in seconds */
  estimatedTime: number;
  /** Unix timestamp when this quote expires */
  expiresAt: number;
  /** Provider-specific quote ID (e.g., SideShift quoteId for creating fixed shifts) */
  providerQuoteId?: string;
  /** Which transfer service created this quote. Used by TransferServiceManager for routing. */
  serviceName: string;
  /** Services that failed while fetching this quote (partial failures) */
  serviceErrors?: { service: string; message: string }[];
}

export type TransferStatus = 'waiting' | 'pending' | 'confirming' | 'claimable' | 'completed' | 'failed' | 'refunded' | 'expired';

export function isActiveStatus(status: TransferStatus): boolean {
  return status === 'waiting' || status === 'pending' || status === 'confirming' || status === 'claimable';
}

export function isTerminalStatus(status: TransferStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'refunded' || status === 'expired';
}

export function getStatusLabel(status: TransferStatus, execution?: TransferExecution): string {
  switch (status) {
    case 'waiting':
      return 'Waiting for deposit';
    case 'pending':
      return 'Pending';
    case 'confirming':
      if (execution?.type === EXECUTION_CLAIM && execution.confirmations !== undefined) {
        return `${execution.confirmations}/${execution.targetConfirmations} confirmations`;
      }
      return 'Confirming';
    case 'claimable':
      return 'Ready to claim';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'refunded':
      return 'Refunded';
    case 'expired':
      return 'Expired';
    default:
      return status;
  }
}

export type TimelineStepStatus = 'completed' | 'active' | 'upcoming' | 'error';

export interface TimelineStep {
  title: string;
  description: string;
  status: TimelineStepStatus;
  /** Unix timestamp in seconds, or undefined if the step hasn't been reached */
  timestamp?: number;
}

export const EXECUTION_DEPOSIT = 'deposit-address' as const;
export const EXECUTION_CLAIM = 'native-claim' as const;
export const EXECUTION_INSTANT = 'instant' as const;
export type TransferExecutionType = typeof EXECUTION_DEPOSIT | typeof EXECUTION_CLAIM | typeof EXECUTION_INSTANT;

interface BaseTransferExecution {
  /** Discriminant: determines which execution variant this is */
  type: TransferExecutionType;
  /** Unique execution ID (provider-specific format, e.g. shift ID, order ID, or generated) */
  id: string;
  /** Current lifecycle status of this transfer */
  status: TransferStatus;
  /** Amount being sent, in human-readable units (e.g. "0.001") */
  sendAmount: string;
  /** Amount being received, in human-readable units */
  receiveAmount: string;
  /** Asset being sent */
  sendAsset: AssetId;
  /** Asset being received */
  receiveAsset: AssetId;
  /** Unix timestamp (seconds) when this transfer was created */
  createdAt: number;
  /** Unix timestamp (seconds) of last status update */
  updatedAt: number;
  /** Which wallet account created this transfer */
  accountNumber: number;
  /** Which transfer service owns this execution (e.g. "SideShift", "Garden", "Native") */
  serviceName: string;
  /** Address where the user must send the deposit (set by deposit-address and native-claim providers) */
  depositAddress?: string;
  /** Address where the user will receive the settlement */
  settleAddress?: string;
  /** Provider-specific ID for status polling and tracking URLs (e.g. SideShift shift ID, Garden order ID) */
  providerId?: string;
  /** Related on-chain txids for deduplication in transaction history and status polling */
  relatedTxids?: string[];
}

/** User deposits to an external address, provider settles to user. Used by SideShift, Garden, Symbiosis. */
export interface DepositAddressExecution extends BaseTransferExecution {
  type: typeof EXECUTION_DEPOSIT;
}

/** On-chain BTC deposit to ARK/Spark with confirmation tracking and manual claim step. Used by NativeDeposit. */
export interface NativeClaimExecution extends BaseTransferExecution {
  type: typeof EXECUTION_CLAIM;
  /** Current on-chain confirmations of the deposit tx */
  confirmations?: number;
  /** Number of confirmations needed before the deposit can be claimed */
  targetConfirmations?: number;
  /** JSON-serialized CommonSwap — set when status becomes 'claimable', passed to the claim screen */
  claimSwapJson?: string;
}

/** Instant in-wallet swap with no deposit address or confirmation step. Used by Flashnet. */
export interface InstantSwapExecution extends BaseTransferExecution {
  type: typeof EXECUTION_INSTANT;
}

export type TransferExecution = DepositAddressExecution | NativeClaimExecution | InstantSwapExecution;

/** Normalize related txids: deduplicate, lowercase, trim, remove blanks */
export function normalizeRelatedTxids(relatedTxids?: string[]): string[] | undefined {
  if (!Array.isArray(relatedTxids)) return undefined;
  const normalized = Array.from(new Set(relatedTxids.map((txid) => txid.trim().toLowerCase()).filter(Boolean)));
  return normalized.length > 0 ? normalized : undefined;
}

/** Thrown when no provider can service a given asset pair */
export class TransferNoRouteError extends Error {
  serviceErrors: { service: string; message: string }[];
  constructor(message: string, serviceErrors: { service: string; message: string }[] = []) {
    super(message);
    this.name = 'TransferNoRouteError';
    this.serviceErrors = serviceErrors;
  }
}

/**
 * Service interface for the transfer/swap flow.
 * Each provider implements this interface. TransferServiceManager aggregates multiple providers.
 */
export interface ITransferService {
  /** Human-readable provider name (e.g. "SideShift", "Fake") */
  readonly name: string;

  /** Get all supported directional pairs */
  getSupportedPairs(): TransferPair[];

  /** Get pair info (min/max/rate) for a specific send/receive pair */
  getPairInfo?(sendAsset: AssetId, receiveAsset: AssetId): Promise<TransferPairInfo>;

  /** Get a quote for a transfer */
  getQuote(sendAsset: AssetId, receiveAsset: AssetId, sendAmount: string): Promise<TransferQuote>;

  /** Execute a transfer based on a quote. settleAddress is the user's receive address on the target network. fromAddress is the user's send-side address (needed by atomic-swap providers like Garden). */
  executeTransfer(quote: TransferQuote, settleAddress: string, fromAddress?: string): Promise<TransferExecution>;

  /** Persist a transfer so it appears in ongoing transfers. Called after the user commits to sending funds. */
  commitTransfer?(execution: TransferExecution): Promise<void>;

  /** Get ongoing transfers */
  getOngoingTransfers(accountNumber: number): Promise<TransferExecution[]>;

  /** Refresh the status of a specific transfer by polling the provider */
  refreshTransferStatus?(executionId: string, accountNumber: number): Promise<TransferExecution>;

  /** Return timeline steps for rendering the transfer progress UI */
  getTimelineSteps(execution: TransferExecution): TimelineStep[];

  /** Return a URL where the user can track this transfer online */
  getTrackingUrl?(execution: TransferExecution): string | undefined;
}
