import { getAssetInfo } from '../models/asset-info';
import { AssetId } from '../types/asset';
import { ITransferService, TimelineStep, TransferExecution, TransferNoRouteError, TransferPair, TransferPairInfo, TransferQuote, TransferStatus } from '../types/transfer';
import { getExchangeTimelineSteps } from './transfer-service-sideshift';

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
  onTransferCompleted?: (execution: TransferExecution) => void;
  private lastSeenStatuses = new Map<string, TransferStatus>();
  // Tracks which service staged each execution so executeInstantSwap can route
  // by id alone. Populated in executeTransfer, popped in executeInstantSwap.
  // Orphan entries (quotes never executed) leak until process restart — bounded
  // by realistic call volume; not worth a TTL.
  private executionOwners = new Map<string, string>();

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
      throw new TransferNoRouteError(this.buildNoRouteMessage(sendAsset, receiveAsset));
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
    throw new TransferNoRouteError(this.buildNoRouteMessage(sendAsset, receiveAsset));
  }

  async getQuote(sendAsset: AssetId, receiveAsset: AssetId, sendAmount: string): Promise<TransferQuote> {
    const candidates = this.getServicesForPair(sendAsset, receiveAsset);
    if (candidates.length === 0) {
      throw new TransferNoRouteError(this.buildNoRouteMessage(sendAsset, receiveAsset));
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

  async executeTransfer(quote: TransferQuote, accountNumber: number, settleAddress: string, fromAddress?: string): Promise<TransferExecution> {
    const service = this.resolveServiceForQuote(quote);
    const execution = await service.executeTransfer(quote, accountNumber, settleAddress, fromAddress);
    execution.serviceName = service.name;
    this.executionOwners.set(execution.id, service.name);
    return execution;
  }

  async executeInstantSwap(executionId: string): Promise<TransferExecution> {
    const serviceName = this.executionOwners.get(executionId);
    // Pop before invoking so a retry yields the service's own "No pending swap" error
    // rather than a stale routing hit.
    this.executionOwners.delete(executionId);
    if (!serviceName) {
      throw new Error(`No pending swap found for execution ${executionId}. It may have expired or already been executed.`);
    }
    const service = this.resolveServiceByName(serviceName);
    if (!service || typeof (service as any).executeInstantSwap !== 'function') {
      throw new Error(`Service "${serviceName}" does not support instant swap execution`);
    }
    return (service as any).executeInstantSwap(executionId);
  }

  async commitTransfer(execution: TransferExecution): Promise<void> {
    const service = this.resolveServiceByName(execution.serviceName);
    if (service) {
      const key = `${execution.accountNumber}:${execution.serviceName}:${execution.id}`;
      const previousStatus = this.lastSeenStatuses.get(key);
      await service.commitTransfer(execution);
      this.lastSeenStatuses.set(key, execution.status);

      if (execution.status === 'completed' && previousStatus !== 'completed') {
        this.onTransferCompleted?.(execution);
      }
    }
  }

  async getOngoingTransfers(accountNumber: number): Promise<TransferExecution[]> {
    const results = await Promise.allSettled(
      this.services.map(async (service) => {
        const transfers = await service.getOngoingTransfers(accountNumber);
        return { name: service.name, transfers };
      })
    );

    const allTransfers: TransferExecution[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allTransfers.push(...result.value.transfers);
      }
    }

    allTransfers.forEach((execution) => {
      this.observeTransferStatus(execution);
    });

    allTransfers.sort((a, b) => b.createdAt - a.createdAt);
    return allTransfers;
  }

  async refreshTransferStatus(executionId: string, accountNumber: number): Promise<TransferExecution> {
    for (const service of this.services) {
      if (service.refreshTransferStatus) {
        try {
          const result = await service.refreshTransferStatus(executionId, accountNumber);
          this.observeTransferStatus(result);
          return result;
        } catch {
          continue;
        }
      }
    }
    throw new Error(`Transfer ${executionId} not found in any provider`);
  }

  getTimelineSteps(execution: TransferExecution): TimelineStep[] {
    const service = this.resolveServiceByName(execution.serviceName);
    if (service) return service.getTimelineSteps(execution);
    return getExchangeTimelineSteps(execution);
  }

  getTrackingUrl(execution: TransferExecution): string | undefined {
    const service = this.resolveServiceByName(execution.serviceName);
    if (service?.getTrackingUrl) return service.getTrackingUrl(execution);
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

  private buildNoRouteMessage(sendAsset: AssetId, receiveAsset: AssetId): string {
    const sendInfo = getAssetInfo(sendAsset);
    const receiveInfo = getAssetInfo(receiveAsset);
    const base = `${sendInfo.ticker} → ${receiveInfo.ticker} is unavailable`;
    const alt = this.getSupportedPairs().find((p) => p.receiveAssetId === receiveAsset && p.sendAssetId !== sendAsset);
    if (!alt) return base;
    const altSendInfo = getAssetInfo(alt.sendAssetId);
    return `${base}. Try ${altSendInfo.networkDisplayName}:${altSendInfo.ticker} → ${receiveInfo.ticker}`;
  }

  private resolveServiceForQuote(quote: TransferQuote): ITransferService {
    const service = this.services.find((s) => s.name === quote.serviceName);
    if (service) return service;
    throw new Error(`Cannot determine which provider owns quote ${quote.id}. Unknown serviceName: ${quote.serviceName}`);
  }

  /**
   * Emits completion only on a real status transition.
   * We poll and reload transfers repeatedly, so without remembering the last
   * seen status we would re-fire the callback for transfers that were already
   * completed, including historical ones loaded after app start.
   */
  private observeTransferStatus(execution: TransferExecution) {
    const key = `${execution.accountNumber}:${execution.serviceName}:${execution.id}`;
    const previousStatus = this.lastSeenStatuses.get(key);

    this.lastSeenStatuses.set(key, execution.status);

    if (execution.status === 'completed' && previousStatus !== undefined && previousStatus !== 'completed') {
      this.onTransferCompleted?.(execution);
    }
  }
}
