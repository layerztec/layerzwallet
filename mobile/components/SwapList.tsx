import { MaterialIcons } from '@expo/vector-icons';
import React, { useContext, useImperativeHandle, forwardRef } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { capitalizeFirstLetter, formatBalance } from '@shared/modules/string-utils';
import { NETWORK_SPARK } from '@shared/types/networks';
import { useSwaps } from '@shared/hooks/useSwaps';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { CommonSwap } from '@shared/types/common-swap';
import { getDecimalsByNetwork } from '@shared/models/network-getters';
import { SwapXArkClaimParams } from '@/app/SwapXArkClaim';

const SwapItem = ({ swap }: { swap: CommonSwap }) => {
  const router = useRouter();
  const amount = formatBalance(swap.amount.toString(), getDecimalsByNetwork(swap.network));

  const formatSwapDate = () => {
    if (!swap.timestamp) {
      return '';
    }
    const date = new Date(swap.timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: '2-digit',
      year: 'numeric',
    });
  };

  const getSwapIcon = () => {
    return swap.direction === 'send' ? 'call-made' : 'call-received';
  };

  const handleClaim = () => {
    if (swap.network === NETWORK_SPARK && swap.status === 'claimable') {
      const params: SwapXArkClaimParams = { swapJson: JSON.stringify(swap) };
      router.push({ pathname: '/SwapXArkClaim', params });
    }
  };

  const handleSwapPress = () => {
    router.push({ pathname: '/SwapDetails', params: { swap: JSON.stringify(swap) } });
  };

  return (
    <TouchableOpacity style={styles.swapItem} onPress={handleSwapPress}>
      <View style={styles.swapIcon}>
        <MaterialIcons name={getSwapIcon()} size={24} color="rgba(255, 255, 255, 0.8)" />
      </View>

      <View style={styles.swapDetails}>
        <ThemedText style={styles.swapType}>{amount}</ThemedText>
        <ThemedText style={styles.swapDate}>{formatSwapDate()}</ThemedText>
        {swap.targetConfirmations && (
          <ThemedText style={styles.swapDate}>
            {swap.confirmations} / {swap.targetConfirmations} confirmations
          </ThemedText>
        )}
      </View>

      <View style={styles.swapAmounts}>
        {swap.network === NETWORK_SPARK && swap.status === 'claimable' ? (
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton} onPress={handleClaim}>
              <ThemedText style={styles.actionButtonText}>Claim</ThemedText>
            </TouchableOpacity>
          </View>
        ) : (
          <ThemedText style={styles.statusText}>{capitalizeFirstLetter(swap.status)}</ThemedText>
        )}
      </View>
    </TouchableOpacity>
  );
};

const SwapList = forwardRef<{ refresh: () => void }>((props, ref) => {
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { swaps, mutate } = useSwaps(network, accountNumber, BackgroundExecutor);

  useImperativeHandle(ref, () => ({
    refresh: () => {
      mutate();
    },
  }));

  if (!swaps || swaps.length === 0) {
    return null;
  }

  return (
    <View style={styles.swapsContainer}>
      <ThemedText style={styles.swapsTitle}>Swaps</ThemedText>

      <View style={styles.swapsList}>
        {swaps.map((swap, index) => (
          <SwapItem key={swap.id} swap={swap} />
        ))}
      </View>
    </View>
  );
});

SwapList.displayName = 'SwapList';

export default SwapList;

const styles = StyleSheet.create({
  swapsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    overflow: 'hidden',
  },
  swapsTitle: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 24,
  },
  swapsList: {
    gap: 24,
  },
  swapItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  swapIcon: {
    width: 24,
    height: 24,
  },
  swapDetails: {
    flex: 1,
    marginLeft: 16,
  },
  swapType: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 6,
  },
  swapDate: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  swapAmounts: {
    alignItems: 'flex-end',
  },
  statusText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '500',
    marginBottom: 6,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  actionButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(33, 150, 243, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(33, 150, 243, 0.4)',
    minWidth: 50,
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2196F3',
    textAlign: 'center',
  },
});
