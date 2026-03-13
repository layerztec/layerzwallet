import BigNumber from 'bignumber.js';

import { getAssetInfo, toAssetId } from '../models/asset-info';
import { IStorage, STORAGE_KEY_SYMBIOSIS_TRANSFERS } from '../types/IStorage';
import { AssetId } from '../types/asset';
import { isTerminalStatus, ITransferService, normalizeRelatedTxids, TimelineStep, TransferExecution, TransferPair, TransferQuote, TransferStatus } from '../types/transfer';
import { SymbiosisApi, SymbiosisApiError, SymbiosisSwapRequest, SymbiosisSwapResponse } from './symbiosis-api';
import { getExchangeTimelineSteps } from './transfer-service-sideshift';

const PRUNE_AGE_SECONDS = 7 * 24 * 60 * 60;

/** Bitcoin chainId in Symbiosis */
const BITCOIN_CHAIN_ID = 3652501241;

/** Symbiosis chain IDs for receive networks */
const CHAIN_IDS: Partial<Record<string, number>> = {
  rootstock: 30,
  citrea: 4114,
};

/** Placeholder addresses used when fetching quotes (before real addresses are known) */
const PLACEHOLDER_BTC = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const PLACEHOLDER_EVM = '0x0000000000000000000000000000000000000001';

// BTC → Rootstock (working), BTC → Citrea (registered for future)
const SYMBIOSIS_PAIRS: TransferPair[] = [
  { sendAssetId: 'native:bitcoin', receiveAssetId: 'native:rootstock' },
  { sendAssetId: 'native:bitcoin', receiveAssetId: 'native:citrea' },
];

interface SymbiosisPersistedTransfer {
  execution: TransferExecution;
  /** Deposit address expiration (unix seconds). After this, swap won't be processed. */
  expiresAt?: number;
}

interface UncommittedSwap {
  execution: TransferExecution;
  expiresAt: number;
}

export class SymbiosisTransferService implements ITransferService {
  readonly name = 'Symbiosis';
  private api: SymbiosisApi;
  private storage: IStorage;
  private uncommitted: Map<string, UncommittedSwap> = new Map();

  constructor(storage: IStorage) {
    this.api = new SymbiosisApi();
    this.storage = storage;
  }

  getSupportedPairs(): TransferPair[] {
    return SYMBIOSIS_PAIRS;
  }

  async getQuote(sendAsset: AssetId, receiveAsset: AssetId, sendAmount: string): Promise<TransferQuote> {
    const sendInfo = getAssetInfo(sendAsset);
    const receiveInfo = getAssetInfo(receiveAsset);
    const receiveChainId = CHAIN_IDS[receiveInfo.network];
    if (!receiveChainId) {
      throw new Error(`Unsupported receive network: ${receiveInfo.network}`);
    }

    const sats = new BigNumber(sendAmount).times(1e8).integerValue(BigNumber.ROUND_FLOOR).toFixed(0);

    const request: SymbiosisSwapRequest = {
      tokenAmountIn: { chainId: BITCOIN_CHAIN_ID, address: '', amount: sats, decimals: 8 },
      tokenOut: { chainId: receiveChainId, address: '', decimals: 18 },
      from: PLACEHOLDER_BTC,
      to: PLACEHOLDER_EVM,
      slippage: 300,
    };

    const resp = await this.api.swap(request);
    return buildQuoteFromResponse(resp, sendAsset, receiveAsset, sendAmount, sendInfo.ticker, receiveInfo.ticker, receiveInfo.decimals);
  }

  async executeTransfer(quote: TransferQuote, settleAddress: string, fromAddress?: string): Promise<TransferExecution> {
    const receiveInfo = getAssetInfo(quote.receiveAsset);
    const receiveChainId = CHAIN_IDS[receiveInfo.network];
    if (!receiveChainId) {
      throw new Error(`Unsupported receive network: ${receiveInfo.network}`);
    }

    const sats = new BigNumber(quote.sendAmount).times(1e8).integerValue(BigNumber.ROUND_FLOOR).toFixed(0);

    const request: SymbiosisSwapRequest = {
      tokenAmountIn: { chainId: BITCOIN_CHAIN_ID, address: '', amount: sats, decimals: 8 },
      tokenOut: { chainId: receiveChainId, address: '', decimals: 18 },
      from: fromAddress || PLACEHOLDER_BTC,
      to: settleAddress,
      slippage: 300,
    };

    const resp = await this.api.swap(request);

    if (resp.type !== 'btc' || !resp.tx.depositAddress) {
      throw new Error('Symbiosis returned an unsupported swap type (expected BTC deposit)');
    }

    const now = Math.floor(Date.now() / 1000);
    const receiveAmount = new BigNumber(resp.tokenAmountOut.amount).div(new BigNumber(10).pow(resp.tokenAmountOut.decimals)).toFixed(receiveInfo.decimals);
    const expiresAt = resp.tx.expiresAt ? Math.floor(new Date(resp.tx.expiresAt).getTime() / 1000) : now + 3600;

    const execution: TransferExecution = {
      id: `symbiosis-${now}-${Math.random().toString(36).slice(2, 8)}`,
      status: 'waiting',
      sendAmount: quote.sendAmount,
      receiveAmount,
      sendAsset: quote.sendAsset,
      receiveAsset: quote.receiveAsset,
      depositAddress: resp.tx.depositAddress,
      settleAddress,
      createdAt: now,
      updatedAt: now,
      accountNumber: 0,
      serviceName: this.name,
    };

    this.uncommitted.set(execution.id, { execution, expiresAt });
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
    transfers.push({ execution: persistedExecution, expiresAt: uncommitted.expiresAt });
    await this.saveTransfers(transfers);
    this.uncommitted.delete(execution.id);
  }

