import BigNumber from 'bignumber.js';

import { AnalyticsEvents, type AnalyticsEventPropertiesMap } from '../types/analytics';
import type { AssetId } from '../types/asset';
import type { TransferExecution } from '../types/transfer';

/** Assets whose native unit is 1:1 with BTC, so their amount can be expressed directly in sats. */
const BTC_PEGGED_ASSETS: ReadonlySet<AssetId> = new Set<AssetId>(['native:arkade', 'native:bitcoin', 'native:citrea', 'native:lightning', 'native:liquid', 'native:spark']);

/**
 * Builds the `swap_completed` analytics properties from a completed transfer.
 *
 * Used by both mobile and desktop so the event schema (esp. the derived `sat` amount)
 * stays identical. If either side of the pair is BTC-pegged we report that side's sat
 * amount, with SEND taking priority over RECEIVE. Token-to-token swaps leave `sat = 0`
 * until we decide how to resolve a sat equivalent.
 */
export function buildSwapCompletedProperties(execution: TransferExecution): AnalyticsEventPropertiesMap[AnalyticsEvents.SwapCompleted] {
  let sat = 0;

  if (BTC_PEGGED_ASSETS.has(execution.receiveAsset)) {
    sat = new BigNumber(execution.receiveAmount).multipliedBy(1e8).toNumber();
  }
  if (BTC_PEGGED_ASSETS.has(execution.sendAsset)) {
    sat = new BigNumber(execution.sendAmount).multipliedBy(1e8).toNumber();
  }

  return {
    provider: execution.serviceName,
    sendAsset: execution.sendAsset,
    receiveAsset: execution.receiveAsset,
    id: execution.id,
    sat,
  };
}
