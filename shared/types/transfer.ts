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
  serviceName?: string;
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
      if (execution?.confirmations !== undefined) {
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

export interface TransferExecution {
  id: string;
  status: TransferStatus;
  sendAmount: string;
  receiveAmount: string;
  sendAsset: AssetId;
  receiveAsset: AssetId;
  /** Unix timestamp in seconds */
  createdAt: number;
  /** Address where the user must send the deposit */
  depositAddress?: string;
  /** Address where the user will receive the settlement */
  settleAddress?: string;
  /** Provider-specific ID for status polling (e.g. SideShift shift ID, Garden order ID) */
  providerId?: string;
  /** Timestamp of last status update */
  updatedAt?: number;
  /** Which account created this transfer. */
  accountNumber: number;
  /** Which transfer service owns this execution. Used by TransferServiceManager for routing. */
  serviceName?: string;
  /** Related on-chain txids for this transfer (deposit, settlement, or other lifecycle txs). */
  relatedTxids?: string[];
  /** Current on-chain confirmations (native deposit only) */
  confirmations?: number;
  /** Target confirmations needed to process (native deposit only) */
  targetConfirmations?: number;
  /** JSON-serialized CommonSwap — set when status becomes claimable (native deposit only) */
  claimSwapJson?: string;
}

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
