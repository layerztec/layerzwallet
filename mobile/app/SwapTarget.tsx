import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext, useEffect, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';

import GradientScreen from '@/components/GradientScreen';
import { ThemedText } from '@/components/ThemedText';
import { getNetworkIcon } from '@shared/constants/Colors';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getSwapPairs } from '@shared/models/swap-providers-list';
import { capitalizeFirstLetter } from '@shared/modules/string-utils';
import { Networks } from '@shared/types/networks';
import { SwapPlatform } from '@shared/types/swap';

interface TargetNetworkItem {
  network: Networks;
  name: string;
  icon: string;
}

export default function SwapTarget() {
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const [availableTargets, setAvailableTargets] = useState<TargetNetworkItem[]>([]);
  const params = useLocalSearchParams<{
    amount?: string;
  }>();

  useEffect(() => {
    const swapPairs = getSwapPairs(network, SwapPlatform.MOBILE);
    const targetNetworks = Array.from(new Set(swapPairs.map((pair) => pair.to)));
    const targets: TargetNetworkItem[] = targetNetworks.map((targetNetwork) => ({
      network: targetNetwork,
      name: capitalizeFirstLetter(targetNetwork),
      icon: getNetworkIcon(targetNetwork),
    }));
    setAvailableTargets(targets);
  }, [network]);

  const handleClose = () => {
    router.back();
  };

  const handleSelectTarget = (targetNetwork: Networks) => {
    router.back();
    router.replace({ pathname: '/swap', params: { toNetwork: targetNetwork, amount: params.amount } });
  };

  const renderTargetItem = ({ item }: { item: TargetNetworkItem }) => (
    <TouchableOpacity style={styles.targetItem} onPress={() => handleSelectTarget(item.network)} activeOpacity={0.7}>
      {/* Network Icon */}
      <View style={styles.networkIcon}>
        <Ionicons name={item.icon as any} size={24} color="white" />
      </View>

      {/* Network Name */}
      <ThemedText style={styles.networkName}>{item.name}</ThemedText>
    </TouchableOpacity>
  );

  return (
    <GradientScreen variant={network}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={styles.title}>Choose Target</ThemedText>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={20} color="rgba(255, 255, 255, 0.8)" />
          </TouchableOpacity>
        </View>

        {/* Target Networks List */}
        <View style={styles.listContainer}>
          <FlatList data={availableTargets} renderItem={renderTargetItem} keyExtractor={(item) => item.network} style={styles.list} showsVerticalScrollIndicator={false} />
        </View>

        {/* Empty State */}
        {availableTargets.length === 0 && (
          <View style={styles.emptyState}>
            <ThemedText style={styles.emptyText}>No swap targets available for {capitalizeFirstLetter(network)}</ThemedText>
          </View>
        )}
      </View>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginTop: 32,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    paddingTop: 8,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    fontWeight: '400',
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  targetItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
  },
  networkIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  networkName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 24,
  },
});
