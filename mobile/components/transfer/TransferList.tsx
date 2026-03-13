import React, { useCallback, useContext, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { TransferServiceManager } from '@shared/services/transfer-service-manager';
import { isActiveStatus, TransferExecution } from '@shared/types/transfer';
import { ThemedText } from '../ThemedText';
import Transfer from './Transfer';

interface TransferListProps {
  transferService: TransferServiceManager;
  onTransferPress?: (execution: TransferExecution) => void;
  activeOnly?: boolean;
}

export default function TransferList({ transferService, onTransferPress, activeOnly = false }: TransferListProps) {
  const { accountNumber } = useContext(AccountNumberContext);
  const [executions, setExecutions] = useState<TransferExecution[]>([]);

  const fetchExecutions = useCallback(async () => {
    const transfers = await transferService.getOngoingTransfers(accountNumber);
    setExecutions(activeOnly ? transfers.filter((execution) => isActiveStatus(execution.status)) : transfers);
  }, [transferService, accountNumber, activeOnly]);

  useEffect(() => {
    fetchExecutions();
    const interval = setInterval(fetchExecutions, 10000);
    return () => clearInterval(interval);
  }, [fetchExecutions]);

  if (executions.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <ThemedText style={styles.headerText}>{activeOnly ? 'Ongoing Transfers' : 'Recent Transfers'}</ThemedText>
      </View>
      <View style={styles.list}>
        {executions.map((execution, index) => (
          <Transfer key={execution.id} execution={execution} isLast={index === executions.length - 1} onPress={onTransferPress} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 18,
    paddingVertical: 2,
    paddingHorizontal: 16,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 2,
  },
  headerText: {
    fontSize: 16,
    fontFamily: 'Inter',
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: -0.32,
    textAlign: 'center',
  },
  list: {
    borderRadius: 20,
    overflow: 'hidden',
  },
});
