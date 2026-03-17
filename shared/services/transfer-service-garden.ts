import BigNumber from 'bignumber.js';

import { getAssetInfo, toAssetId } from '../models/asset-info';
import { IStorage, STORAGE_KEY_GARDEN_TRANSFERS } from '../types/IStorage';
import { AssetId } from '../types/asset';
import {
  EXECUTION_DEPOSIT,
  isTerminalStatus,
  ITransferService,
  normalizeRelatedTxids,
  TimelineStep,
  TransferExecution,
  TransferPair,
  TransferPairInfo,
  TransferQuote,
  TransferStatus,
} from '../types/transfer';
import { GardenApi, GardenApiError, GardenOrder } from './garden-api';
import { isGardenSupported, toGardenAsset } from './garden-mappings';
import { getExchangeTimelineSteps } from './transfer-service-sideshift';

const PRUNE_AGE_SECONDS = 7 * 24 * 60 * 60;

/**
 * Garden API returns `amount` in the chain's smallest unit:
 * - Bitcoin: 8 decimals (satoshis) — 10000 = 0.00010000 BTC
 * - Botanix: 18 decimals (wei)      — 99790000000000 = 0.00009979 BTC
 * The `display` field already has the correct human-readable value.
 */
const CHAIN_DECIMALS: Record<string, number> = {
  'bitcoin:btc': 8,
  'botanix:btc': 18,
};

// BTC → Botanix only for now (UTXO source = simple deposit).
// Botanix → BTC requires EVM tx signing — deferred.
const GARDEN_PAIRS: TransferPair[] = [{ sendAssetId: 'native:bitcoin', receiveAssetId: 'native:botanix' }];

interface GardenPersistedTransfer {
  execution: TransferExecution;
  gardenOrderId: string;
  sourceAsset: string;
  destinationAsset: string;
}

interface UncommittedOrder {
  execution: TransferExecution;
  gardenOrderId: string;
  sourceAsset: string;
  destinationAsset: string;
}

export class GardenTransferService implements ITransferService {
  readonly name = 'Garden';
  private api: GardenApi;
  private storage: IStorage;
  private uncommitted: Map<string, UncommittedOrder> = new Map();

  constructor(storage: IStorage, appId: string) {
    this.api = new GardenApi(appId);
    this.storage = storage;
  }

  getSupportedPairs(): TransferPair[] {
    return GARDEN_PAIRS;
  }

  async getPairInfo(sendAsset: AssetId, receiveAsset: AssetId): Promise<TransferPairInfo> {
    const from = toGardenAsset(sendAsset);
    const to = toGardenAsset(receiveAsset);
    // Use a reference amount (100k sats = 0.001 BTC) to get fee/rate info
    const resp = await this.api.getQuote(from, to, String(100_000));
    const quote = resp.result[0];
    if (!quote) throw new Error('No quote available from Garden');

    const srcDisplay = new BigNumber(quote.source.display);
    const dstDisplay = new BigNumber(quote.destination.display);
    const rate = srcDisplay.gt(0) ? dstDisplay.div(srcDisplay).toFixed(8) : '1';

    return {
      min: '0.0001',
      max: '1',
      rate,
    };
  }

  async getQuote(sendAsset: AssetId, receiveAsset: AssetId, sendAmount: string): Promise<TransferQuote> {
    const sendInfo = getAssetInfo(sendAsset);
    const receiveInfo = getAssetInfo(receiveAsset);

    if (!isGardenSupported(sendAsset)) {
      throw new Error(`Asset ${sendInfo.ticker} on ${sendInfo.networkDisplayName} is not supported by Garden`);
    }
    if (!isGardenSupported(receiveAsset)) {
      throw new Error(`Asset ${receiveInfo.ticker} on ${receiveInfo.networkDisplayName} is not supported by Garden`);
    }

    const from = toGardenAsset(sendAsset);
    const to = toGardenAsset(receiveAsset);
    const fromAmountSmallest = toSmallestUnit(sendAmount, from);

    const resp = await this.api.getQuote(from, to, fromAmountSmallest);
    const quote = resp.result[0];
    if (!quote) throw new Error('No quote available from Garden');

    // Use `display` fields — they are already correct human-readable values
    const sendDisplay = quote.source.display;
    const receiveDisplay = quote.destination.display;
    const rateValue = new BigNumber(receiveDisplay).div(sendDisplay).toFixed(8);
    const feeAmount = new BigNumber(sendDisplay).times(quote.fee).div(10_000).toFixed(sendInfo.decimals);

    return {
      id: `garden-${Date.now()}`,
      providerQuoteId: quote.solver_id,
      sendAsset,
      receiveAsset,
      sendAmount: sendDisplay,
      receiveAmount: receiveDisplay,
      rate: `1 ${sendInfo.ticker} = ${rateValue} ${receiveInfo.ticker}`,
      fee: feeAmount,
      feeTicker: sendInfo.ticker,
      estimatedTime: quote.estimated_time,
      expiresAt: Math.floor(Date.now() / 1000) + 300, // Garden quotes are short-lived
      serviceName: this.name,
    };
  }

