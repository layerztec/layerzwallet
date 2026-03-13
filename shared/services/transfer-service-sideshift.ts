import { getAssetInfo, toAssetId } from '../models/asset-info';
import { IStorage, STORAGE_KEY_SIDESHIFT_TRANSFERS } from '../types/IStorage';
import { AssetId } from '../types/asset';
import { ITransferService, isTerminalStatus, normalizeRelatedTxids, TimelineStep, TransferExecution, TransferPair, TransferPairInfo, TransferQuote, TransferStatus } from '../types/transfer';
import { SideshiftApi, SideshiftApiError, SideshiftShiftStatus } from './sideshift-api';
import { isSideshiftSupported, toSideshiftAsset, toSideshiftMethodId } from './sideshift-mappings';

const PRUNE_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

interface PersistedTransfer {
  execution: TransferExecution;
  sideshiftShiftId: string;
  depositCoin: string;
  settleCoin: string;
  depositNetwork: string;
  settleNetwork: string;
}

const SIDESHIFT_ASSETS: AssetId[] = ['native:bitcoin', 'native:liquid', 'token:liquid:usdt', 'native:rootstock', 'token:stacks:stx'];

/** Uncommitted shift metadata, kept in memory until commitTransfer is called */
interface UncommittedShift {
  execution: TransferExecution;
  depositCoin: string;
  settleCoin: string;
  depositNetwork: string;
  settleNetwork: string;
}

export class SideshiftTransferService implements ITransferService {
  readonly name = 'SideShift';
  private api: SideshiftApi;
  private storage: IStorage;
  private uncommitted: Map<string, UncommittedShift> = new Map();

  constructor(storage: IStorage, affiliateId?: string) {
    this.api = new SideshiftApi(affiliateId);
    this.storage = storage;
  }

  getSupportedPairs(): TransferPair[] {
    const pairs: TransferPair[] = [];
    for (const send of SIDESHIFT_ASSETS) {
      for (const receive of SIDESHIFT_ASSETS) {
        if (send !== receive) {
          pairs.push({ sendAssetId: send, receiveAssetId: receive });
        }
      }
    }
    return pairs;
  }

  async getPairInfo(sendAsset: AssetId, receiveAsset: AssetId): Promise<TransferPairInfo> {
    const from = toSideshiftAsset(sendAsset);
    const to = toSideshiftAsset(receiveAsset);
    const pair = await this.api.getPair(toSideshiftMethodId(from), toSideshiftMethodId(to));
    if (!pair.min || !pair.max || !pair.rate) {
      throw new Error('Pair is currently unavailable on SideShift');
    }
    return {
      min: pair.min,
      max: pair.max,
      rate: pair.rate,
    };
  }

  async getQuote(sendAsset: AssetId, receiveAsset: AssetId, sendAmount: string): Promise<TransferQuote> {
    const sendAssetInfo = getAssetInfo(sendAsset);
    const receiveAssetInfo = getAssetInfo(receiveAsset);

    if (!isSideshiftSupported(sendAsset)) {
      throw new Error(`Asset ${sendAssetInfo.ticker} on ${sendAssetInfo.networkDisplayName} is not supported by SideShift`);
    }
    if (!isSideshiftSupported(receiveAsset)) {
      throw new Error(`Asset ${receiveAssetInfo.ticker} on ${receiveAssetInfo.networkDisplayName} is not supported by SideShift`);
    }

    const from = toSideshiftAsset(sendAsset);
    const to = toSideshiftAsset(receiveAsset);

    const quoteResponse = await this.api.createQuote({
      depositCoin: from.coin,
      depositNetwork: from.network,
      settleCoin: to.coin,
      settleNetwork: to.network,
      depositAmount: sendAmount,
    });

    const deposit = parseFloat(quoteResponse.depositAmount);
    const settle = parseFloat(quoteResponse.settleAmount);
    const rate = parseFloat(quoteResponse.rate);
    // Fee = what a zero-fee conversion would yield minus what you actually get
    const noFeSettle = deposit * rate;
    const feeInReceive = noFeSettle > settle ? (noFeSettle - settle).toFixed(receiveAssetInfo.decimals) : '0';

    return {
      id: quoteResponse.id,
      providerQuoteId: quoteResponse.id,
      sendAsset,
      receiveAsset,
      sendAmount: quoteResponse.depositAmount,
      receiveAmount: quoteResponse.settleAmount,
      rate: `1 ${sendAssetInfo.ticker} = ${quoteResponse.rate} ${receiveAssetInfo.ticker}`,
      fee: feeInReceive,
      feeTicker: receiveAssetInfo.ticker,
      estimatedTime: 600,
      expiresAt: Math.floor(new Date(quoteResponse.expiresAt).getTime() / 1000),
    };
  }

