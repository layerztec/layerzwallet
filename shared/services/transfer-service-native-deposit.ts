import { getAssetInfo } from '../models/asset-info';
import { IStorage, STORAGE_KEY_NATIVE_DEPOSIT_TRANSFERS } from '../types/IStorage';
import { AssetId } from '../types/asset';
import { CommonSwap } from '../types/common-swap';
import { Networks } from '../types/networks';
import { EXECUTION_CLAIM, isTerminalStatus, ITransferService, NativeClaimExecution, TimelineStep, TransferExecution, TransferPair, TransferPairInfo, TransferQuote } from '../types/transfer';

const SEND_ASSET: AssetId = 'native:bitcoin';
const RECEIVE_ASSETS: AssetId[] = ['native:arkade', 'native:spark'];
const QUOTE_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days
const PRUNE_AGE_SECONDS = 7 * 24 * 60 * 60;
const MAX_AUTO_CLAIM_ATTEMPTS = 5;
const CLAIM_COOLDOWN_SECONDS = 300; // 5 minutes between auto-claim attempts

export type NativeDepositSwapsFetcher = (network: Networks, accountNumber: number) => Promise<CommonSwap[]>;

export interface ClaimResult {
  receiveTransferId?: string;
  creditAmountSats?: number;
}

export type NativeDepositClaimExecutor = (network: Networks, accountNumber: number, swap: CommonSwap) => Promise<ClaimResult>;

