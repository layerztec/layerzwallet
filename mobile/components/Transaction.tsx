import { MaterialIcons } from '@expo/vector-icons';
import React, { useMemo, useState, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Pressable from './Pressable';

import { ThemedText } from '@/components/ThemedText';
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
  const [imageLoadError, setImageLoadError] = useState(false);

  // Check if this is a zero-amount transaction with exactly one token
  const isZeroAmountWithSingleToken = useMemo(() => {
    return !transaction.amount && transaction.tokenTransfers?.length === 1;
  }, [transaction.amount, transaction.tokenTransfers]);

  const getTokenInfoSafe = (id: string | undefined) => {
    try {
      return getTokenInfo(id);
    } catch {
      return undefined;
    }
  };

  const singleTokenInfo = useMemo(() => {
    if (isZeroAmountWithSingleToken && transaction.tokenTransfers?.[0]) {
      return getTokenInfoSafe(transaction.tokenTransfers[0].tokenId);
    }
    return null;
  }, [isZeroAmountWithSingleToken, transaction.tokenTransfers]);

  const shortenTokenId = (id: string) => {
    const s = id.trim();
    if (s.length <= 14) return s;
    return `${s.slice(0, 6)}…${s.slice(-4)}`;
  };

  useEffect(() => {
    setImageLoadError(false);
  }, [transaction.txid, singleTokenInfo?.logoURI]);

  const formattedTransactionAmount = useMemo(() => {
    if (isZeroAmountWithSingleToken) {
      const transfer = transaction.tokenTransfers?.[0];
      if (singleTokenInfo && transfer) {
        const isNegative = !transfer.amount && transaction.direction === 'send';
        const sign = isNegative ? '-' : '';
        const formattedAmount = transfer.amount ? formatBalance(transfer.amount.toString(), singleTokenInfo.decimals) : '0';
        return `${sign} ${singleTokenInfo.symbol}${formattedAmount}`;
      }
    }

    if (transaction.amount !== undefined) {
      const isZero = transaction.amount === 0;
      const isNegative = !isZero && transaction.direction === 'send';
      const sign = isNegative ? '-' : '';
      const formattedAmount = formatBalance(Math.abs(transaction.amount).toString(), decimals);
      return `${sign}${formattedAmount} ${ticker}`;
    }
    return '0 ' + ticker;
  }, [isZeroAmountWithSingleToken, singleTokenInfo, transaction.tokenTransfers, transaction.direction, transaction.amount, decimals, ticker]);

  const formattedTransactionUsdAmount = useMemo(() => {
    if (isZeroAmountWithSingleToken) {
      return '';
    }

    if (transaction.amount !== undefined && exchangeRate) {
      const usdAmount = formatFiatBalance(Math.abs(transaction.amount).toString(), decimals, exchangeRate);
      return `$${usdAmount}`;
    }
    return '$0.00';
  }, [isZeroAmountWithSingleToken, transaction.amount, exchangeRate, decimals]);

  const formattedTransactionDate = useMemo(() => {
    if (transaction.status === 'pending') {
      return 'Pending...';
    }

    const date = new Date(transaction.timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: '2-digit',
      year: 'numeric',
    });
  }, [transaction.status, transaction.timestamp]);

  const transactionTypeText = useMemo(() => {
    if (isZeroAmountWithSingleToken) {
      if (singleTokenInfo) {
        switch (transaction.direction) {
          case 'send':
            return `Sent ${singleTokenInfo.name}`;
          case 'receive':
            return `Received ${singleTokenInfo.name}`;
          case 'swap':
            return `Swapped ${singleTokenInfo.name}`;
          default:
            return `${singleTokenInfo.name}`;
        }
      }
    }

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
  }, [isZeroAmountWithSingleToken, singleTokenInfo, transaction.direction]);

  const transactionIconName = useMemo(() => {
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
  }, [transaction.direction]);

  const transactionIcon = useMemo(() => {
    if (isZeroAmountWithSingleToken && singleTokenInfo?.logoURI && !imageLoadError) {
      return <Image source={{ uri: singleTokenInfo.logoURI }} style={styles.tokenLogo} contentFit="contain" onError={() => setImageLoadError(true)} />;
    }

    if (isZeroAmountWithSingleToken) {
      return <MaterialIcons name={transactionIconName} size={24} color="rgba(255, 255, 255, 0.8)" />;
    }

    return <MaterialIcons name={transactionIconName} size={24} color="rgba(255, 255, 255, 0.8)" />;
  }, [isZeroAmountWithSingleToken, singleTokenInfo, transactionIconName, imageLoadError]);

  const tokenTransfers = useMemo(() => {
    if (!transaction.tokenTransfers || transaction.tokenTransfers.length === 0) {
      return null;
    }

    return (
      <View style={styles.tokenTransfers}>
        {transaction.tokenTransfers.map((transfer, index) => {
          const tokenInfo = getTokenInfoSafe(transfer.tokenId);
          const iconColor = getTokenIconColor(tokenInfo?.name);
          let formattedAmount = '';
          if (transfer.amount && tokenInfo) formattedAmount = formatBalance(transfer.amount.toString(), tokenInfo.decimals);
          const isNegative = !transfer.amount && transaction.direction === 'send';
          const sign = isNegative ? '-' : '';

          return (
            <View key={index} style={styles.tokenTransfer}>
              <View style={[styles.tokenIcon, { backgroundColor: iconColor }]}>
                <ThemedText style={styles.tokenIconText}>{tokenInfo?.symbol?.charAt(0).toUpperCase() || '?'}</ThemedText>
              </View>
              {tokenInfo ? (
                <ThemedText style={styles.tokenAmount}>
                  {sign}
                  {tokenInfo.symbol}
                  {formattedAmount}
                </ThemedText>
              ) : (
                <ThemedText style={styles.tokenAmount}>Unknown token ({shortenTokenId(transfer.tokenId)})</ThemedText>
              )}
            </View>
          );
        })}
      </View>
    );
  }, [transaction.tokenTransfers, transaction.direction]);

  return (
    <Pressable style={styles.transactionItem} onPress={onPress}>
      <View style={styles.transactionIcon}>{transactionIcon}</View>

      <View style={styles.transactionDetails}>
        <ThemedText style={styles.transactionType}>{transactionTypeText}</ThemedText>
        <ThemedText style={styles.transactionDate}>{formattedTransactionDate}</ThemedText>
        {!isZeroAmountWithSingleToken && tokenTransfers}
      </View>

      <View style={styles.transactionAmounts}>
        <ThemedText style={styles.transactionAmount}>{formattedTransactionAmount}</ThemedText>
        {formattedTransactionUsdAmount && <ThemedText style={styles.transactionUsd}>{formattedTransactionUsdAmount}</ThemedText>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  transactionIcon: {
    width: 24,
    height: 24,
    marginTop: 8,
    alignSelf: 'flex-start',
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
  tokenLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
});