  async executeTransfer(quote: TransferQuote, settleAddress: string): Promise<TransferExecution> {
    if (Date.now() / 1000 > quote.expiresAt) {
      throw new Error('Quote has expired. Please get a new quote.');
    }

    if (!quote.providerQuoteId) {
      throw new Error('Quote is missing provider quote ID');
    }

    const shiftResponse = await this.api.createFixedShift({
      quoteId: quote.providerQuoteId,
      settleAddress,
      affiliateId: this.api.getAffiliateId(),
    });

    const now = Math.floor(Date.now() / 1000);
    const execution: TransferExecution = {
      id: shiftResponse.id,
      providerId: shiftResponse.id,
      status: mapSideshiftStatus(shiftResponse.status),
      sendAmount: quote.sendAmount,
      receiveAmount: quote.receiveAmount,
      sendAsset: quote.sendAsset,
      receiveAsset: quote.receiveAsset,
      depositAddress: shiftResponse.depositAddress,
      settleAddress: shiftResponse.settleAddress,
      createdAt: now,
      updatedAt: now,
    };

    // Keep in memory until commitTransfer is called
    this.uncommitted.set(execution.id, {
      execution,
      depositCoin: shiftResponse.depositCoin,
      settleCoin: shiftResponse.settleCoin,
      depositNetwork: shiftResponse.depositNetwork,
      settleNetwork: shiftResponse.settleNetwork,
    });

    return execution;
  }

  async commitTransfer(execution: TransferExecution): Promise<void> {
    const uncommitted = this.uncommitted.get(execution.id);
    if (!uncommitted) return; // already committed or unknown

    const transfers = await this.loadTransfers();
    const persistedExecution: TransferExecution = {
      ...uncommitted.execution,
      ...execution,
      relatedTxids: normalizeRelatedTxids(execution.relatedTxids ?? uncommitted.execution.relatedTxids),
    };
    transfers.push({
      execution: persistedExecution,
      sideshiftShiftId: persistedExecution.providerId!,
      depositCoin: uncommitted.depositCoin,
      settleCoin: uncommitted.settleCoin,
      depositNetwork: uncommitted.depositNetwork,
      settleNetwork: uncommitted.settleNetwork,
    });
    await this.saveTransfers(transfers);
    this.uncommitted.delete(execution.id);
  }

  async getOngoingTransfers(_accountNumber: number): Promise<TransferExecution[]> {
    const transfers = await this.loadTransfers();
    const now = Math.floor(Date.now() / 1000);
    const active: PersistedTransfer[] = [];

    for (const t of transfers) {
      const isTerminal = isTerminalStatus(t.execution.status);

      // Prune old terminal transfers
      if (isTerminal && now - t.execution.createdAt > PRUNE_AGE_SECONDS) {
        continue;
      }

      // Poll for status update if not terminal
      if (!isTerminal) {
        try {
          const shiftData = await this.api.getShift(t.sideshiftShiftId);
          t.execution.status = mapSideshiftStatus(shiftData.status);
          t.execution.updatedAt = now;
          if (shiftData.settleAmount) {
            t.execution.receiveAmount = shiftData.settleAmount;
          }
        } catch (e) {
          // If polling fails, keep the last known state
          if (e instanceof SideshiftApiError) {
            console.warn(`Failed to poll shift ${t.sideshiftShiftId}: ${e.message}`);
          }
        }
      }

      active.push(t);
    }

    await this.saveTransfers(active);

    return active.map((t) => t.execution);
  }

