import BigNumber from 'bignumber.js';

import type { SparkSDKWallet } from '../class/wallets/spark-wallet';
import { getAssetInfo } from '../models/asset-info';
import { IStorage, STORAGE_KEY_FLASHNET_TRANSFERS } from '../types/IStorage';
import { AssetId } from '../types/asset';
import { isTerminalStatus, ITransferService, TimelineStep, TransferExecution, TransferPair, TransferQuote } from '../types/transfer';

const PRUNE_AGE_SECONDS = 7 * 24 * 60 * 60;

/** Well-known BTC public key on Spark */
const BTC_PUBKEY = '020202020202020202020202020202020202020202020202020202020202020202';

/** USDB token public key (raw hex, used by Flashnet pools) */
const USDB_TOKEN_PUBKEY = '3206c93b24a4d18ea19d0a9a213204af2c7e74a6d16c7535cc5d33eca4ad1eca';

const FLASHNET_PAIRS: TransferPair[] = [
  { sendAssetId: 'native:spark', receiveAssetId: 'token:spark:usdb' },
  { sendAssetId: 'token:spark:usdb', receiveAssetId: 'native:spark' },
];

interface FlashnetPersistedTransfer {
  execution: TransferExecution;
}

export class FlashnetTransferService implements ITransferService {
  readonly name = 'Flashnet';
  private storage: IStorage;
  private getSparkWallet: () => SparkSDKWallet | undefined;
  private client: any | undefined;
  private clientWallet: SparkSDKWallet | undefined;
  private poolId: string | undefined;

  constructor(storage: IStorage, getSparkWallet: () => SparkSDKWallet | undefined) {
    this.storage = storage;
    this.getSparkWallet = getSparkWallet;
  }

  getSupportedPairs(): TransferPair[] {
    return FLASHNET_PAIRS;
  }

  async getQuote(sendAsset: AssetId, receiveAsset: AssetId, sendAmount: string): Promise<TransferQuote> {
    const sendInfo = getAssetInfo(sendAsset);
    const receiveInfo = getAssetInfo(receiveAsset);
    const { assetIn, assetOut } = this.resolveDirection(sendAsset);

    const client = await this.ensureClient();
    const poolId = await this.findPool(client);

    const amountInSmallest = new BigNumber(sendAmount).times(new BigNumber(10).pow(sendInfo.decimals)).integerValue(BigNumber.ROUND_FLOOR).toFixed(0);

    const simulation = await client.simulateSwap({
      poolId,
      assetInAddress: assetIn,
      assetOutAddress: assetOut,
      amountIn: amountInSmallest,
    });

    const receiveAmount = new BigNumber(simulation.amountOut).div(new BigNumber(10).pow(receiveInfo.decimals)).toFixed(receiveInfo.decimals);
    const rateValue = new BigNumber(receiveAmount).div(sendAmount).toFixed(8);
    const priceImpact = parseFloat(simulation.priceImpactPct || '0');
    const feeEstimate = new BigNumber(sendAmount)
      .times(priceImpact / 100)
      .abs()
      .toFixed(sendInfo.decimals);

    return {
      id: `flashnet-${Date.now()}`,
      sendAsset,
      receiveAsset,
      sendAmount,
      receiveAmount,
      rate: `1 ${sendInfo.ticker} = ${rateValue} ${receiveInfo.ticker}`,
      fee: feeEstimate,
      feeTicker: sendInfo.ticker,
      estimatedTime: 5,
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    };
  }

  async executeTransfer(quote: TransferQuote, _settleAddress: string, _fromAddress?: string): Promise<TransferExecution> {
    const sendInfo = getAssetInfo(quote.sendAsset);
    const receiveInfo = getAssetInfo(quote.receiveAsset);
    const { assetIn, assetOut } = this.resolveDirection(quote.sendAsset);

    const client = await this.ensureClient();
    const poolId = await this.findPool(client);

    const amountInSmallest = new BigNumber(quote.sendAmount).times(new BigNumber(10).pow(sendInfo.decimals)).integerValue(BigNumber.ROUND_FLOOR).toFixed(0);
    const minAmountOut = new BigNumber(quote.receiveAmount).times(new BigNumber(10).pow(receiveInfo.decimals)).times(0.97).integerValue(BigNumber.ROUND_FLOOR).toFixed(0);

    const swap = await client.executeSwap({
      poolId,
      assetInAddress: assetIn,
      assetOutAddress: assetOut,
      amountIn: amountInSmallest,
      minAmountOut,
      maxSlippageBps: 300,
    });

    const actualReceiveAmount = swap.amountOut ? new BigNumber(swap.amountOut).div(new BigNumber(10).pow(receiveInfo.decimals)).toFixed(receiveInfo.decimals) : quote.receiveAmount;

    const now = Math.floor(Date.now() / 1000);

    return {
      id: `flashnet-${now}-${Math.random().toString(36).slice(2, 8)}`,
      status: 'completed',
      sendAmount: quote.sendAmount,
      receiveAmount: actualReceiveAmount,
      sendAsset: quote.sendAsset,
      receiveAsset: quote.receiveAsset,
      createdAt: now,
      updatedAt: now,
      // No depositAddress — UI will skip the send step
    };
  }

