import React, { useContext, useMemo } from 'react';
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
import { getDecimalsByNetwork, getExplorerUrlByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
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
    if (transaction.amount === undefined) return '0';
    const value = formatBalance(Math.abs(transaction.amount).toString(), decimals);
    return value;
  }, [transaction?.amount, decimals]);

  const amountUsd = useMemo(() => {
    if (transaction.amount === undefined || !exchangeRate) return '';
    return `${formatFiatBalance(Math.abs(transaction.amount).toString(), decimals, exchangeRate)} USD`;
  }, [transaction.amount, decimals, exchangeRate]);

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
    if (transaction.direction === 'send') return 'Sent';
    if (transaction.direction === 'receive') return 'Received';
    if (transaction.direction === 'swap') return 'Swap';
    return 'Transaction';
  }, [transaction.direction]);

  const handleCopy = async (text?: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
  };

  const handleOpenInExplorer = () => {
    const url = transaction.explorerUrl;
    if (url) Linking.openURL(url);
  };

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
          <ThemedText style={styles.amountPrimary}>
            {amountPrimary}
            <ThemedText style={styles.amountTicker}> {ticker}</ThemedText>
          </ThemedText>
          <ThemedText style={styles.amountUsd}>{amountUsd}</ThemedText>
        </View>

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
        <TouchableOpacity disabled={!getExplorerUrlByNetwork(network)} style={[styles.explorerButton, !getExplorerUrlByNetwork(network) && { opacity: 0.6 }]} onPress={handleOpenInExplorer}>
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
    fontSize: 30,
    paddingTop: 8,
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
});
