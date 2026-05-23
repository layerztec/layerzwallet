import BigNumber from 'bignumber.js';

import { FLASHNET_USDB_YIELD_SENDER_SPARK_ADDRESS } from '../constants/flashnet';
import { CommonTransaction } from '../types/common-transaction';
import { NETWORK_SPARK } from '../types/networks';

export function normalizeSparkAddressForCompare(address: string | undefined): string {
  return (address ?? '').trim().toLowerCase();
}

/**
 * True for Spark BTC transfer receives from the Flashnet yield payout address (not token rows).
 */
export function isFlashnetYieldBtcReceive(tx: CommonTransaction, yieldSenderNormalized: string): boolean {
  if (tx.network !== NETWORK_SPARK) return false;
  if (tx.direction !== 'receive') return false;
  if (tx.tokenTransfers && tx.tokenTransfers.length > 0) return false;
  if (tx.amount === undefined || tx.amount <= 0) return false;
  return normalizeSparkAddressForCompare(tx.counterparty) === yieldSenderNormalized;
}

/**
 * Sats received from Flashnet yield (Spark `getTransfers` uses satoshi amounts on `amount`).
 */
export function sumFlashnetYieldBtcSats(transactions: CommonTransaction[], yieldSenderAddress: string = FLASHNET_USDB_YIELD_SENDER_SPARK_ADDRESS, options?: { sinceTimestamp?: number }): BigNumber {
  const normalized = normalizeSparkAddressForCompare(yieldSenderAddress);
  let sum = new BigNumber(0);
  for (const tx of transactions) {
    if (!isFlashnetYieldBtcReceive(tx, normalized)) continue;
    if (options?.sinceTimestamp !== undefined && tx.timestamp < options.sinceTimestamp) continue;
    sum = sum.plus(new BigNumber(tx.amount!).integerValue(BigNumber.ROUND_FLOOR));
  }
  return sum;
}

export function satsToUsd(sats: BigNumber | string | number, btcUsdRate: number): BigNumber {
  if (btcUsdRate <= 0) return new BigNumber(0);
  return new BigNumber(sats.toString()).dividedBy(1e8).multipliedBy(btcUsdRate);
}
