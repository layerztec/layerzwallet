import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { useExchangeRate } from '@shared/hooks/useExchangeRate';
import { formatBalance, formatFiatBalance } from '@shared/modules/string-utils';
import { CommonTransaction } from '@shared/types/common-transaction';
import { Networks, NETWORK_LIQUID, NETWORK_LIQUID_TESTNET } from '@shared/types/networks';
import { getTokenIconColor, getTokenInfo } from '@shared/models/token-list';

interface TransactionProps {
  transaction: CommonTransaction;
  network: Networks;
}

export default function Transaction({ network, transaction }: TransactionProps) {
  const ticker = getTickerByNetwork(network);
  const decimals = getDecimalsByNetwork(network);
  const { exchangeRate } = useExchangeRate(network, 'USD');

  // Helper function to format transaction amount
  const formatTransactionAmount = () => {
    if (transaction.amount !== undefined) {
      const isNegative = transaction.direction === 'send';
      const sign = isNegative && transaction.amount ? '-' : '';
      const formattedAmount = formatBalance(Math.abs(transaction.amount).toString(), decimals);
      return `${sign}${formattedAmount} ${ticker}`;
    }
    return '0 ' + ticker;
  };

  // Helper function to format transaction USD amount
  const formatTransactionUsdAmount = () => {
    if (transaction.amount !== undefined && exchangeRate) {
      const usdAmount = formatFiatBalance(Math.abs(transaction.amount).toString(), decimals, exchangeRate);
      return `${usdAmount} USD`;
    }
    return '0.00 USD';
  };

  // Helper function to format transaction date
  const formatTransactionDate = () => {
    if (transaction.status === 'pending') {
      return 'Pending...';
    }

    const date = new Date(transaction.timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: '2-digit',
      year: 'numeric',
    });
  };

  // Helper function to get transaction type display text
  const getTransactionTypeText = () => {
    switch (transaction.direction) {
      case 'send':
        return 'Sent';
      case 'receive':
        return 'Received';
      case 'swap':
        return 'Swap';
      default:
        return 'Transaction';
    }
  };

  // Helper function to get transaction icon
  const getTransactionIcon = () => {
    switch (transaction.direction) {
      case 'receive':
        return 'call-received';
      case 'send':
        return 'call-made';
      case 'swap':
        return 'swap-horiz';
      default:
        return 'call-made';
    }
  };

  // Helper function to render token transfers
  const renderTokenTransfers = () => {
    if (!transaction.tokenTransfers || transaction.tokenTransfers.length === 0) {
      return null;
    }

    return (
      <View style={styles.tokenTransfers}>
        {transaction.tokenTransfers.map((transfer, index) => {
          const tokenInfo = getTokenInfo(transfer.address);
          const iconColor = getTokenIconColor(tokenInfo.name);
          const formattedAmount = transfer.amount;
          const isNegative = transaction.direction === 'send';
          const sign = isNegative ? '-' : '';

          return (
            <View key={index} style={styles.tokenTransfer}>
              <View style={[styles.tokenIcon, { backgroundColor: iconColor }]}>
                <ThemedText style={styles.tokenIconText}>{tokenInfo.symbol?.charAt(0).toUpperCase() || '?'}</ThemedText>
              </View>
              <ThemedText style={styles.tokenAmount}>
                {sign}
                {formattedAmount} {tokenInfo.symbol}
              </ThemedText>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.transactionItem}>
      <View style={styles.transactionIcon}>
        <MaterialIcons name={getTransactionIcon()} size={24} color="rgba(255, 255, 255, 0.8)" />
      </View>

      <View style={styles.transactionDetails}>
        <ThemedText style={styles.transactionType}>{getTransactionTypeText()}</ThemedText>
        <ThemedText style={styles.transactionDate}>{formatTransactionDate()}</ThemedText>
        {renderTokenTransfers()}
      </View>

      <View style={styles.transactionAmounts}>
        <ThemedText style={styles.transactionAmount}>{formatTransactionAmount()}</ThemedText>
        <ThemedText style={styles.transactionUsd}>{formatTransactionUsdAmount()}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionIcon: {
    width: 24,
    height: 24,
  },
  transactionDetails: {
    flex: 1,
    marginLeft: 16,
  },
  transactionType: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 6,
  },
  transactionDate: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  transactionAmounts: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 6,
  },
  transactionUsd: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '500',
  },
  tokenTransfers: {
    marginTop: 8,
    gap: 6,
  },
  tokenTransfer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tokenIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenIconText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  tokenAmount: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '400',
  },
});