  async getOngoingTransfers(accountNumber: number): Promise<TransferExecution[]> {
    const transfers = await this.loadTransfers();
    const now = Math.floor(Date.now() / 1000);
    const active: SymbiosisPersistedTransfer[] = [];

    for (const t of transfers) {
      const isTerminal = isTerminalStatus(t.execution.status);

      if (isTerminal && now - t.execution.createdAt > PRUNE_AGE_SECONDS) {
        continue;
      }

      if (!isTerminal) {
        if (t.execution.relatedTxids?.[0]) {
          // BTC was sent — poll Symbiosis for swap status
          try {
            const statusResp = await this.api.getTxStatus(BITCOIN_CHAIN_ID, t.execution.relatedTxids[0]);
            t.execution.status = mapSymbiosisStatus(statusResp.status.code, statusResp.status.text);
            t.execution.updatedAt = now;
          } catch (e) {
            if (e instanceof SymbiosisApiError) {
              console.warn(`Failed to poll Symbiosis tx ${t.execution.relatedTxids[0]}: ${e.message}`);
            }
          }
        } else if (t.expiresAt && now > t.expiresAt) {
          // Deposit window expired and no BTC was sent
          t.execution.status = 'expired';
          t.execution.updatedAt = now;
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

    const now = Math.floor(Date.now() / 1000);
    const txHash = transfer.execution.relatedTxids?.[0];
    if (txHash) {
      const statusResp = await this.api.getTxStatus(BITCOIN_CHAIN_ID, txHash);
      transfer.execution.status = mapSymbiosisStatus(statusResp.status.code, statusResp.status.text);
      transfer.execution.updatedAt = now;
    } else if (transfer.expiresAt && now > transfer.expiresAt) {
      transfer.execution.status = 'expired';
      transfer.execution.updatedAt = now;
    }

    await this.saveTransfers(transfers);
    return transfer.execution;
  }

  getTimelineSteps(execution: TransferExecution): TimelineStep[] {
    return getExchangeTimelineSteps(execution);
  }

  getTrackingUrl(execution: TransferExecution): string | undefined {
    const txHash = execution.relatedTxids?.[0];
    if (txHash) {
      return `https://explorer.symbiosis.finance/transactions/${BITCOIN_CHAIN_ID}/${txHash}`;
    }
    return undefined;
  }

  private async loadTransfers(): Promise<SymbiosisPersistedTransfer[]> {
    const raw = await this.storage.getItem(STORAGE_KEY_SYMBIOSIS_TRANSFERS);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as SymbiosisPersistedTransfer[];
      const result: SymbiosisPersistedTransfer[] = [];
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

  private async saveTransfers(transfers: SymbiosisPersistedTransfer[]): Promise<void> {
    await this.storage.setItem(STORAGE_KEY_SYMBIOSIS_TRANSFERS, JSON.stringify(transfers));
  }
}

function buildQuoteFromResponse(
  resp: SymbiosisSwapResponse,
  sendAsset: AssetId,
  receiveAsset: AssetId,
  sendAmount: string,
  sendTicker: string,
  receiveTicker: string,
  receiveDecimals: number
): TransferQuote {
  const receiveAmount = new BigNumber(resp.tokenAmountOut.amount).div(new BigNumber(10).pow(resp.tokenAmountOut.decimals)).toFixed(receiveDecimals);
  const feeAmount = resp.fee ? new BigNumber(resp.fee.amount).div(new BigNumber(10).pow(resp.fee.decimals)).toFixed(8) : '0';
  const rateValue = new BigNumber(receiveAmount).div(sendAmount).toFixed(8);
  const expiresAt = resp.tx.expiresAt ? Math.floor(new Date(resp.tx.expiresAt).getTime() / 1000) : Math.floor(Date.now() / 1000) + 3600;

  return {
    id: `symbiosis-${Date.now()}`,
    sendAsset,
    receiveAsset,
    sendAmount,
    receiveAmount,
    rate: `1 ${sendTicker} = ${rateValue} ${receiveTicker}`,
    fee: feeAmount,
    feeTicker: resp.fee?.symbol || sendTicker,
    estimatedTime: resp.estimatedTime || 600,
    expiresAt,
  };
}

/**
 * Map Symbiosis tx status codes to our TransferStatus.
 * Official codes: -1=Not found, 0=Success, 1=Pending, 2=Stuck, 3=Reverted
 */
export function mapSymbiosisStatus(code: number, text?: string): TransferStatus {
  if (text) {
    const lower = text.toLowerCase();
    if (lower === 'reverted' || lower === 'stale') return 'failed';
  }

  switch (code) {
    case 0:
      return 'completed';
    case 1:
      return 'pending';
    case 2:
      return 'pending'; // stuck — keep polling
    case 3:
      return 'failed'; // reverted
    case -1:
    default:
      return 'waiting';
  }
}
