import { AntDesign } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useAssetExchangeRate } from '@shared/hooks/useAssetExchangeRate';
import { getAssetInfo } from '@shared/models/asset-info';
import { getStatusLabel, TransferExecution } from '@shared/types/transfer';
import Pressable from '../Pressable';
import { ThemedText } from '../ThemedText';

interface TransferProps {
  execution: TransferExecution;
  isLast?: boolean;
  onPress?: (execution: TransferExecution) => void;
}

export default function Transfer({ execution, isLast, onPress }: TransferProps) {
  const { exchangeRate } = useAssetExchangeRate(execution.sendAsset);
  const sendAssetInfo = getAssetInfo(execution.sendAsset);

  const fiatText = exchangeRate ? '$' + (parseFloat(execution.sendAmount) * exchangeRate).toFixed(2) : '';

  const statusText = getStatusLabel(execution.status, execution);

  return (
    <>
      <Pressable style={styles.item} onPress={() => onPress?.(execution)}>
        <View style={styles.iconContainer}>
          <AntDesign name="swap" size={22} color="rgba(255, 255, 255, 0.8)" style={styles.icon} />
        </View>

        <View style={styles.details}>
          <ThemedText style={styles.title}>Transfer</ThemedText>
          <ThemedText style={styles.status}>{statusText}</ThemedText>
        </View>

        <View style={styles.amounts}>
          <ThemedText style={styles.amount}>
            {execution.sendAmount} {sendAssetInfo.ticker}
          </ThemedText>
          {fiatText ? <ThemedText style={styles.fiat}>{fiatText}</ThemedText> : null}
        </View>
      </Pressable>
      {!isLast && <View style={styles.divider} />}
    </>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  iconContainer: {
    width: 31,
    height: 31,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    transform: [{ rotate: '-50deg' }],
  },
  details: {
    flex: 1,
    marginLeft: 10,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Inter',
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: -0.32,
  },
  status: {
    fontSize: 14,
    fontFamily: 'Inter',
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.4)',
    letterSpacing: -0.28,
    marginTop: 2,
  },
  amounts: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 16,
    fontFamily: 'Inter',
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: -0.32,
  },
  fiat: {
    fontSize: 14,
    fontFamily: 'Inter',
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.4)',
    letterSpacing: -0.28,
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});