  async refreshTransferStatus(executionId: string, _accountNumber: number): Promise<TransferExecution> {
    const transfers = await this.loadTransfers();
    const transfer = transfers.find((t) => t.execution.id === executionId);
    if (!transfer) {
      throw new Error(`Transfer ${executionId} not found`);
    }

    const shiftData = await this.api.getShift(transfer.sideshiftShiftId);
    transfer.execution.status = mapSideshiftStatus(shiftData.status);
    transfer.execution.updatedAt = Math.floor(Date.now() / 1000);
    if (shiftData.settleAmount) {
      transfer.execution.receiveAmount = shiftData.settleAmount;
    }

    await this.saveTransfers(transfers);
    return transfer.execution;
  }

  getTimelineSteps(execution: TransferExecution): TimelineStep[] {
    return getExchangeTimelineSteps(execution);
  }

  getTrackingUrl(execution: TransferExecution): string | undefined {
    if (execution.providerId) {
      return `https://sideshift.ai/orders/${execution.providerId}`;
    }
    return undefined;
  }

  private async loadTransfers(): Promise<PersistedTransfer[]> {
    const raw = await this.storage.getItem(STORAGE_KEY_SIDESHIFT_TRANSFERS);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as PersistedTransfer[];
      const result: PersistedTransfer[] = [];
      for (const transfer of parsed) {
        const sendAsset = toAssetId(transfer.execution.sendAsset);
        const receiveAsset = toAssetId(transfer.execution.receiveAsset);
        if (!sendAsset || !receiveAsset) continue;
        result.push({
          ...transfer,
          execution: { ...transfer.execution, sendAsset, receiveAsset, relatedTxids: normalizeRelatedTxids(transfer.execution.relatedTxids) },
        });
      }
      return result;
    } catch {
      return [];
    }
  }

  private async saveTransfers(transfers: PersistedTransfer[]): Promise<void> {
    await this.storage.setItem(STORAGE_KEY_SIDESHIFT_TRANSFERS, JSON.stringify(transfers));
  }
}

export function mapSideshiftStatus(ssStatus: SideshiftShiftStatus): TransferStatus {
  switch (ssStatus) {
    case 'waiting':
    case 'pending':
      return ssStatus;
    case 'processing':
    case 'review':
    case 'settling':
      return 'confirming';
    case 'settled':
      return 'completed';
    case 'refund':
    case 'refunding':
    case 'refunded':
      return 'refunded';
    case 'expired':
      return ssStatus;
    case 'multiple':
    default:
      return 'failed';
  }
}

/** Shared 3-step timeline for exchange-based services (SideShift, Fake). */
export function getExchangeTimelineSteps(execution: TransferExecution): TimelineStep[] {
  const { status, createdAt, updatedAt } = execution;

  if (status === 'expired') {
    return [
      { title: 'Transfer Created', description: 'Waiting for deposit', status: 'completed', timestamp: createdAt },
      { title: 'Expired', description: 'The transfer has expired', status: 'error', timestamp: updatedAt },
    ];
  }

  const isTerminal = status === 'completed' || status === 'failed' || status === 'refunded';
  const now = Math.floor(Date.now() / 1000);

  const step1: TimelineStep = {
    title: 'Deposit Sent',
    description: 'Funds sent to exchange',
    status: status === 'waiting' ? 'active' : 'completed',
    timestamp: createdAt,
  };

  const step2Active = status === 'pending' || status === 'confirming';
  const step2: TimelineStep = {
    title: 'Processing',
    description: 'Exchange is processing your transfer',
    status: isTerminal ? 'completed' : step2Active ? 'active' : 'upcoming',
    timestamp: step2Active ? now : undefined,
  };

  const finalTitle = status === 'failed' ? 'Failed' : status === 'refunded' ? 'Refunded' : 'Completed';
  const finalDesc = status === 'failed' ? 'The transfer could not be completed' : status === 'refunded' ? 'Funds have been returned' : 'Transfer completed successfully';

  const step3: TimelineStep = {
    title: finalTitle,
    description: finalDesc,
    status: isTerminal ? (status === 'failed' ? 'error' : 'completed') : 'upcoming',
    timestamp: isTerminal ? updatedAt : undefined,
  };

  return [step1, step2, step3];
}
