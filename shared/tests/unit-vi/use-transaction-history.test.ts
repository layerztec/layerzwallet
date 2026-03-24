import { describe, expect, it } from 'vitest';

import { aggregateTransactionHistory, transferToCommonTransaction } from '../../hooks/useTransactionHistory';
import { CommonTransaction } from '../../types/common-transaction';
import { NETWORK_BITCOIN, NETWORK_LIQUID, NETWORK_ROOTSTOCK, NETWORK_SPARK } from '../../types/networks';
import { DepositAddressExecution, EXECUTION_CLAIM, EXECUTION_DEPOSIT, NativeClaimExecution } from '../../types/transfer';

function makeTx(overrides: Partial<CommonTransaction> = {}): CommonTransaction {
  return {
    txid: 'tx-default',
    network: NETWORK_BITCOIN,
    timestamp: 100,
    direction: 'send',
    ...overrides,
  };
}

function makeTransfer(overrides: Partial<DepositAddressExecution> = {}): DepositAddressExecution {
  const createdAt = overrides.createdAt ?? 200;
  return {
    type: EXECUTION_DEPOSIT,
    id: 'shift-1',
    serviceName: 'SideShift',
    status: 'pending',

    sendAmount: '0.01',
    receiveAmount: '0.0098',
    sendAsset: 'native:bitcoin',
    receiveAsset: 'native:liquid',
    createdAt,
    updatedAt: createdAt,
    accountNumber: 0,
    depositTxid: 'deposit-1',
    ...overrides,
  };
}