  async executeTransfer(quote: TransferQuote, settleAddress: string, fromAddress?: string): Promise<TransferExecution> {
    if (Date.now() / 1000 > quote.expiresAt) {
      throw new Error('Quote has expired. Please get a new quote.');
    }
    if (!fromAddress) {
      throw new Error('Garden requires a source address (fromAddress)');
    }

    const from = toGardenAsset(quote.sendAsset);
    const to = toGardenAsset(quote.receiveAsset);
    const sendSmallest = toSmallestUnit(quote.sendAmount, from);
    const receiveSmallest = toSmallestUnit(quote.receiveAmount, to);

    const resp = await this.api.createOrder({ asset: from, owner: fromAddress, amount: sendSmallest }, { asset: to, owner: settleAddress, amount: receiveSmallest });

    const orderId = resp.result.order_id;
    const depositAddress = resp.result.to;
    const now = Math.floor(Date.now() / 1000);

    const execution: TransferExecution = {
      type: EXECUTION_DEPOSIT,
      id: orderId,
      providerId: orderId,
      status: 'waiting',
      sendAmount: quote.sendAmount,
      receiveAmount: quote.receiveAmount,
      sendAsset: quote.sendAsset,
      receiveAsset: quote.receiveAsset,
      depositAddress,
      settleAddress,
      createdAt: now,
      updatedAt: now,
      accountNumber: 0,
      serviceName: this.name,
    };

    this.uncommitted.set(execution.id, {
      execution,
      gardenOrderId: orderId,
      sourceAsset: from,
      destinationAsset: to,
    });

    return execution;
  }

  async commitTransfer(execution: TransferExecution): Promise<void> {
    const uncommitted = this.uncommitted.get(execution.id);
    if (!uncommitted) return;

    const transfers = await this.loadTransfers();
    const persistedExecution: TransferExecution = {
      ...uncommitted.execution,
      ...execution,
      relatedTxids: normalizeRelatedTxids(execution.relatedTxids ?? uncommitted.execution.relatedTxids),
    };
    transfers.push({
      execution: persistedExecution,
      gardenOrderId: uncommitted.gardenOrderId,
      sourceAsset: uncommitted.sourceAsset,
      destinationAsset: uncommitted.destinationAsset,
    });
    await this.saveTransfers(transfers);
    this.uncommitted.delete(execution.id);
  }

  async getOngoingTransfers(accountNumber: number): Promise<TransferExecution[]> {
    const transfers = await this.loadTransfers();
    const now = Math.floor(Date.now() / 1000);
    const active: GardenPersistedTransfer[] = [];

    for (const t of transfers) {
      const isTerminal = isTerminalStatus(t.execution.status);

      if (isTerminal && now - t.execution.createdAt > PRUNE_AGE_SECONDS) {
        continue;
      }

      if (!isTerminal) {
        try {
          const orderResp = await this.api.getOrder(t.gardenOrderId);
          const order = orderResp.result;
          t.execution.status = deriveGardenStatus(order);
          t.execution.updatedAt = now;
        } catch (e) {
          if (e instanceof GardenApiError) {
            console.warn(`Failed to poll Garden order ${t.gardenOrderId}: ${e.message}`);
          }
        }
      }

      active.push(t);
    }

    await this.saveTransfers(active);
    return active.filter((t) => t.execution.accountNumber === accountNumber).map((t) => t.execution);
  }

  async refreshTransferStatus(executionId: string, _accountNumber: number): Promise<TransferExecution> {
    const transfers = await this.loadTransfers();
    const transfer = transfers.find((t) => t.execution.id === executionId);
    if (!transfer) throw new Error(`Transfer ${executionId} not found`);

    const orderResp = await this.api.getOrder(transfer.gardenOrderId);
    transfer.execution.status = deriveGardenStatus(orderResp.result);
    transfer.execution.updatedAt = Math.floor(Date.now() / 1000);

    await this.saveTransfers(transfers);
    return transfer.execution;
  }

  getTimelineSteps(execution: TransferExecution): TimelineStep[] {
    return getExchangeTimelineSteps(execution);
  }

  getTrackingUrl(execution: TransferExecution): string | undefined {
    if (execution.providerId) {
      return `https://explorer.garden.finance/order/${execution.providerId}`;
    }
    return undefined;
  }

  private async loadTransfers(): Promise<GardenPersistedTransfer[]> {
    const raw = await this.storage.getItem(STORAGE_KEY_GARDEN_TRANSFERS);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as GardenPersistedTransfer[];
      const result: GardenPersistedTransfer[] = [];
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

  private async saveTransfers(transfers: GardenPersistedTransfer[]): Promise<void> {
    await this.storage.setItem(STORAGE_KEY_GARDEN_TRANSFERS, JSON.stringify(transfers));
  }
}

/**
 * Derive transfer status from Garden order state.
 * Primary signals: presence of redeem/refund tx hashes.
 */
export function deriveGardenStatus(order: GardenOrder): TransferStatus {
  const src = order.source_swap;
  const dst = order.destination_swap;

  // Completed: destination redeem tx exists
  if (dst.redeem_tx_hash) return 'completed';

  // Refunded: source refund tx exists
  if (src.refund_tx_hash) return 'refunded';

  // Confirming: counterparty has initiated on destination chain
  if (dst.initiate_tx_hash) return 'confirming';

  // Pending: user has initiated on source chain
  if (src.initiate_tx_hash) return 'pending';

  // Waiting: no activity yet
  return 'waiting';
}

/** Convert a human-readable amount (e.g. "0.0001") to the chain's smallest unit string. */
function toSmallestUnit(amount: string, gardenAsset: string): string {
  const decimals = CHAIN_DECIMALS[gardenAsset];
  if (decimals === undefined) throw new Error(`Unknown decimals for Garden asset: ${gardenAsset}`);
  return new BigNumber(amount).times(new BigNumber(10).pow(decimals)).integerValue(BigNumber.ROUND_FLOOR).toFixed(0);
}
