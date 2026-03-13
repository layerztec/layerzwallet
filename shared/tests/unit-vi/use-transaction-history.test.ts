import { describe, expect, it } from 'vitest';

import { aggregateTransactionHistory } from '../../hooks/useTransactionHistory';
import { CommonTransaction } from '../../types/common-transaction';
import { NETWORK_BITCOIN, NETWORK_LIQUID, NETWORK_ROOTSTOCK } from '../../types/networks';
import { TransferExecution } from '../../types/transfer';

function makeTx(overrides: Partial<CommonTransaction> = {}): CommonTransaction {
  return {
    txid: 'tx-default',
    network: NETWORK_BITCOIN,
    timestamp: 100,
    direction: 'send',
    ...overrides,
  };
}

function makeTransfer(overrides: Partial<TransferExecution> = {}): TransferExecution {
  const createdAt = overrides.createdAt ?? 200;
  return {
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
    relatedTxids: ['deposit-1'],
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

  it('dedupes transaction rows when any related txid matches', () => {
    const txs = [makeTx({ txid: 'deposit-1' }), makeTx({ txid: 'extra-2', timestamp: 90 }), makeTx({ txid: 'keep-3', timestamp: 80 })];
    const transfers = [makeTransfer({ relatedTxids: ['deposit-1', 'extra-2'] })];

    const result = aggregateTransactionHistory(NETWORK_BITCOIN, txs, transfers);

    expect(result.some((tx) => tx.txid === 'deposit-1')).toBe(false);
    expect(result.some((tx) => tx.txid === 'extra-2')).toBe(false);
    expect(result.some((tx) => tx.txid === 'keep-3')).toBe(true);
  });

  it('dedupes tx rows when related txid and tx row differ by 0x prefix', () => {
    const txs = [makeTx({ txid: '0xabc123' }), makeTx({ txid: 'keep-1', timestamp: 90 })];
    const transfers = [makeTransfer({ relatedTxids: ['abc123'] })];

    const result = aggregateTransactionHistory(NETWORK_BITCOIN, txs, transfers);

    expect(result.some((tx) => tx.txid === '0xabc123')).toBe(false);
    expect(result.some((tx) => tx.txid === 'keep-1')).toBe(true);
  });

  it('preserves all transfers even when related txids overlap', () => {
    const newer = makeTransfer({ id: 'shift-new', createdAt: 300, relatedTxids: ['shared-tx'] });
    const older = makeTransfer({ id: 'shift-old', createdAt: 200, relatedTxids: ['shared-tx'] });

    const result = aggregateTransactionHistory(NETWORK_BITCOIN, [makeTx({ txid: 'shared-tx' })], [older, newer]);

    const transferRows = result.filter((tx) => !!tx.transferExecution);
    expect(transferRows).toHaveLength(2);
    expect(transferRows.some((tx) => tx.transferExecution?.id === 'shift-new')).toBe(true);
    expect(transferRows.some((tx) => tx.transferExecution?.id === 'shift-old')).toBe(true);
    expect(result.some((tx) => tx.txid === 'shared-tx')).toBe(false);
  });

  it('keeps transfers visible when they have no related txids', () => {
    const transferWithoutLinks = makeTransfer({ id: 'shift-wip', relatedTxids: undefined, status: 'failed' });

    const result = aggregateTransactionHistory(NETWORK_BITCOIN, [], [transferWithoutLinks]);

    expect(result).toHaveLength(1);
    expect(result[0].transferExecution?.id).toBe('shift-wip');
  });

  it('filters matching transaction for legacy transfer without related txids', () => {
    const transferWithoutLinks = makeTransfer({ id: 'shift-legacy', relatedTxids: undefined, createdAt: 1_700_000_000, sendAmount: '0.00008' });
    const matchingTx = makeTx({ txid: 'legacy-match', direction: 'send', timestamp: 1_700_000_060, amount: 8000, counterparty: transferWithoutLinks.depositAddress });
    const otherTx = makeTx({ txid: 'keep-legacy', direction: 'send', timestamp: 1_700_000_500, amount: 7000 });

    const result = aggregateTransactionHistory(NETWORK_BITCOIN, [matchingTx, otherTx], [transferWithoutLinks]);

    expect(result.some((tx) => tx.txid === 'legacy-match')).toBe(false);
    expect(result.some((tx) => tx.txid === 'keep-legacy')).toBe(true);
    expect(result.some((tx) => tx.transferExecution?.id === 'shift-legacy')).toBe(true);
  });

  it('keeps chronological order after merge', () => {
    const txs = [makeTx({ txid: 'old-tx', timestamp: 10 }), makeTx({ txid: 'new-tx', timestamp: 100, network: NETWORK_ROOTSTOCK })];
    const transfers = [makeTransfer({ createdAt: 50, relatedTxids: ['none'] })];

    const result = aggregateTransactionHistory(NETWORK_BITCOIN, txs, transfers);
    const timestamps = result.map((tx) => tx.timestamp);

    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
  });
});
