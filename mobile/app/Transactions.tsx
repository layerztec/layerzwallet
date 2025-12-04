import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useTransactions } from '@shared/hooks/useTransactions';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { useContext } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import GradientScreen from '@/components/GradientScreen';
import { ThemedText } from '@/components/ThemedText';
import Transaction from '@/components/Transaction';
import { useTransactionDetails } from '@/contexts/TransactionDetailsContext';

export default function Transactions() {
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { transactions = [], isLoading } = useTransactions(network, accountNumber, BackgroundExecutor);
  const { openTransactionDetails } = useTransactionDetails();

  return (
    <GradientScreen variant={network} scroll={true}>
      <View style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle}>Transactions</ThemedText>
        </View>

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="rgba(255, 255, 255, 0.8)" />
          </View>
        )}

        {/* Transactions List */}
        <View style={styles.transactionsList}>
          {transactions.map((transaction) => (
            <Transaction key={transaction.txid} transaction={transaction} onPress={() => openTransactionDetails(transaction)} />
          ))}
        </View>
      </View>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    marginTop: 32,
    padding: 16,
  },
  headerTitle: {
    fontSize: 32,
    paddingTop: 8,
    color: 'white',
    textAlign: 'center',
  },
  transactionsList: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