export class NativeDepositTransferService implements ITransferService {
  readonly name = 'Native';
  private swapsFetcher?: NativeDepositSwapsFetcher;
  private claimExecutor?: NativeDepositClaimExecutor;
  private claimingIds = new Set<string>();
  private processingPromise: Promise<TransferExecution[]> | null = null;
  private monitorInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private storage: IStorage) {}

  setSwapsFetcher(fn: NativeDepositSwapsFetcher): void {
    this.swapsFetcher = fn;
  }

  setClaimExecutor(fn: NativeDepositClaimExecutor): void {
    this.claimExecutor = fn;
  }

  startAutoClaimMonitor(intervalMs = 60_000): void {
    if (this.monitorInterval) return;
    this.processAutoClaims().catch(() => {});
    this.monitorInterval = setInterval(() => {
      this.processAutoClaims().catch(() => {});
    }, intervalMs);
  }

  stopAutoClaimMonitor(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  async processAutoClaims(): Promise<void> {
    if (!this.swapsFetcher || !this.claimExecutor) return;
    const transfers = await this.loadTransfers();
    const pendingAccounts = new Set(transfers.filter((t) => t.autoClaim && !isTerminalStatus(t.status) && t.depositTxid).map((t) => t.accountNumber));
    for (const acct of pendingAccounts) {
      try {
        await this.getOngoingTransfers(acct);
      } catch {
        /* ignore */
      }
    }
  }

  getSupportedPairs(): TransferPair[] {
    return RECEIVE_ASSETS.map((r) => ({ sendAssetId: SEND_ASSET, receiveAssetId: r }));
  }

  async getPairInfo(_send: AssetId, _receive: AssetId): Promise<TransferPairInfo> {
    return { min: '0.0001', max: '1', rate: '1' };
  }

  async getQuote(sendAsset: AssetId, receiveAsset: AssetId, sendAmount: string): Promise<TransferQuote> {
    const quote = {
      id: `nd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sendAsset,
      receiveAsset,
      sendAmount,
      receiveAmount: sendAmount,
      rate: '1 BTC → 1 BTC (fees at claim)',
      fee: '0',
      feeTicker: 'BTC',
      estimatedTime: 3600,
      expiresAt: Math.floor(Date.now() / 1000) + QUOTE_EXPIRY_SECONDS,
      serviceName: this.name,
    };
    return quote;
  }

  async executeTransfer(quote: TransferQuote, accountNumber: number, settleAddress: string): Promise<TransferExecution> {
    const execution = {
      type: EXECUTION_CLAIM,
      id: `nd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: 'waiting' as const,
      sendAmount: quote.sendAmount,
      receiveAmount: quote.receiveAmount,
      sendAsset: quote.sendAsset,
      receiveAsset: quote.receiveAsset,
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
      depositAddress: settleAddress,
      accountNumber,
      serviceName: this.name,
      autoClaim: false,
      autoClaimAttempts: 0,
    };
    return execution;
  }

  async commitTransfer(execution: TransferExecution): Promise<void> {
    const stored: NativeClaimExecution = { autoClaim: false, autoClaimAttempts: 0, ...execution, type: EXECUTION_CLAIM };
    if (stored.depositTxid) {
      stored.status = 'confirming';
    }
    const existing = await this.loadTransfers();
    const idx = existing.findIndex((t) => t.id === execution.id);
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...stored };
    } else {
      existing.push(stored);
    }
    await this.saveTransfers(existing);
  }

  async refreshTransferStatus(executionId: string, accountNumber: number): Promise<TransferExecution> {
    const transfers = await this.getOngoingTransfers(accountNumber);
    const transfer = transfers.find((t) => t.id === executionId);
    if (!transfer) throw new Error(`Transfer ${executionId} not found`);
    return transfer;
  }

  async getOngoingTransfers(accountNumber: number): Promise<TransferExecution[]> {
    // Serialize processing — wait for any in-flight call to finish and save before starting
    while (this.processingPromise) {
      try {
        await this.processingPromise;
      } catch {
        /* ignore */
      }
    }
    this.processingPromise = this._processTransfers(accountNumber);
    try {
      return await this.processingPromise;
    } finally {
      this.processingPromise = null;
    }
  }

  private async _processTransfers(accountNumber: number): Promise<TransferExecution[]> {
    const transfers = await this.loadTransfers();

    // Prune old terminal transfers from the full list
    const now = Math.floor(Date.now() / 1000);
    const active = transfers.filter((t) => !(isTerminalStatus(t.status) && now - t.createdAt > PRUNE_AGE_SECONDS));
    if (active.length !== transfers.length) {
      await this.saveTransfers(active);
    }

    if (!this.swapsFetcher) {
      return active.filter((t) => t.accountNumber === accountNumber);
    }

    // Collect all deposit txids already claimed by any transfer so we don't double-match
    const allClaimedTxids = new Set(active.map((t) => t.depositTxid).filter(Boolean));

    let changed = false;
    for (const transfer of active) {
      if (transfer.status === 'completed' || transfer.status === 'refunded') {
        // For completed auto-claim transfers: fix receiveAmount if it still equals sendAmount (e.g. ARK SDK auto-settled before our claim)
        if (transfer.status === 'completed' && transfer.autoClaim && transfer.receiveAmount === transfer.sendAmount && !transfer.claimTxid) {
          const network = getAssetInfo(transfer.receiveAsset).network as Networks;
          try {
            const swaps = await this.swapsFetcher(network, transfer.accountNumber);
            const match = swaps.find((s: CommonSwap) => s.id === transfer.depositTxid || (s.depositTxid && s.depositTxid === transfer.depositTxid));
            if (match?.amount !== undefined && match.status === 'confirmed') {
              const newAmount = (match.amount / 1e8).toFixed(8);
              if (newAmount !== transfer.receiveAmount) {
                transfer.receiveAmount = newAmount;
                changed = true;
              }
            }
          } catch (e) {
            // Non-critical — skip
          }
        }
        continue;
      }

      const network = getAssetInfo(transfer.receiveAsset).network as Networks;
      try {
        const swaps = await this.swapsFetcher(network, transfer.accountNumber);

        let match: CommonSwap | undefined;
        if (transfer.depositTxid) {
          // Match by known deposit txid
          match = swaps.find((s: CommonSwap) => s.id === transfer.depositTxid || (s.depositTxid && s.depositTxid === transfer.depositTxid));
        } else if (transfer.status === 'waiting') {
          // No depositTxid yet (e.g. send threw after broadcast) — try to discover a swap
          // that appeared after this transfer was created and isn't claimed by another transfer
          match = swaps.find((s: CommonSwap) => s.direction === 'receive' && !allClaimedTxids.has(s.id) && s.timestamp && s.timestamp / 1000 >= transfer.createdAt - 60);
          if (match) {
            transfer.depositTxid = match.id;
            allClaimedTxids.add(match.id);
          }
        }
        if (match) {
          transfer.confirmations = match.confirmations;
          transfer.targetConfirmations = match.targetConfirmations;
          if (match.status === 'confirmed' && match.refunded) {
            transfer.status = 'refunded';
            transfer.updatedAt = now;
          } else if (match.status === 'confirmed') {
            transfer.status = 'completed';
            transfer.updatedAt = now;
            // Update receiveAmount from the swap's actual credited amount (e.g. ARK SDK auto-settled before our auto-claim)
            if (match.amount !== undefined) {
              transfer.receiveAmount = (match.amount / 1e8).toFixed(8);
            }
          } else if (match.status === 'claimable') {
            transfer.status = 'claimable';
            transfer.claimSwapJson = JSON.stringify(match);

            const cooldownOk = !transfer.lastAutoClaimAt || now - transfer.lastAutoClaimAt >= CLAIM_COOLDOWN_SECONDS;

            // Auto-claim if enabled, under retry limit, and cooldown has elapsed
            if (transfer.autoClaim && this.claimExecutor && !this.claimingIds.has(transfer.id) && transfer.autoClaimAttempts < MAX_AUTO_CLAIM_ATTEMPTS && cooldownOk) {
              this.claimingIds.add(transfer.id);
              transfer.lastAutoClaimAt = now;
              try {
                const result = await this.claimExecutor(network, transfer.accountNumber, match);
                if (!result.receiveTransferId && result.creditAmountSats === undefined) {
                  // Empty result — executor is passively waiting (e.g. ARK SDK auto-settle). Stay claimable.
                } else {
                  transfer.status = 'completed';
                  transfer.updatedAt = now;
                  transfer.autoClaimError = undefined;
                  if (result.receiveTransferId) transfer.receiveTransferId = result.receiveTransferId;
                  if (result.creditAmountSats !== undefined) {
                    transfer.receiveAmount = (result.creditAmountSats / 1e8).toFixed(8);
                  }
                }
              } catch (e: any) {
                const msg = e?.message || 'Auto-claim failed';
                const isTransient =
                  msg.includes("doesn't have enough confirmations") ||
                  msg.includes('429') ||
                  msg.includes('Too Many Requests') ||
                  msg.includes('timed out') ||
                  msg.includes('fetch failed') ||
                  msg.includes('Failed to get transactions');
                if (isTransient) {
                  // Transient — network/rate-limit error or SDK not ready. Don't count against retry limit, reset cooldown.
                  transfer.lastAutoClaimAt = undefined;
                } else {
                  transfer.autoClaimAttempts = transfer.autoClaimAttempts + 1;
                  transfer.autoClaimError = msg;
                }
              } finally {
                this.claimingIds.delete(transfer.id);
              }
            }
          } else {
            transfer.status = 'confirming';
          }
          changed = true;
        }
      } catch {
        /* ignore */
      }
    }

    if (changed) {
      await this.saveTransfers(active);
    }

    const result = active.filter((t) => t.accountNumber === accountNumber);
    return result;
  }

  getTimelineSteps(execution: TransferExecution): TimelineStep[] {
    if (execution.type !== EXECUTION_CLAIM) return [];
    const { status, createdAt, updatedAt, confirmations, targetConfirmations, autoClaim, autoClaimError } = execution;

    const step1Done = status === 'claimable' || status === 'completed' || status === 'refunded';
    const step1Active = status === 'waiting' || status === 'confirming';
    const confirmLabel = confirmations !== undefined ? `${confirmations}/${targetConfirmations} confirmations` : 'Waiting for on-chain confirmations';

    const step1: TimelineStep = {
      title: 'Deposit Sent',
      description: confirmLabel,
      status: step1Done ? 'completed' : step1Active ? 'active' : 'upcoming',
      timestamp: createdAt,
    };

    const step2Active = status === 'claimable';
    const step2Done = status === 'completed';

    let step2Title: string;
    let step2Description: string;
    if (step2Done) {
      step2Title = 'Claimed';
      step2Description = 'Funds claimed successfully';
    } else if (autoClaim) {
      step2Title = 'Auto-claiming';
      step2Description = autoClaimError || 'Will be claimed automatically';
    } else {
      step2Title = 'Ready to Claim';
      step2Description = 'Tap Claim to receive your funds';
    }

    const step2: TimelineStep = {
      title: step2Title,
      description: step2Description,
      status: step2Done ? 'completed' : step2Active ? 'active' : 'upcoming',
      timestamp: step2Active || step2Done ? updatedAt : undefined,
    };

    const step3: TimelineStep = {
      title: 'Completed',
      description: 'Transfer completed successfully',
      status: status === 'completed' ? 'completed' : 'upcoming',
      timestamp: status === 'completed' ? updatedAt : undefined,
    };

    return [step1, step2, step3];
  }

  private async loadTransfers(): Promise<NativeClaimExecution[]> {
    try {
      const raw = await this.storage.getItem(STORAGE_KEY_NATIVE_DEPOSIT_TRANSFERS);
      return raw ? (JSON.parse(raw) as NativeClaimExecution[]) : [];
    } catch {
      return [];
    }
  }

  private async saveTransfers(transfers: NativeClaimExecution[]): Promise<void> {
    await this.storage.setItem(STORAGE_KEY_NATIVE_DEPOSIT_TRANSFERS, JSON.stringify(transfers));
  }
}
