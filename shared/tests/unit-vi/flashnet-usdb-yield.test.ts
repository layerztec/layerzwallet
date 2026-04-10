import { describe, expect, it } from 'vitest';

import { FLASHNET_USDB_YIELD_SENDER_SPARK_ADDRESS } from '../../constants/flashnet';
import { isFlashnetYieldBtcReceive, normalizeSparkAddressForCompare, satsToUsd, sumFlashnetYieldBtcSats } from '../../modules/flashnet-usdb-yield';
import { CommonTransaction } from '../../types/common-transaction';
import { NETWORK_SPARK } from '../../types/networks';

const YIELD_SENDER = FLASHNET_USDB_YIELD_SENDER_SPARK_ADDRESS;
const YIELD_NORM = normalizeSparkAddressForCompare(YIELD_SENDER);

function btcReceive(sats: number, counterparty: string, timestamp: number): CommonTransaction {
  return {
    network: NETWORK_SPARK,
    txid: `tx-${timestamp}-${sats}`,
    timestamp,
    direction: 'receive',
    amount: sats,
    counterparty,
    status: 'confirmed',
  };
}

describe('flashnet-usdb-yield', () => {
  it('normalizes Spark addresses for comparison', () => {
    expect(normalizeSparkAddressForCompare('  Spark1ABC  ')).toBe('spark1abc');
  });

  it('isFlashnetYieldBtcReceive matches yield sender BTC receive only', () => {
    const ok = btcReceive(68, YIELD_SENDER, 1_700_000_000);
    expect(isFlashnetYieldBtcReceive(ok, YIELD_NORM)).toBe(true);

    const wrongSender = btcReceive(68, 'spark1other000000000000000000000000000000000000000000000000000', 1_700_000_000);
    expect(isFlashnetYieldBtcReceive(wrongSender, YIELD_NORM)).toBe(false);

    const tokenRow: CommonTransaction = {
      ...ok,
      amount: undefined,
      tokenTransfers: [{ tokenId: 'btkn1x', amount: 1, decimals: 6, symbol: 'USDB' }],
    };
    expect(isFlashnetYieldBtcReceive(tokenRow, YIELD_NORM)).toBe(false);

    const send = { ...ok, direction: 'send' as const };
    expect(isFlashnetYieldBtcReceive(send, YIELD_NORM)).toBe(false);
  });

  it('sumFlashnetYieldBtcSats sums lifetime and respects sinceTimestamp', () => {
    const t0 = 1_700_000_000;
    const txs: CommonTransaction[] = [
      btcReceive(100, YIELD_SENDER, t0),
      btcReceive(200, YIELD_SENDER, t0 + 40 * 24 * 60 * 60),
      btcReceive(999, 'spark1other000000000000000000000000000000000000000000000000000', t0),
    ];
    expect(sumFlashnetYieldBtcSats(txs).toFixed(0)).toBe('300');
    const cutoff = t0 + 35 * 24 * 60 * 60;
    expect(sumFlashnetYieldBtcSats(txs, undefined, { sinceTimestamp: cutoff }).toFixed(0)).toBe('200');
  });

  it('satsToUsd converts using BTC price', () => {
    const usd = satsToUsd(100_000_000, 50_000);
    expect(usd.toFixed(2)).toBe('50000.00');
    expect(satsToUsd(68, 72_317).toFixed(4)).toBe('0.0492');
  });
});
