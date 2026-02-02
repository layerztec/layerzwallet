import React, { useContext, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Rive, { RiveRef } from 'rive-react-native';

import { ThemedText } from '@/components/ThemedText';
import SectionContainer from '@/components/SectionContainer';
import Transaction from '@/components/Transaction';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { CommonTransaction } from '@shared/types/common-transaction';

interface TransactionsListProps {
  transactions: CommonTransaction[];
  error?: Error | null;
  onTransactionPress: (transaction: CommonTransaction) => void;
  onViewHistory: () => void;
}

const TransactionsList: React.FC<TransactionsListProps> = ({ transactions, error, onTransactionPress, onViewHistory }) => {
  const { network } = useContext(NetworkContext);
  const riveRef = useRef<RiveRef>(null);

  const hasTransactions = transactions.length > 0;

  return (
    <SectionContainer title="Transactions" onViewAll={hasTransactions ? onViewHistory : undefined} contentStyle={styles.contentPadding}>
      {hasTransactions ? (
        <View style={styles.transactionsList}>
          {transactions.map((transaction) => (
            <Transaction key={transaction.txid} transaction={transaction} onPress={() => onTransactionPress(transaction)} />
          ))}
        </View>
      ) : error ? (
        <View style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>Error loading transactions</ThemedText>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyTransactionsContainer}>
            <Rive
              key={`transactions-${network}`}
              ref={riveRef}
              autoplay={true}
              style={styles.emptyTransactionsAnimation}
              resourceName="transactions"
              onError={(riveError) => {
                console.log('Rive animation error:', riveError);
              }}
            />
            <ThemedText style={styles.emptyText}>No transactions yet. Start by tapping receive and do your first transaction.</ThemedText>
          </View>
        </View>
      )}
    </SectionContainer>
  );
};

const styles = StyleSheet.create({
  contentPadding: {
    paddingHorizontal: 16,
  },
  transactionsList: {
    gap: 24,
  },
  emptyContainer: {
    paddingVertical: 8,
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
  },
  emptyTransactionsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 0,
    width: '100%',
  },
  emptyTransactionsAnimation: {
    width: 368,
    height: 100,
    marginBottom: 16,
  },
});

export default TransactionsList;
