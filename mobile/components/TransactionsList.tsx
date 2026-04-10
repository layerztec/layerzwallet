import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import SectionContainer from '@/components/SectionContainer';
import Transaction from '@/components/Transaction';
import Transfer from '@/components/transfer/Transfer';
import { CommonTransaction } from '@shared/types/common-transaction';

interface TransactionsListProps {
  transactions: CommonTransaction[];
  error?: Error | null;
  onTransactionPress: (transaction: CommonTransaction) => void;
  onViewHistory: () => void;
}

const TransactionsList: React.FC<TransactionsListProps> = ({ transactions, error, onTransactionPress, onViewHistory }) => {
  const hasTransactions = transactions.length > 0;

  return (
    <SectionContainer title="Transactions" onViewAll={hasTransactions ? onViewHistory : undefined} contentStyle={styles.contentPadding}>
      {hasTransactions ? (
        <View style={styles.transactionsList}>
          {transactions.map((transaction, index) =>
            transaction.transferExecution ? (
              <Transfer key={transaction.txid} execution={transaction.transferExecution} isLast={index === transactions.length - 1} onPress={() => onTransactionPress(transaction)} />
            ) : (
              <Transaction key={transaction.txid} transaction={transaction} onPress={() => onTransactionPress(transaction)} />
            )
          )}
        </View>
      ) : error ? (
        <View style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>Error loading transactions</ThemedText>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No transactions yet. Start by tapping receive and do your first transaction.</ThemedText>
        </View>
      )}
    </SectionContainer>
  );
};

const styles = StyleSheet.create({
  contentPadding: {
    paddingHorizontal: 16,
    paddingVertical: -5,
  },
  transactionsList: {},
  emptyContainer: {
    paddingVertical: 16,
  },
  emptyText: {
    fontSize: 14,
    color: 'white',
    textAlign: 'center',
  },
});

export default TransactionsList;
