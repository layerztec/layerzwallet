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
  title?: string;
}

export default function TransferList({ transferService, onTransferPress, activeOnly = false, title }: TransferListProps) {
  const { accountNumber } = useContext(AccountNumberContext);
  const [executions, setExecutions] = useState<TransferExecution[]>([]);

  const fetchExecutions = useCallback(async () => {
    const transfers = await transferService.getOngoingTransfers(accountNumber);
    setExecutions(activeOnly ? transfers.filter((execution) => isActiveStatus(execution.status)) : transfers);
  }, [transferService, accountNumber, activeOnly]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchExecutions();
    }, 0);
    const interval = setInterval(fetchExecutions, 10000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [fetchExecutions]);

  if (executions.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      {title ? <ThemedText style={styles.title}>{title}</ThemedText> : null}
      <View style={styles.card}>
        <View style={styles.list}>
          {executions.map((execution, index) => (
            <Transfer key={execution.id} execution={execution} isLast={index === executions.length - 1} onPress={onTransferPress} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {},
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 12,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  list: {
    borderRadius: 16,
    overflow: 'hidden',
  },
});
