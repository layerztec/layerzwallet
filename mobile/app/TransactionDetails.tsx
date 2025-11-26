import React, { useContext, useMemo, useState } from 'react';
import { Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';

import GradientFormSheet from '@/components/GradientFormSheet';
import { ThemedText } from '@/components/ThemedText';
import { getNetworkImageAsset } from '@/utils/networkAssets';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useExchangeRate } from '@shared/hooks/useExchangeRate';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { getTokenInfo, getTokenIconColor } from '@shared/models/token-list';
import { capitalizeFirstLetter, formatBalance, formatFiatBalance } from '@shared/modules/string-utils';
import { CommonTransaction } from '@shared/types/common-transaction';

export default function TransactionDetails() {
  const { network: selectedNetwork } = useContext(NetworkContext);
  const { transaction: jsonTransaction } = useLocalSearchParams();
  const transaction: CommonTransaction = JSON.parse(jsonTransaction as string);
  const network = transaction.network;
  const ticker = getTickerByNetwork(network);
  const decimals = getDecimalsByNetwork(network);
  const { exchangeRate } = useExchangeRate(network, 'USD');
  const networkImage = getNetworkImageAsset(network);
  const networkIconContent = networkImage ? <Image source={networkImage} style={styles.networkImage} contentFit="contain" /> : null;
  const [imageLoadErrors, setImageLoadErrors] = useState<{ [key: string]: boolean }>({});

  // Check if this is a zero-amount transaction with tokens
  const isZeroAmountWithTokens = useMemo(() => {
    return !transaction.amount && transaction.tokenTransfers && transaction.tokenTransfers.length > 0;
  }, [transaction.amount, transaction.tokenTransfers]);

  const singleTokenInfo = useMemo(() => {
    if (isZeroAmountWithTokens && transaction.tokenTransfers?.length === 1) {
      return getTokenInfo(transaction.tokenTransfers[0].tokenId);
    }
    return null;
  }, [isZeroAmountWithTokens, transaction.tokenTransfers]);

  const [formattedDate, formattedDateWithTime] = useMemo(() => {
    const d = new Date(transaction.timestamp * 1000);
    const dateStr = d.toLocaleDateString('en-US', {
      month: 'long',
      day: '2-digit',
      year: 'numeric',
    });
    const timeStr = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return [dateStr, `${dateStr} - ${timeStr.toLowerCase()}`];
  }, [transaction.timestamp]);

  const amountPrimary = useMemo(() => {
    if (isZeroAmountWithTokens && singleTokenInfo) {
      const transfer = transaction.tokenTransfers?.[0];
      if (transfer) {
        const isNegative = transaction.direction === 'send';
        const sign = isNegative ? '-' : '';
        const formattedAmount = transfer.amount ? formatBalance(transfer.amount.toString(), singleTokenInfo.decimals) : '0';
        return `${sign}${formattedAmount}`;
      }
    }

    if (transaction.amount === undefined) return '';
    return formatBalance(Math.abs(transaction.amount).toString(), decimals);
  }, [isZeroAmountWithTokens, singleTokenInfo, transaction.tokenTransfers, transaction.direction, transaction.amount, decimals]);

  const amountTicker = useMemo(() => {
    if (isZeroAmountWithTokens && singleTokenInfo) {
      return singleTokenInfo.symbol;
    }
    return ticker;
  }, [isZeroAmountWithTokens, singleTokenInfo, ticker]);

  const amountUsd = useMemo(() => {
    if (isZeroAmountWithTokens) {
      return '';
    }

    if (transaction.amount === undefined || !exchangeRate) return '— USD';
    return `${formatFiatBalance(Math.abs(transaction.amount).toString(), decimals, exchangeRate)} USD`;
  }, [isZeroAmountWithTokens, transaction.amount, decimals, exchangeRate]);

  const statusText = useMemo(() => {
    switch (transaction.status) {
      case 'pending':
        return 'Pending...';
      case 'confirmed':
        return 'Confirmed';
      case 'failed':
        return 'Failed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return undefined;
    }
  }, [transaction.status]);

  const directionText = useMemo(() => {
    if (isZeroAmountWithTokens && singleTokenInfo) {
      switch (transaction.direction) {
        case 'send':
          return `Sent ${singleTokenInfo.name}`;
        case 'receive':
          return `Received ${singleTokenInfo.name}`;
        case 'swap':
          return `Swapped ${singleTokenInfo.name}`;
        default:
          return singleTokenInfo.name;
      }
    }

    if (transaction.direction === 'send') return 'Sent';
    if (transaction.direction === 'receive') return 'Received';
    if (transaction.direction === 'swap') return 'Swap';
    return 'Transaction';
  }, [isZeroAmountWithTokens, singleTokenInfo, transaction.direction]);

  const handleCopy = async (text?: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
  };

  const handleOpenInExplorer = () => {
    const url = transaction.explorerUrl;
    if (url) Linking.openURL(url);
  };

  const tokenTransfersList = useMemo(() => {
    if (!isZeroAmountWithTokens || !transaction.tokenTransfers || transaction.tokenTransfers.length <= 1) {
      return null;
    }

    return (
      <View style={styles.tokenTransfersBlock}>
        {transaction.tokenTransfers.map((transfer, index) => {
          const tokenInfo = getTokenInfo(transfer.tokenId);
          const iconColor = getTokenIconColor(tokenInfo.name);
          const formattedAmount = transfer.amount ? formatBalance(transfer.amount.toString(), tokenInfo.decimals) : '0';
          const isNegative = transaction.direction === 'send';
          const sign = isNegative ? '-' : '';
          const imageErrorKey = `${transfer.tokenId}-${index}`;
          const hasImageError = imageLoadErrors[imageErrorKey];

          const getTokenTransactionText = () => {
            switch (transaction.direction) {
              case 'send':
                return `Sent ${tokenInfo.name}`;
              case 'receive':
                return `Received ${tokenInfo.name}`;
              case 'swap':
                return `Swapped ${tokenInfo.name}`;
              default:
                return tokenInfo.name;
            }
          };

          return (
            <View key={index} style={styles.tokenTransferRow}>
              <View style={styles.tokenIconContainer}>
                {tokenInfo.logoURI && !hasImageError ? (
                  <Image source={{ uri: tokenInfo.logoURI }} style={styles.tokenLogo} contentFit="contain" onError={() => setImageLoadErrors((prev) => ({ ...prev, [imageErrorKey]: true }))} />
                ) : (
                  <View style={[styles.tokenIcon, { backgroundColor: iconColor }]}>
                    <ThemedText style={styles.tokenIconText}>{tokenInfo.symbol?.charAt(0).toUpperCase() || '?'}</ThemedText>
                  </View>
                )}
              </View>
              <View style={styles.tokenTransferDetails}>
                <ThemedText style={styles.tokenName}>{getTokenTransactionText()}</ThemedText>
              </View>
              <View style={styles.tokenAmountContainer}>
                <ThemedText style={styles.tokenAmount}>
                  {sign}
                  {tokenInfo.symbol}
                  {formattedAmount}
                </ThemedText>
              </View>
            </View>
          );
        })}
      </View>
    );
  }, [isZeroAmountWithTokens, transaction.tokenTransfers, transaction.direction, imageLoadErrors]);

  return (
    <GradientFormSheet variant={selectedNetwork}>
      <View style={styles.container}>
        {/* Top header: icon, type, date */}
        <View style={styles.topHeader}>
          <View style={styles.networkIcon}>{networkIconContent}</View>
          <View style={styles.typeTextWrap}>
            <ThemedText style={styles.typeText}>{directionText}</ThemedText>
            {formattedDateWithTime && <ThemedText style={styles.subText}>{formattedDateWithTime}</ThemedText>}
          </View>
        </View>

        {/* Amounts */}
        <View style={styles.amountsBlock}>
          <ThemedText type="sfProRounded" style={styles.amountPrimary}>
            {amountPrimary}
            <ThemedText style={styles.amountTicker}> {amountTicker}</ThemedText>
          </ThemedText>
          {amountUsd && <ThemedText style={styles.amountUsd}>{amountUsd}</ThemedText>}
        </View>

        {/* Token transfers list for multiple tokens */}
        {tokenTransfersList}

        {/* Status chip */}
        {statusText && (
          <View style={styles.statusChip}>
            <ThemedText style={styles.statusText}>{statusText}</ThemedText>
            <View style={styles.statusBorder} aria-hidden />
          </View>
        )}

        {/* Details list */}
        <View style={styles.detailsList}>
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>{transaction.direction === 'send' ? 'To' : 'From'}</ThemedText>
            <View style={styles.detailValueWrap}>
              <TouchableOpacity onPress={() => handleCopy(transaction.counterparty ?? '')}>
                <MaterialIcons name="content-copy" size={16} color="rgba(255, 255, 255, 0.8)" />
              </TouchableOpacity>
              <ThemedText style={[styles.detailValue]} numberOfLines={1} ellipsizeMode="middle">
                {transaction.counterparty ?? '—'}
              </ThemedText>
            </View>
          </View>

          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Date</ThemedText>
            <ThemedText style={styles.detailValue}>{formattedDate}</ThemedText>
          </View>

          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Network Fee</ThemedText>
            <ThemedText style={styles.detailValue}>{typeof transaction.fee === 'number' ? `${formatBalance(transaction.fee.toString(), decimals)} ${ticker}` : '—'}</ThemedText>
          </View>

          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Layer</ThemedText>
            <ThemedText style={styles.detailValue}>{capitalizeFirstLetter(network)}</ThemedText>
          </View>
        </View>

        {/* Open in explorer */}
        <TouchableOpacity disabled={!transaction.explorerUrl} style={[styles.explorerButton, !transaction.explorerUrl && { opacity: 0.6 }]} onPress={handleOpenInExplorer}>
          <ThemedText style={styles.explorerText}>Open in explorer</ThemedText>
        </TouchableOpacity>
      </View>
    </GradientFormSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginHorizontal: 16,
    justifyContent: 'space-between',
  },
  topHeader: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  networkIcon: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  networkImage: {
    width: 24,
    height: 24,
  },
  typeTextWrap: {
    marginLeft: 12,
  },
  typeText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  subText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: -2,
  },
  amountsBlock: {
    marginTop: 24,
    alignItems: 'center',
  },
  amountPrimary: {
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  amountTicker: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  amountUsd: {
    marginTop: 6,
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  statusChip: {
    marginTop: 18,
    alignSelf: 'center',
    height: 38,
    width: 183,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  statusText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  statusBorder: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderWidth: 1,
    borderColor: 'white',
    borderRadius: 40,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsList: {
    marginTop: 28,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  detailValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '50%',
  },
  detailValue: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'right',
  },
  explorerButton: {
    alignSelf: 'center',
    width: '100%',
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  explorerText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  tokenTransfersBlock: {
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    gap: 8,
  },
  tokenTransferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tokenIconContainer: {
    width: 32,
    height: 32,
  },
  tokenIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenIconText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  tokenLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  tokenTransferDetails: {
    flex: 1,
  },
  tokenName: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  tokenAmountContainer: {
    alignItems: 'flex-end',
  },
  tokenAmount: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '400',
  },
});
