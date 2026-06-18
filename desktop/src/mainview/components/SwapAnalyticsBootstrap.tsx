import { useEffect } from 'react';

import { useTransferService } from '@shared/hooks/useTransferService';
import { buildSwapCompletedProperties } from '@shared/modules/swap-analytics';
import { AnalyticsEvents } from '@shared/types/analytics';
import { LayerzStorage } from '../class/layerz-storage';
import { trackAnalyticsEvent } from '../modules/analytics';

/**
 * Wires the transfer-service singleton's completion callback to analytics.
 *
 * Desktop has no swap UI, so swaps are driven by MCP (`execute_swap`). The manager fires
 * `onTransferCompleted` from `commitTransfer`, which the MCP path always calls — so setting
 * this callback is what makes `swap_completed` fire on desktop, mirroring mobile's _layout.
 */
export function SwapAnalyticsBootstrap(): null {
  const transferService = useTransferService(LayerzStorage);

  useEffect(() => {
    transferService.onTransferCompleted = (execution) => {
      trackAnalyticsEvent(AnalyticsEvents.SwapCompleted, buildSwapCompletedProperties(execution));
    };

    return () => {
      transferService.onTransferCompleted = undefined;
    };
  }, [transferService]);

  return null;
}
