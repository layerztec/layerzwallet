import { useRouter } from 'expo-router';
import { useContext } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import RadialGradientScreen from '@/components/RadialGradientScreen';
import { ThemedText } from '@/components/ThemedText';
import Transaction from '@/components/Transaction';
import Transfer from '@/components/transfer/Transfer';
import { LayerzStorage } from '@/src/class/layerz-storage';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useTransactionHistory } from '@shared/hooks/useTransactionHistory';
import { useTransferService } from '@shared/hooks/useTransferService';

export default function Transactions() {
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const transferService = useTransferService(LayerzStorage);
  const { transactions = [], isLoading } = useTransactionHistory(network, accountNumber, BackgroundExecutor, transferService);
  const router = useRouter();

  return (
    <RadialGradientScreen network={network} scroll={true}>
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
          {transactions.map((transaction, index) => {
            const handlePress = () =>
              transaction.transferExecution
                ? router.push({
                    pathname: '/TransferDetails',
                    params: { execution: JSON.stringify(transaction.transferExecution) },
                  })
                : router.push({
                    pathname: '/TransactionDetails',
                    params: {
                      transaction: JSON.stringify(transaction),
                      layerNetwork: network, // Pass the current layer being viewed
                    },
                  });

            return transaction.transferExecution ? (
              <Transfer key={transaction.txid} execution={transaction.transferExecution} isLast={index === transactions.length - 1} onPress={handlePress} />
            ) : (
              <Transaction key={transaction.txid} transaction={transaction} onPress={handlePress} />
            );
          })}
        </View>
      </View>
    </RadialGradientScreen>
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