describe('aggregateTransactionHistory', () => {
  it('shows transfer on send network and hides covered transaction', () => {
    const txs = [makeTx({ txid: 'deposit-1', network: NETWORK_BITCOIN }), makeTx({ txid: 'other-1', network: NETWORK_BITCOIN, timestamp: 120 })];
    const transfers = [makeTransfer()];

    const result = aggregateTransactionHistory(NETWORK_BITCOIN, txs, transfers);

    expect(result.some((tx) => tx.transferExecution?.id === 'shift-1')).toBe(true);
    expect(result.some((tx) => tx.txid === 'deposit-1')).toBe(false);
    expect(result.some((tx) => tx.txid === 'other-1')).toBe(true);
  });

  it('shows transfer on receive network', () => {
    const result = aggregateTransactionHistory(NETWORK_LIQUID, [], [makeTransfer()]);
    expect(result).toHaveLength(1);
    expect(result[0].transferExecution?.id).toBe('shift-1');
    expect(result[0].direction).toBe('receive');
  });

  it('dedupes transaction row matching depositTxid', () => {
    const txs = [makeTx({ txid: 'deposit-1' }), makeTx({ txid: 'keep-3', timestamp: 80 })];
    const transfers = [makeTransfer({ depositTxid: 'deposit-1' })];

    const result = aggregateTransactionHistory(NETWORK_BITCOIN, txs, transfers);

    expect(result.some((tx) => tx.txid === 'deposit-1')).toBe(false);
    expect(result.some((tx) => tx.txid === 'keep-3')).toBe(true);
  });

  it('dedupes tx row matching depositTxid exactly', () => {
    const txs = [makeTx({ txid: '0xabc123' }), makeTx({ txid: 'keep-1', timestamp: 90 })];
    const transfers = [makeTransfer({ depositTxid: '0xabc123' })];

    const result = aggregateTransactionHistory(NETWORK_BITCOIN, txs, transfers);

    expect(result.some((tx) => tx.txid === '0xabc123')).toBe(false);
    expect(result.some((tx) => tx.txid === 'keep-1')).toBe(true);
  });

  it('preserves all transfers even when related txids overlap', () => {
    const newer = makeTransfer({ id: 'shift-new', createdAt: 300, depositTxid: 'shared-tx' });
    const older = makeTransfer({ id: 'shift-old', createdAt: 200, depositTxid: 'shared-tx' });

    const result = aggregateTransactionHistory(NETWORK_BITCOIN, [makeTx({ txid: 'shared-tx' })], [older, newer]);

    const transferRows = result.filter((tx) => !!tx.transferExecution);
    expect(transferRows).toHaveLength(2);
    expect(transferRows.some((tx) => tx.transferExecution?.id === 'shift-new')).toBe(true);
    expect(transferRows.some((tx) => tx.transferExecution?.id === 'shift-old')).toBe(true);
    expect(result.some((tx) => tx.txid === 'shared-tx')).toBe(false);
  });

  it('keeps transfers visible when they have no related txids', () => {
    const transferWithoutLinks = makeTransfer({ id: 'shift-wip', depositTxid: undefined, status: 'failed' });

    const result = aggregateTransactionHistory(NETWORK_BITCOIN, [], [transferWithoutLinks]);

    expect(result).toHaveLength(1);
    expect(result[0].transferExecution?.id).toBe('shift-wip');
  });

  it('filters matching transaction for legacy transfer without related txids', () => {
    const transferWithoutLinks = makeTransfer({ id: 'shift-legacy', depositTxid: undefined, createdAt: 1_700_000_000, sendAmount: '0.00008' });
    const matchingTx = makeTx({ txid: 'legacy-match', direction: 'send', timestamp: 1_700_000_060, amount: 8000, counterparty: transferWithoutLinks.depositAddress });
    const otherTx = makeTx({ txid: 'keep-legacy', direction: 'send', timestamp: 1_700_000_500, amount: 7000 });

    const result = aggregateTransactionHistory(NETWORK_BITCOIN, [matchingTx, otherTx], [transferWithoutLinks]);

    expect(result.some((tx) => tx.txid === 'legacy-match')).toBe(false);
    expect(result.some((tx) => tx.txid === 'keep-legacy')).toBe(true);
    expect(result.some((tx) => tx.transferExecution?.id === 'shift-legacy')).toBe(true);
  });

  it('keeps chronological order after merge', () => {
    const txs = [makeTx({ txid: 'old-tx', timestamp: 10 }), makeTx({ txid: 'new-tx', timestamp: 100, network: NETWORK_ROOTSTOCK })];
    const transfers = [makeTransfer({ createdAt: 50, depositTxid: 'none' })];

    const result = aggregateTransactionHistory(NETWORK_BITCOIN, txs, transfers);
    const timestamps = result.map((tx) => tx.timestamp);

    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
  });

  it('hides transfer not visible on queried network', () => {
    const transfer = makeTransfer({ sendAsset: 'native:bitcoin', receiveAsset: 'native:liquid' });
    const result = aggregateTransactionHistory(NETWORK_ROOTSTOCK, [], [transfer]);
    expect(result).toHaveLength(0);
  });

  it('dedupes claimTxid for NativeClaimExecution', () => {
    const transfer: NativeClaimExecution = {
      type: EXECUTION_CLAIM,
      id: 'nd-1',
      serviceName: 'Native',
      status: 'completed',
      sendAmount: '0.001',
      receiveAmount: '0.001',
      sendAsset: 'native:bitcoin',
      receiveAsset: 'native:spark',
      createdAt: 200,
      updatedAt: 300,
      accountNumber: 0,
      depositTxid: 'dep-tx',
      autoClaim: true,
      autoClaimAttempts: 1,
      claimTxid: 'claim-tx',
    };
    const txs = [makeTx({ txid: 'dep-tx' }), makeTx({ txid: 'claim-tx', timestamp: 90 }), makeTx({ txid: 'unrelated', timestamp: 80 })];

    const result = aggregateTransactionHistory(NETWORK_BITCOIN, txs, [transfer]);

    expect(result.some((tx) => tx.txid === 'dep-tx')).toBe(false);
    expect(result.some((tx) => tx.txid === 'claim-tx')).toBe(false);
    expect(result.some((tx) => tx.txid === 'unrelated')).toBe(true);
  });

  it('legacy inference falls back to amount+timestamp when no counterparty', () => {
    const transfer = makeTransfer({ id: 'no-addr', depositTxid: undefined, depositAddress: undefined, createdAt: 1_000_000, sendAmount: '0.005' });
    const matchTx = makeTx({ txid: 'amt-match', direction: 'send', timestamp: 1_000_060, amount: 500000 });
    const farTx = makeTx({ txid: 'too-far', direction: 'send', timestamp: 1_010_000, amount: 500000 });

    const result = aggregateTransactionHistory(NETWORK_BITCOIN, [matchTx, farTx], [transfer]);

    expect(result.some((tx) => tx.txid === 'amt-match')).toBe(false);
    expect(result.some((tx) => tx.txid === 'too-far')).toBe(true);
  });

  it('legacy inference does not match tx outside 2-hour window', () => {
    const transfer = makeTransfer({ id: 'old', depositTxid: undefined, createdAt: 1_000_000, sendAmount: '0.001' });
    const tooOldTx = makeTx({ txid: 'too-old', direction: 'send', timestamp: 1_000_000 - 3 * 3600, amount: 100000 });

    const result = aggregateTransactionHistory(NETWORK_BITCOIN, [tooOldTx], [transfer]);

    expect(result.some((tx) => tx.txid === 'too-old')).toBe(true);
  });

  it('dedupes Spark receive tx via receiveTransferId on NativeClaimExecution', () => {
    const transfer: NativeClaimExecution = {
      type: EXECUTION_CLAIM,
      id: 'nd-spark',
      serviceName: 'Native',
      status: 'completed',
      sendAmount: '0.001',
      receiveAmount: '0.001',
      sendAsset: 'native:bitcoin',
      receiveAsset: 'native:spark',
      createdAt: 200,
      updatedAt: 300,
      accountNumber: 0,
      depositTxid: 'btc-dep-tx',
      autoClaim: true,
      autoClaimAttempts: 1,
      receiveTransferId: 'spark-transfer-uuid',
    };
    const sparkTx = makeTx({ txid: 'spark-transfer-uuid', network: NETWORK_SPARK, direction: 'receive', timestamp: 300, amount: 95000 });
    const otherTx = makeTx({ txid: 'other-spark', network: NETWORK_SPARK, direction: 'receive', timestamp: 280, amount: 5000 });

    const result = aggregateTransactionHistory(NETWORK_SPARK, [sparkTx, otherTx], [transfer]);

    expect(result.some((tx) => tx.txid === 'spark-transfer-uuid')).toBe(false);
    expect(result.some((tx) => tx.txid === 'other-spark')).toBe(true);
    expect(result.some((tx) => tx.transferExecution?.id === 'nd-spark')).toBe(true);
  });

  it('infers covered Spark tx for cross-network transfer with corrected receiveAmount', () => {
    const transfer: NativeClaimExecution = {
      type: EXECUTION_CLAIM,
      id: 'nd-cross',
      serviceName: 'Native',
      status: 'completed',
      sendAmount: '0.001',
      receiveAmount: '0.00095000', // Updated by creditAmountSats at claim time (95000 sats)
      sendAsset: 'native:bitcoin',
      receiveAsset: 'native:spark',
      createdAt: 1_000_000,
      updatedAt: 1_000_100,
      accountNumber: 0,
      depositTxid: 'btc-txid-abc',
      autoClaim: true,
      autoClaimAttempts: 1,
    };
    // Spark receive tx matches corrected receiveAmount exactly
    const sparkTx = makeTx({ txid: 'spark-uuid-1', network: NETWORK_SPARK, direction: 'receive', timestamp: 1_000_100, amount: 95000 });
    const unrelated = makeTx({ txid: 'spark-uuid-2', network: NETWORK_SPARK, direction: 'receive', timestamp: 1_000_200, amount: 5000 });

    const result = aggregateTransactionHistory(NETWORK_SPARK, [sparkTx, unrelated], [transfer]);

    // The Spark receive tx should be covered by inference (exact amount match after receiveAmount correction)
    expect(result.some((tx) => tx.txid === 'spark-uuid-1')).toBe(false);
    expect(result.some((tx) => tx.txid === 'spark-uuid-2')).toBe(true);
    expect(result.some((tx) => tx.transferExecution?.id === 'nd-cross')).toBe(true);
  });

  it('does not match receive tx if amount differs from corrected receiveAmount', () => {
    const transfer: NativeClaimExecution = {
      type: EXECUTION_CLAIM,
      id: 'nd-no-match',
      serviceName: 'Native',
      status: 'completed',
      sendAmount: '0.001',
      receiveAmount: '0.00095000', // Corrected to 95000 sats
      sendAsset: 'native:bitcoin',
      receiveAsset: 'native:spark',
      createdAt: 1_000_000,
      updatedAt: 1_000_100,
      accountNumber: 0,
      depositTxid: 'btc-txid-xyz',
      autoClaim: true,
      autoClaimAttempts: 0,
    };
    // Amount is 80000 — doesn't match corrected 95000
    const sparkTx = makeTx({ txid: 'spark-mismatch', network: NETWORK_SPARK, direction: 'receive', timestamp: 1_000_100, amount: 80000 });

    const result = aggregateTransactionHistory(NETWORK_SPARK, [sparkTx], [transfer]);

    // Should NOT be deduped — exact amount mismatch
    expect(result.some((tx) => tx.txid === 'spark-mismatch')).toBe(true);
  });

  it('legacy inference matches each tx only once', () => {
    const t1 = makeTransfer({ id: 'shift-a', depositTxid: undefined, createdAt: 1_000_000, sendAmount: '0.001', depositAddress: 'addr-a' });
    const t2 = makeTransfer({ id: 'shift-b', depositTxid: undefined, createdAt: 1_000_010, sendAmount: '0.001', depositAddress: 'addr-b' });
    const tx1 = makeTx({ txid: 'tx-a', direction: 'send', timestamp: 1_000_005, counterparty: 'addr-a' });
    const tx2 = makeTx({ txid: 'tx-b', direction: 'send', timestamp: 1_000_015, counterparty: 'addr-b' });

    const result = aggregateTransactionHistory(NETWORK_BITCOIN, [tx1, tx2], [t1, t2]);

    expect(result.some((tx) => tx.txid === 'tx-a')).toBe(false);
    expect(result.some((tx) => tx.txid === 'tx-b')).toBe(false);
    const transferRows = result.filter((tx) => !!tx.transferExecution);
    expect(transferRows).toHaveLength(2);
  });
});

