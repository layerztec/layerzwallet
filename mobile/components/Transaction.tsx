import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import PlatformBlurView from '@/components/PlatformBlurView';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { useExchangeRate } from '@shared/hooks/useExchangeRate';
import { formatBalance, formatFiatBalance } from '@shared/modules/string-utils';
import { CommonTransaction } from '@shared/types/common-transaction';
import { getTokenIconColor, getTokenInfo } from '@shared/models/token-list';

interface TransactionProps {
  transaction: CommonTransaction;
  onPress?: () => void;
}

export default function Transaction({ transaction, onPress }: TransactionProps) {
  const { exchangeRate } = useExchangeRate(transaction.network, 'USD');
  const decimals = getDecimalsByNetwork(transaction.network);
  const ticker = getTickerByNetwork(transaction.network);

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
    const currentYear = new Date().getFullYear();
    const transactionYear = date.getFullYear();
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: transactionYear === currentYear ? undefined : 'numeric',
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


  // Check if this is a token transaction
  const isTokenTransaction = transaction.tokenTransfers && transaction.tokenTransfers.length > 0;
  const firstTokenTransfer = isTokenTransaction ? transaction.tokenTransfers?.[0] : null;
  const tokenInfo = firstTokenTransfer ? getTokenInfo(firstTokenTransfer.tokenId) : null;
  const iconColor = tokenInfo ? getTokenIconColor(tokenInfo.name) : null;

  // Helper function to format token transaction amount
  const formatTokenTransactionAmount = () => {
    if (firstTokenTransfer && firstTokenTransfer.amount) {
      const isNegative = transaction.direction === 'send';
      const sign = isNegative ? '-' : '';
      const formattedAmount = formatBalance(firstTokenTransfer.amount.toString(), tokenInfo?.decimals || 0);
      return `${sign}${formattedAmount} ${tokenInfo?.symbol || 'Token'}`;
    }
    return formatTransactionAmount();
  };

  return (
    <TouchableOpacity style={styles.transactionItem} onPress={onPress}>
      <View style={[styles.transactionIcon, isTokenTransaction && { backgroundColor: 'transparent' }]}>
        {isTokenTransaction && tokenInfo ? (
          <>
            <View style={[styles.tokenIconMain, { backgroundColor: iconColor || 'transparent' }]}>
              <ThemedText style={styles.tokenIconText}>{tokenInfo.symbol?.charAt(0).toUpperCase() || '?'}</ThemedText>
            </View>
            <View style={styles.directionIconOverlay}>
              <PlatformBlurView intensity={20} tint="light" style={styles.blurBackground} />
              <MaterialIcons name={getTransactionIcon()} size={12} color="rgba(255, 255, 255, 0.8)" />
            </View>
          </>
        ) : (
          <>
            <PlatformBlurView intensity={20} tint="light" style={styles.blurBackground} />
            <MaterialIcons name={getTransactionIcon()} size={16} color="rgba(255, 255, 255, 0.8)" />
          </>
        )}
      </View>

      <View style={styles.transactionDetails}>
        <ThemedText style={styles.transactionType}>{getTransactionTypeText()}</ThemedText>
        <ThemedText style={styles.transactionDate}>
          {isTokenTransaction && tokenInfo ? `${tokenInfo.name} - ` : ''}{formatTransactionDate()}
        </ThemedText>
      </View>

      <View style={styles.transactionAmounts}>
        <ThemedText style={styles.transactionAmount}>{formatTokenTransactionAmount()}</ThemedText>
        <ThemedText style={styles.transactionUsd}>{formatTransactionUsdAmount()}</ThemedText>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionIcon: {
    width: 36,
    height: 36,
    alignSelf: 'center',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  transactionDetails: {
    flex: 1,
    marginLeft: 16,
  },
  transactionType: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',

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

  },
  transactionUsd: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '500',
  },
  tokenIconText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  directionIconOverlay: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenIconMain: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blurBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 30,
    overflow: 'hidden',
  },
});