  async commitTransfer(execution: TransferExecution): Promise<void> {
    const transfers = await this.loadTransfers();
    transfers.push({ execution });
    await this.saveTransfers(transfers);
  }

  async getOngoingTransfers(_accountNumber: number): Promise<TransferExecution[]> {
    const transfers = await this.loadTransfers();
    const now = Math.floor(Date.now() / 1000);
    const active: FlashnetPersistedTransfer[] = [];

    for (const t of transfers) {
      if (isTerminalStatus(t.execution.status) && now - t.execution.createdAt > PRUNE_AGE_SECONDS) {
        continue;
      }
      active.push(t);
    }

    if (active.length !== transfers.length) {
      await this.saveTransfers(active);
    }

    return active.map((t) => t.execution);
  }

  getTimelineSteps(execution: TransferExecution): TimelineStep[] {
    return [
      {
        title: 'Swap',
        description: execution.status === 'completed' ? 'Completed' : execution.status === 'failed' ? 'Failed' : 'Processing',
        status: execution.status === 'completed' ? 'completed' : execution.status === 'failed' ? 'error' : 'active',
        timestamp: execution.createdAt,
      },
    ];
  }

  private resolveDirection(sendAsset: AssetId): { assetIn: string; assetOut: string } {
    if (sendAsset === 'native:spark') {
      return { assetIn: BTC_PUBKEY, assetOut: USDB_TOKEN_PUBKEY };
    }
    return { assetIn: USDB_TOKEN_PUBKEY, assetOut: BTC_PUBKEY };
  }

  private async ensureClient(): Promise<any> {
    const wallet = this.getSparkWallet();
    if (!wallet) {
      throw new Error('Spark wallet not initialized. Please open your Spark wallet first.');
    }

    // Reset client when wallet changes (account switch)
    if (this.client && this.clientWallet === wallet) {
      return this.client;
    }

    const { FlashnetClient } = await import('@flashnet/sdk');
    this.client = new FlashnetClient(wallet);
    this.clientWallet = wallet;
    this.poolId = undefined; // pool discovery may differ per wallet context
    await this.client.initialize();
    return this.client;
  }

  private async findPool(client: any): Promise<string> {
    if (this.poolId) return this.poolId;

    const pools = await client.listPools({ limit: 50, sort: 'tvlDesc' });
    const pool = (pools.pools || pools).find((p: any) => {
      const a = (p.assetAAddress || p.assetATokenPublicKey || '').toLowerCase();
      const b = (p.assetBAddress || p.assetBTokenPublicKey || '').toLowerCase();
      const btc = BTC_PUBKEY.toLowerCase();
      const usdb = USDB_TOKEN_PUBKEY.toLowerCase();
      return (a === btc && b === usdb) || (a === usdb && b === btc);
    });

    if (!pool) {
      throw new Error('BTC/USDB pool not found on Flashnet');
    }

    this.poolId = pool.lpPublicKey || pool.publicKey || pool.id;
    return this.poolId!;
  }

  private async loadTransfers(): Promise<FlashnetPersistedTransfer[]> {
    const raw = await this.storage.getItem(STORAGE_KEY_FLASHNET_TRANSFERS);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as FlashnetPersistedTransfer[];
    } catch {
      return [];
    }
  }

  private async saveTransfers(transfers: FlashnetPersistedTransfer[]): Promise<void> {
    await this.storage.setItem(STORAGE_KEY_FLASHNET_TRANSFERS, JSON.stringify(transfers));
  }
}