describe('transferToCommonTransaction', () => {
  it('maps send direction and amount on send network', () => {
    const transfer = makeTransfer({ sendAsset: 'native:bitcoin', receiveAsset: 'native:liquid', sendAmount: '0.01', depositAddress: 'dep-addr' });
    const tx = transferToCommonTransaction(transfer, NETWORK_BITCOIN);

    expect(tx.direction).toBe('send');
    expect(tx.amount).toBe(1_000_000);
    expect(tx.counterparty).toBe('dep-addr');
    expect(tx.txid).toContain('transfer:SideShift:');
  });

  it('maps receive direction on receive network', () => {
    const transfer = makeTransfer({ sendAsset: 'native:bitcoin', receiveAsset: 'native:liquid', receiveAmount: '0.0098', settleAddress: 'settle-addr' });
    const tx = transferToCommonTransaction(transfer, NETWORK_LIQUID);

    expect(tx.direction).toBe('receive');
    expect(tx.counterparty).toBe('settle-addr');
  });

  it('maps swap direction when send and receive are same network', () => {
    const transfer: NativeClaimExecution = {
      type: EXECUTION_CLAIM,
      id: 'nd-1',
      serviceName: 'Native',
      status: 'completed',
      sendAmount: '0.001',
      receiveAmount: '0.001',
      sendAsset: 'native:bitcoin',
      receiveAsset: 'native:spark',
      createdAt: 200,
      updatedAt: 300,
      accountNumber: 0,
      autoClaim: false,
      autoClaimAttempts: 0,
    };
    const tx = transferToCommonTransaction(transfer, NETWORK_SPARK);
    expect(tx.direction).toBe('receive');
  });

  it('maps status correctly', () => {
    expect(transferToCommonTransaction(makeTransfer({ status: 'completed' }), NETWORK_BITCOIN).status).toBe('confirmed');
    expect(transferToCommonTransaction(makeTransfer({ status: 'failed' }), NETWORK_BITCOIN).status).toBe('failed');
    expect(transferToCommonTransaction(makeTransfer({ status: 'confirming' }), NETWORK_BITCOIN).status).toBe('pending');
  });
});
