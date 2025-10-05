import React, { useContext, useMemo } from 'react';
import { Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import GradientFormSheet from '@/components/GradientFormSheet';
import { ThemedText } from '@/components/ThemedText';
import { getNetworkImageAsset } from '@/utils/networkAssets';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useExchangeRate } from '@shared/hooks/useExchangeRate';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { capitalizeFirstLetter, formatBalance, formatFiatBalance } from '@shared/modules/string-utils';
import { CommonSwap } from '@shared/types/common-swap';
import { NETWORK_ARKADE, NETWORK_ARKADE_MUTINYNET, NETWORK_SPARK, Networks } from '@shared/types/networks';
import { SwapXArkClaimParams } from '@/app/SwapXArkClaim';

export default function SwapDetails() {
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const { swap: jsonSwap } = useLocalSearchParams();
  const swap: CommonSwap = JSON.parse(jsonSwap as string);
  const ticker = getTickerByNetwork(network);
  const decimals = getDecimalsByNetwork(network);
  const { exchangeRate } = useExchangeRate(network, 'USD');
  const networkImage = getNetworkImageAsset(network);
  const networkIconContent = networkImage ? <Image source={networkImage} style={styles.networkImage} contentFit="contain" /> : null;

  const [formattedDate, formattedDateWithTime] = useMemo(() => {
    if (!swap.timestamp) return ['—', '—'];
    const d = new Date(swap.timestamp);
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
  }, [swap.timestamp]);

  const amountPrimary = useMemo(() => {
    if (swap.amount === undefined) return '0';
    const value = formatBalance(Math.abs(swap.amount).toString(), decimals);
    return value;
  }, [swap?.amount, decimals]);

  const amountUsd = useMemo(() => {
    if (swap.amount === undefined || !exchangeRate) return '';
    return `${formatFiatBalance(Math.abs(swap.amount).toString(), decimals, exchangeRate)} USD`;
  }, [swap.amount, decimals, exchangeRate]);

  const statusText = useMemo(() => {
    switch (swap.status) {
      case 'pending':
        return 'Pending...';
      case 'confirmed':
        return 'Confirmed';
      case 'failed':
        return 'Failed';
      case 'cancelled':
        return 'Cancelled';
      case 'claimable':
        return 'Claimable';
      default:
        return undefined;
    }
  }, [swap.status]);

  const directionText = useMemo(() => {
    if (swap.direction === 'send') return 'Swap Out';
    if (swap.direction === 'receive') return 'Swap In';
    return 'Swap';
  }, [swap.direction]);

  const handleCopy = async (text?: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
  };

  const handleOpenInExplorer = () => {
    swap.explorerUrl && Linking.openURL(swap.explorerUrl);
  };

  const handleClaim = () => {
    if ([NETWORK_SPARK, NETWORK_ARKADE_MUTINYNET, NETWORK_ARKADE].includes(swap.network as any) && swap.status === 'claimable') {
      const params: SwapXArkClaimParams = { swapJson: JSON.stringify(swap) };
      router.push({ pathname: '/SwapXArkClaim', params });
    }
  };

  const showClaimButton = [NETWORK_SPARK, NETWORK_ARKADE_MUTINYNET, NETWORK_ARKADE].includes(swap.network as any) && swap.status === 'claimable';

  return (
    <GradientFormSheet variant={network}>
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
            <ThemedText style={styles.detailLabel}>Swap ID</ThemedText>
            <View style={styles.detailValueWrap}>
              <TouchableOpacity onPress={() => handleCopy(swap.id)}>
                <MaterialIcons name="content-copy" size={16} color="rgba(255, 255, 255, 0.8)" />
              </TouchableOpacity>
              <ThemedText style={[styles.detailValue]} numberOfLines={1} ellipsizeMode="middle">
                {swap.id}
              </ThemedText>
            </View>
          </View>

          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Date</ThemedText>
            <ThemedText style={styles.detailValue}>{formattedDate}</ThemedText>
          </View>

          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Type</ThemedText>
            <ThemedText style={styles.detailValue}>{directionText}</ThemedText>
          </View>

          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Network</ThemedText>
            <ThemedText style={styles.detailValue}>{capitalizeFirstLetter(swap.network)}</ThemedText>
          </View>

          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Status</ThemedText>
            <ThemedText style={styles.detailValue}>{capitalizeFirstLetter(swap.status)}</ThemedText>
          </View>

          {swap.targetConfirmations && (
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Confirmations</ThemedText>
              <ThemedText style={styles.detailValue}>
                {swap.confirmations} / {swap.targetConfirmations}
              </ThemedText>
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.actionButtonsContainer}>
          {/* Claim button for claimable Spark swaps */}
          {showClaimButton && (
            <TouchableOpacity style={styles.primaryButton} onPress={handleClaim}>
              <ThemedText style={styles.primaryButtonText}>Claim Swap</ThemedText>
            </TouchableOpacity>
          )}

          {/* Open in explorer */}
          <TouchableOpacity disabled={!swap.explorerUrl} style={[styles.explorerButton, !swap.explorerUrl && { opacity: 0.6 }]} onPress={handleOpenInExplorer}>
            <ThemedText style={styles.explorerText}>Open in explorer</ThemedText>
          </TouchableOpacity>
        </View>
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
  actionButtonsContainer: {
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  primaryButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: '600',
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
