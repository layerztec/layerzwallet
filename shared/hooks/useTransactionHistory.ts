import useSWR from 'swr';

import { getAssetInfo } from '../models/asset-info';
import { CommonTransaction } from '../types/common-transaction';
import { IBackgroundCaller } from '../types/IBackgroundCaller';
import { Networks } from '../types/networks';
import { ITransferService, TransferExecution, TransferStatus } from '../types/transfer';
import { txFetcher } from './useTransactions';

interface TxHistoryFetcherArg {
  accountNumber: number;
  network: Networks;
  backgroundCaller: IBackgroundCaller;
  transferService: ITransferService;
}

const TRANSFER_TXID_PREFIX = 'transfer';

export function normalizeTxid(txid: string): string {
  const normalized = txid.trim().toLowerCase();
  if (normalized.startsWith('0x')) {
    const stripped = normalized.slice(2);
    if (/^[0-9a-f]+$/.test(stripped)) {
      return stripped;
    }
  }
  return normalized;
}

function toUniqueNormalizedTxids(relatedTxids?: string[]): string[] {
  if (!Array.isArray(relatedTxids)) return [];
  return Array.from(new Set(relatedTxids.map(normalizeTxid).filter(Boolean)));
}

function mapTransferStatusToTransactionStatus(status: TransferStatus): CommonTransaction['status'] {
  switch (status) {
    case 'completed':
    case 'refunded':
      return 'confirmed';
    case 'failed':
    case 'expired':
      return 'failed';
    case 'waiting':
    case 'pending':
    case 'confirming':
    default:
      return 'pending';
  }
}

function toBaseUnitNumber(amount: string, decimals: number): number | undefined {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return undefined;
  return Math.round(numeric * 10 ** decimals);
}

interface TransferMatchRule {
  execution: TransferExecution;
  expectedDirection: 'send' | 'receive';
  expectedAmount?: number;
  expectedCounterparty?: string;
  transferTimestamp: number;
}

function normalizeCounterparty(value?: string): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized || undefined;
}

function inferTransferMatchRules(execution: TransferExecution, network: Networks): TransferMatchRule[] {
  const sendAssetInfo = getAssetInfo(execution.sendAsset);
  const receiveAssetInfo = getAssetInfo(execution.receiveAsset);
  const transferTimestamp = execution.updatedAt ?? execution.createdAt;
  const rules: TransferMatchRule[] = [];

  if (sendAssetInfo.network === network) {
    rules.push({
      execution,
      expectedDirection: 'send',
      expectedAmount: toBaseUnitNumber(execution.sendAmount, sendAssetInfo.decimals),
      expectedCounterparty: normalizeCounterparty(execution.depositAddress),
      transferTimestamp,
    });
  }

  if (receiveAssetInfo.network === network) {
    rules.push({
      execution,
      expectedDirection: 'receive',
      expectedAmount: toBaseUnitNumber(execution.receiveAmount, receiveAssetInfo.decimals),
      expectedCounterparty: normalizeCounterparty(execution.settleAddress),
      transferTimestamp,
    });
  }

  return rules;
}

function inferCoveredTxidsFromLegacyTransfers(network: Networks, transfers: TransferExecution[], transactions: CommonTransaction[], alreadyCoveredTxids: Set<string>): Set<string> {
  const inferred = new Set<string>();
  const usedTxids = new Set<string>();
  const txCandidates = transactions.filter((tx) => tx.network === network && !alreadyCoveredTxids.has(normalizeTxid(tx.txid)));
  const rules = transfers
    .filter((execution) => toUniqueNormalizedTxids(execution.relatedTxids).length === 0)
    .flatMap((execution) => inferTransferMatchRules(execution, network))
    .sort((a, b) => b.transferTimestamp - a.transferTimestamp);

  for (const rule of rules) {
    const matchingByCounterparty = txCandidates.filter((tx) => {
      if (usedTxids.has(normalizeTxid(tx.txid))) return false;
      if (tx.direction !== rule.expectedDirection) return false;
      if (!rule.expectedCounterparty) return false;
      return normalizeCounterparty(tx.counterparty) === rule.expectedCounterparty;
    });

    const source =
      matchingByCounterparty.length > 0
        ? matchingByCounterparty
        : txCandidates.filter((tx) => {
            if (usedTxids.has(normalizeTxid(tx.txid))) return false;
            if (tx.direction !== rule.expectedDirection) return false;
            if (rule.expectedAmount === undefined || tx.amount === undefined) return false;
            if (tx.amount !== rule.expectedAmount) return false;
            const delta = Math.abs(tx.timestamp - rule.transferTimestamp);
            return delta <= 2 * 60 * 60; // 2 hours
          });

    if (source.length === 0) continue;

    source.sort((a, b) => Math.abs(a.timestamp - rule.transferTimestamp) - Math.abs(b.timestamp - rule.transferTimestamp));
    const selected = source[0];
    const selectedTxid = normalizeTxid(selected.txid);
    usedTxids.add(selectedTxid);
    inferred.add(selectedTxid);
  }

  return inferred;
}

