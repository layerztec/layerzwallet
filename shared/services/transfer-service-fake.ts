import BigNumber from 'bignumber.js';

import { getAssetInfo } from '../models/asset-info';
import { AssetId } from '../types/asset';
import { ITransferService, TimelineStep, TransferExecution, TransferPair, TransferQuote } from '../types/transfer';
import { getExchangeTimelineSteps } from './transfer-service-sideshift';

const LBTC_TESTNET: AssetId = 'native:liquid_testnet';
const BTC_BOTANIX_TESTNET: AssetId = 'native:botanix_testnet';

let nextId = 1;

export class FakeTransferService implements ITransferService {
  readonly name = 'Fake';
  private ongoingTransfers: TransferExecution[] = [];

  getSupportedPairs(): TransferPair[] {
    return [
      { sendAssetId: LBTC_TESTNET, receiveAssetId: BTC_BOTANIX_TESTNET },
      { sendAssetId: BTC_BOTANIX_TESTNET, receiveAssetId: LBTC_TESTNET },
    ];
  }

  async getQuote(sendAsset: AssetId, receiveAsset: AssetId, sendAmount: string): Promise<TransferQuote> {
    await new Promise((resolve) => setTimeout(resolve, 800));
    const sendAssetInfo = getAssetInfo(sendAsset);
    const receiveAssetInfo = getAssetInfo(receiveAsset);

    const amount = new BigNumber(sendAmount);
    if (amount.isNaN() || amount.lte(0)) {
      throw new Error('Invalid amount');
    }
    if (amount.eq(1)) {
      throw new Error('TestError');
    }

    const feeRate = 0.001;
    const fee = amount.multipliedBy(feeRate);
    const receiveAmount = amount.minus(fee).multipliedBy(0.997); // simulate rate difference

    const rateStr =
      sendAssetInfo.ticker === receiveAssetInfo.ticker
        ? '1:1'
        : `1 ${sendAssetInfo.ticker} = ${new BigNumber(1).dividedBy(amount.isZero() ? 1 : receiveAmount.dividedBy(amount)).toFixed(2)} ${receiveAssetInfo.ticker}`;

    return {
      id: `quote-${nextId++}`,
      sendAsset,
      receiveAsset,
      sendAmount,
      receiveAmount: receiveAmount.toFixed(receiveAssetInfo.decimals > 8 ? 8 : receiveAssetInfo.decimals),
      rate: rateStr,
      fee: fee.toFixed(8),
      feeTicker: sendAssetInfo.ticker,
      estimatedTime: 300,
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    };
  }

  async executeTransfer(quote: TransferQuote, _settleAddress: string): Promise<TransferExecution> {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const execution: TransferExecution = {
      id: `exec-${nextId++}`,
      status: 'pending',
      sendAmount: quote.sendAmount,
      receiveAmount: quote.receiveAmount,
      sendAsset: quote.sendAsset,
      receiveAsset: quote.receiveAsset,
      createdAt: Math.floor(Date.now() / 1000),
      depositAddress: 'fake-deposit-address',
      settleAddress: _settleAddress,
    };

    this.ongoingTransfers.push(execution);

    // Simulate progress: move to step 2 after 2s, complete after 5s
    setTimeout(() => {
      execution.status = 'confirming';
    }, 2000);

    setTimeout(() => {
      execution.status = 'completed';
    }, 5000);

    return execution;
  }

  async getOngoingTransfers(): Promise<TransferExecution[]> {
    return this.ongoingTransfers;
  }

  getTimelineSteps(execution: TransferExecution): TimelineStep[] {
    return getExchangeTimelineSteps(execution);
  }
}
