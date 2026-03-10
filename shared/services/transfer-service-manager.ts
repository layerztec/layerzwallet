import { getAssetInfo } from '../models/asset-info';
import { AssetId } from '../types/asset';
import { ITransferService, TimelineStep, TransferExecution, TransferNoRouteError, TransferPair, TransferPairInfo, TransferQuote } from '../types/transfer';
import { getExchangeTimelineSteps } from './transfer-service-sideshift';

function assetLabel(assetId: AssetId): string {
  const { ticker, networkDisplayName } = getAssetInfo(assetId);
  return `${ticker} (${networkDisplayName})`;
}

function humanizeError(error: any): string {
  if (error?.statusCode === 403 || error?.message?.includes('Access denied')) return 'access denied';
  if (error?.name === 'AbortError' || error?.message?.includes('aborted')) return 'timed out';
  return error?.message || 'unavailable';
}

/**
 * Aggregates multiple ITransferService implementations.
 * - Unions pairs across all services
 * - Queries all candidates in parallel for best rate
 * - Routes executeTransfer to the service that created the quote
 * - Aggregates ongoing transfers across all services
 */
export class TransferServiceManager {
  readonly name = 'TransferServiceManager';
  private services: ITransferService[];

  constructor(services: ITransferService[]) {
    this.services = services;
  }

  getSupportedPairs(): TransferPair[] {
    const pairSet = new Set<string>();
    const pairs: TransferPair[] = [];
    for (const service of this.services) {
      for (const pair of service.getSupportedPairs()) {
        const key = `${pair.sendAssetId}->${pair.receiveAssetId}`;
        if (!pairSet.has(key)) {
          pairSet.add(key);
          pairs.push(pair);
        }
      }
    }
    return pairs;
  }

  async getPairInfo(sendAsset: AssetId, receiveAsset: AssetId): Promise<TransferPairInfo> {
    const candidates = this.getServicesForPair(sendAsset, receiveAsset);
    if (candidates.length === 0) {
      throw new TransferNoRouteError(`No route for ${assetLabel(sendAsset)} → ${assetLabel(receiveAsset)}`);
    }

    for (const service of candidates) {
      if (service.getPairInfo) {
        try {
          return await service.getPairInfo(sendAsset, receiveAsset);
        } catch {
          continue;
        }
      }
    }
    throw new TransferNoRouteError(`No route for ${assetLabel(sendAsset)} → ${assetLabel(receiveAsset)}`);
  }

  async getQuote(sendAsset: AssetId, receiveAsset: AssetId, sendAmount: string): Promise<TransferQuote> {
    const candidates = this.getServicesForPair(sendAsset, receiveAsset);
    if (candidates.length === 0) {
      throw new TransferNoRouteError(`No route for ${assetLabel(sendAsset)} → ${assetLabel(receiveAsset)}`);
    }

    const results = await Promise.allSettled(
      candidates.map(async (service) => {
        const quote = await service.getQuote(sendAsset, receiveAsset, sendAmount);
        return { service, quote };
      })
    );

    const successfulQuotes: { service: ITransferService; quote: TransferQuote }[] = [];
    const serviceErrors: { service: string; message: string }[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        successfulQuotes.push(result.value);
      } else {
        serviceErrors.push({ service: candidates[i].name, message: humanizeError(result.reason) });
      }
    }

    if (successfulQuotes.length === 0) {
      const detail = serviceErrors.length === 1 ? serviceErrors[0].message : `No route available for ${getAssetInfo(sendAsset).ticker} → ${getAssetInfo(receiveAsset).ticker}`;
      throw new TransferNoRouteError(detail, serviceErrors);
    }

    // Pick best quote: highest receiveAmount = best rate for user
    successfulQuotes.sort((a, b) => parseFloat(b.quote.receiveAmount) - parseFloat(a.quote.receiveAmount));

    const best = successfulQuotes[0];
    best.quote.serviceName = best.service.name;
    if (serviceErrors.length > 0) {
      best.quote.serviceErrors = serviceErrors;
    }
    return best.quote;
  }

  async executeTransfer(quote: TransferQuote, settleAddress: string, fromAddress?: string): Promise<TransferExecution> {
    const service = this.resolveServiceForQuote(quote);
    const execution = await service.executeTransfer(quote, settleAddress, fromAddress);
    execution.serviceName = service.name;
    return execution;
  }

  async commitTransfer(execution: TransferExecution): Promise<void> {
    const service = execution.serviceName ? this.resolveServiceByName(execution.serviceName) : undefined;
    if (service?.commitTransfer) {
      await service.commitTransfer(execution);
    }
  }

  async getOngoingTransfers(): Promise<TransferExecution[]> {
    const results = await Promise.allSettled(
      this.services.map(async (service) => {
        const transfers = await service.getOngoingTransfers();
        return transfers.map((t) => ({ ...t, serviceName: t.serviceName || service.name }));
      })
    );

    const allTransfers: TransferExecution[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allTransfers.push(...result.value);
      }
    }

    allTransfers.sort((a, b) => b.createdAt - a.createdAt);
    return allTransfers;
  }

  async refreshTransferStatus(executionId: string): Promise<TransferExecution> {
    for (const service of this.services) {
      if (service.refreshTransferStatus) {
        try {
          return await service.refreshTransferStatus(executionId);
        } catch {
          continue;
        }
      }
    }
    throw new Error(`Transfer ${executionId} not found in any provider`);
  }

  getTimelineSteps(execution: TransferExecution): TimelineStep[] {
    if (execution.serviceName) {
      const service = this.resolveServiceByName(execution.serviceName);
      if (service) return service.getTimelineSteps(execution);
    }
    return getExchangeTimelineSteps(execution);
  }

  getTrackingUrl(execution: TransferExecution): string | undefined {
    if (execution.serviceName) {
      const service = this.resolveServiceByName(execution.serviceName);
      if (service?.getTrackingUrl) return service.getTrackingUrl(execution);
    }
    return undefined;
  }

  private static readonly LEGACY_NAME_MAP: Record<string, string> = {
    NativeDeposit: 'Native',
  };

  private resolveServiceByName(name: string): ITransferService | undefined {
    return this.services.find((s) => s.name === name) || this.services.find((s) => s.name === TransferServiceManager.LEGACY_NAME_MAP[name]);
  }

  private getServicesForPair(sendAssetId: AssetId, receiveAssetId: AssetId): ITransferService[] {
    return this.services.filter((s) => s.getSupportedPairs().some((p) => p.sendAssetId === sendAssetId && p.receiveAssetId === receiveAssetId));
  }

  private resolveServiceForQuote(quote: TransferQuote): ITransferService {
    if (quote.serviceName) {
      const service = this.services.find((s) => s.name === quote.serviceName);
      if (service) return service;
    }
    throw new Error(`Cannot determine which provider owns quote ${quote.id}. Missing serviceName.`);
  }
}
