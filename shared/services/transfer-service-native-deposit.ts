import { getAssetInfo } from '../models/asset-info';
import { IStorage, STORAGE_KEY_NATIVE_DEPOSIT_TRANSFERS } from '../types/IStorage';
import { AssetId } from '../types/asset';
import { CommonSwap } from '../types/common-swap';
import { Networks } from '../types/networks';
import { isTerminalStatus, ITransferService, TimelineStep, TransferExecution, TransferPair, TransferPairInfo, TransferQuote } from '../types/transfer';

const SEND_ASSET: AssetId = 'native:bitcoin';
const RECEIVE_ASSETS: AssetId[] = ['native:arkade', 'native:spark'];
const QUOTE_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days
const PRUNE_AGE_SECONDS = 7 * 24 * 60 * 60;

export type NativeDepositSwapsFetcher = (network: Networks, accountNumber: number) => Promise<CommonSwap[]>;

export class NativeDepositTransferService implements ITransferService {
  readonly name = 'Native';
  private swapsFetcher?: NativeDepositSwapsFetcher;

  constructor(private storage: IStorage) {}

  setSwapsFetcher(fn: NativeDepositSwapsFetcher): void {
    this.swapsFetcher = fn;
  }

  getSupportedPairs(): TransferPair[] {
    return RECEIVE_ASSETS.map((r) => ({ sendAssetId: SEND_ASSET, receiveAssetId: r }));
  }

  async getPairInfo(_send: AssetId, _receive: AssetId): Promise<TransferPairInfo> {
    return { min: '0.0001', max: '1', rate: '1:1 (fees at claim)' };
  }

  async getQuote(sendAsset: AssetId, receiveAsset: AssetId, sendAmount: string): Promise<TransferQuote> {
    return {
      id: crypto.randomUUID(),
      sendAsset,
      receiveAsset,
      sendAmount,
      receiveAmount: sendAmount,
      rate: '1 BTC → 1 BTC (fees at claim)',
      fee: '0',
      feeTicker: 'BTC',
      estimatedTime: 3600,
      expiresAt: Math.floor(Date.now() / 1000) + QUOTE_EXPIRY_SECONDS,
    };
  }

  async executeTransfer(quote: TransferQuote, settleAddress: string): Promise<TransferExecution> {
    return {
      id: crypto.randomUUID(),
      status: 'waiting',
      sendAmount: quote.sendAmount,
      receiveAmount: quote.receiveAmount,
      sendAsset: quote.sendAsset,
      receiveAsset: quote.receiveAsset,
      createdAt: Math.floor(Date.now() / 1000),
      depositAddress: settleAddress,
      settleAddress,
      accountNumber: 0,
      serviceName: this.name,
    };
  }

  async commitTransfer(execution: TransferExecution): Promise<void> {
    const stored: TransferExecution = { ...execution };
    if (stored.relatedTxids?.length) {
      stored.status = 'confirming';
    }
    const existing = await this.loadTransfers();
    existing.push(stored);
    await this.saveTransfers(existing);
  }

  async refreshTransferStatus(executionId: string, accountNumber: number): Promise<TransferExecution> {
    const transfers = await this.getOngoingTransfers(accountNumber);
    const transfer = transfers.find((t) => t.id === executionId);
    if (!transfer) throw new Error(`Transfer ${executionId} not found`);
    return transfer;
  }

  async getOngoingTransfers(accountNumber: number): Promise<TransferExecution[]> {
    const transfers = await this.loadTransfers();

    // Prune old terminal transfers from the full list
    const now = Math.floor(Date.now() / 1000);
    const active = transfers.filter((t) => !(isTerminalStatus(t.status) && now - t.createdAt > PRUNE_AGE_SECONDS));
    if (active.length !== transfers.length) {
      await this.saveTransfers(active);
    }

    if (!this.swapsFetcher) return active.filter((t) => t.accountNumber === accountNumber);

    let changed = false;
    for (const transfer of active) {
      if (transfer.status === 'completed' || transfer.status === 'refunded') continue;
      if (!transfer.relatedTxids?.length) continue;

      const network = getAssetInfo(transfer.receiveAsset).network as Networks;
      try {
        const swaps = await this.swapsFetcher(network, accountNumber);
        const match = swaps.find((s: CommonSwap) =>
          transfer.relatedTxids!.some((txid) => s.id === txid || s.id.includes(txid) || (s.depositTxid && (s.depositTxid === txid || s.depositTxid.includes(txid))))
        );
        if (match) {
          transfer.confirmations = match.confirmations;
          transfer.targetConfirmations = match.targetConfirmations;
          if (match.status === 'confirmed' && match.refunded) {
            transfer.status = 'refunded';
            transfer.updatedAt = Math.floor(Date.now() / 1000);
          } else if (match.status === 'confirmed') {
            transfer.status = 'completed';
            transfer.updatedAt = Math.floor(Date.now() / 1000);
          } else if (match.status === 'claimable') {
            transfer.status = 'claimable';
            transfer.claimSwapJson = JSON.stringify(match);
          } else {
            transfer.status = 'confirming';
          }
          changed = true;
        }
      } catch {
        // keep last known state on polling error
      }
    }

    if (changed) {
      await this.saveTransfers(active);
    }

    return active.filter((t) => t.accountNumber === accountNumber);
  }

  getTimelineSteps(execution: TransferExecution): TimelineStep[] {
    const { status, createdAt, updatedAt, confirmations, targetConfirmations } = execution;

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
    const step2: TimelineStep = {
      title: step2Done ? 'Claimed' : 'Ready to Claim',
      description: step2Done ? 'Funds claimed successfully' : 'Tap Claim to receive your funds',
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

  private async loadTransfers(): Promise<TransferExecution[]> {
    try {
      const raw = await this.storage.getItem(STORAGE_KEY_NATIVE_DEPOSIT_TRANSFERS);
      return raw ? (JSON.parse(raw) as TransferExecution[]) : [];
    } catch {
      return [];
    }
  }

  private async saveTransfers(transfers: TransferExecution[]): Promise<void> {
    await this.storage.setItem(STORAGE_KEY_NATIVE_DEPOSIT_TRANSFERS, JSON.stringify(transfers));
  }
}