function isTransferVisibleOnNetwork(execution: TransferExecution, network: Networks): boolean {
  const sendNetwork = getAssetInfo(execution.sendAsset).network;
  const receiveNetwork = getAssetInfo(execution.receiveAsset).network;
  return sendNetwork === network || receiveNetwork === network;
}

export function transferToCommonTransaction(execution: TransferExecution, network: Networks): CommonTransaction {
  const sendAssetInfo = getAssetInfo(execution.sendAsset);
  const receiveAssetInfo = getAssetInfo(execution.receiveAsset);
  const isSendSide = sendAssetInfo.network === network;
  const isReceiveSide = receiveAssetInfo.network === network;

  let direction: CommonTransaction['direction'] = 'other';
  if (isSendSide && isReceiveSide) direction = 'swap';
  else if (isSendSide) direction = 'send';
  else if (isReceiveSide) direction = 'receive';

  const amount = isSendSide ? toBaseUnitNumber(execution.sendAmount, sendAssetInfo.decimals) : toBaseUnitNumber(execution.receiveAmount, receiveAssetInfo.decimals);
  const counterparty = isSendSide ? execution.depositAddress : execution.settleAddress;

  return {
    txid: `${TRANSFER_TXID_PREFIX}:${execution.serviceName ?? 'unknown'}:${execution.id}:${network}`,
    network,
    timestamp: execution.updatedAt ?? execution.createdAt,
    direction,
    amount,
    status: mapTransferStatusToTransactionStatus(execution.status),
    counterparty,
    transferExecution: execution,
  };
}

export function aggregateTransactionHistory(network: Networks, transactions: CommonTransaction[], transfers: TransferExecution[]): CommonTransaction[] {
  const keptTransfers = transfers.filter((execution) => isTransferVisibleOnNetwork(execution, network));
  const coveredTxids = new Set<string>();

  for (const execution of keptTransfers) {
    const relatedTxids = toUniqueNormalizedTxids(execution.relatedTxids);
    for (const txid of relatedTxids) {
      coveredTxids.add(txid);
    }
  }

  const inferredCoveredTxids = inferCoveredTxidsFromLegacyTransfers(network, keptTransfers, transactions, coveredTxids);
  for (const txid of inferredCoveredTxids) {
    coveredTxids.add(txid);
  }

  const mappedTransfers = keptTransfers.map((execution) => transferToCommonTransaction(execution, network));
  const filteredTransactions = transactions.filter((tx) => !coveredTxids.has(normalizeTxid(tx.txid)));

  return [...mappedTransfers, ...filteredTransactions].sort((a, b) => {
    if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
    return a.txid.localeCompare(b.txid);
  });
}

export async function txHistoryFetcher(arg: TxHistoryFetcherArg): Promise<CommonTransaction[]> {
  const { accountNumber, network, backgroundCaller, transferService } = arg;
  const [transactions, transfers] = await Promise.all([txFetcher({ cacheKey: 'txFetcher', accountNumber, network, backgroundCaller }), transferService.getOngoingTransfers()]);
  return aggregateTransactionHistory(network, transactions, transfers);
}

export function useTransactionHistory(network: Networks, accountNumber: number, backgroundCaller: IBackgroundCaller, transferService: ITransferService) {
  const key = ['txHistoryFetcher', network, accountNumber] as const;
  const { data, error, isLoading, mutate } = useSWR(key, () => txHistoryFetcher({ network, accountNumber, backgroundCaller, transferService }), {
    refreshInterval: 20_000,
    refreshWhenHidden: false,
    keepPreviousData: true,
  });

  return {
    transactions: data,
    isLoading,
    error,
    mutate,
  };
}
