import { useMemo } from 'react';
import BigNumber from 'bignumber.js';

import { getTokenInfo, USDT_TOKENS } from '../models/token-list';
import { formatFiatBalance } from '../modules/string-utils';
import { sumFlashnetYieldBtcSats, satsToUsd } from '../modules/flashnet-usdb-yield';
import { IBackgroundCaller } from '../types/IBackgroundCaller';
import { NETWORK_BITCOIN, NETWORK_SPARK } from '../types/networks';
import { useExchangeRate } from './useExchangeRate';
import { useTokenBalance } from './useTokenBalance';
import { useTokenExchangeRate } from './useTokenExchangeRate';
import { useTransactions } from './useTransactions';

const USDB_SPARK_TOKEN_ID = USDT_TOKENS[NETWORK_SPARK][0];
const { decimals: USDB_DECIMALS } = getTokenInfo(USDB_SPARK_TOKEN_ID);

export interface UseSparkUsdbEarnMetricsResult {
  /** USDB position in USD (stablecoin peg). */
  allocatedUsd: number;
  /** Flashnet BTC yield in USD, last 30 days. */
  rewards30dUsd: number;
  /** Flashnet BTC yield in USD, all time. */
  rewardsLifetimeUsd: number;
  /** allocatedUsd + rewardsLifetimeUsd */
  earnTotalUsd: number;
  isLoading: boolean;
  error: Error | undefined;
}

export function useSparkUsdbEarnMetrics(accountNumber: number, backgroundCaller: IBackgroundCaller): UseSparkUsdbEarnMetricsResult {
  const { transactions, isLoading: txsLoading, error: txsError } = useTransactions(NETWORK_SPARK, accountNumber, backgroundCaller);
  const { balance, isLoading: balanceLoading } = useTokenBalance(NETWORK_SPARK, accountNumber, USDB_SPARK_TOKEN_ID, backgroundCaller);
  const { tokenExchangeRate, isLoading: usdbRateLoading } = useTokenExchangeRate(NETWORK_SPARK, USDB_SPARK_TOKEN_ID, 'USD');
  const { exchangeRate: btcUsdRate, isLoading: btcRateLoading } = useExchangeRate(NETWORK_BITCOIN, 'USD');

  const metrics = useMemo(() => {
    const txs = transactions ?? [];
    const now = Math.floor(Date.now() / 1000);
    const since30d = now - 30 * 24 * 60 * 60;
    const lifetimeSats = sumFlashnetYieldBtcSats(txs);
    const sats30d = sumFlashnetYieldBtcSats(txs, undefined, { sinceTimestamp: since30d });
    const btcRate = btcUsdRate ?? 0;
    const usdbRate = tokenExchangeRate ?? 0;

    const allocatedUsdBn = balance !== undefined && usdbRate > 0 ? new BigNumber(formatFiatBalance(balance, USDB_DECIMALS, usdbRate)) : new BigNumber(0);

    const rewardsLifetimeUsd = satsToUsd(lifetimeSats, btcRate);
    const rewards30dUsd = satsToUsd(sats30d, btcRate);
    const earnTotalUsd = allocatedUsdBn.plus(rewardsLifetimeUsd);

    return {
      allocatedUsd: allocatedUsdBn.toNumber(),
      rewards30dUsd: rewards30dUsd.toNumber(),
      rewardsLifetimeUsd: rewardsLifetimeUsd.toNumber(),
      earnTotalUsd: earnTotalUsd.toNumber(),
    };
  }, [transactions, balance, btcUsdRate, tokenExchangeRate]);

  return {
    ...metrics,
    isLoading: txsLoading || balanceLoading || usdbRateLoading || btcRateLoading,
    error: txsError ?? undefined,
  };
}
