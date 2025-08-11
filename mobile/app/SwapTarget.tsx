import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import React, { useContext, useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import GradientFormSheet from '@/components/GradientFormSheet';
import { ThemedText } from '@/components/ThemedText';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getSwapPairs } from '@shared/models/swap-providers-list';
import { capitalizeFirstLetter } from '@shared/modules/string-utils';
import { Networks } from '@shared/types/networks';
import { SwapPlatform } from '@shared/types/swap';
import { getNetworkImageAsset } from '@/utils/networkAssets';

interface TargetNetworkItem {
  network: Networks;
  name: string;
}

const ListItem = ({ item, onPress, active, first, last }: { item: TargetNetworkItem; onPress: () => void; active: boolean; first: boolean; last: boolean }) => {
  const networkImage = getNetworkImageAsset(item.network);

  return (
    <TouchableOpacity style={[styles.item, active && styles.activeItem, first && styles.firstItem, last && styles.lastItem]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.networkIcon}>{networkImage ? <Image source={networkImage} style={styles.networkImage} contentFit="contain" /> : null}</View>
      <ThemedText style={styles.networkName}>{item.name}</ThemedText>
    </TouchableOpacity>
  );
};

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
    }));
    setAvailableTargets(targets);
  }, [network]);

  const handleClose = () => {
    router.back();
  };

  const handleSelectTarget = (targetNetwork: Networks) => {
    router.back();
    router.setParams({ toNetwork: targetNetwork, amount: params.amount });
  };

  return (
    <GradientFormSheet variant={network}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={styles.title}>Swap to</ThemedText>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close" size={20} color="rgba(255, 255, 255, 0.8)" />
        </TouchableOpacity>

        {/* Target Networks List */}
        <View style={styles.listContainer}>
          {availableTargets.map((item, index) => (
            <ListItem key={item.network} item={item} onPress={() => handleSelectTarget(item.network)} active={false} first={index === 0} last={index === availableTargets.length - 1} />
          ))}
        </View>

        {/* Empty State */}
        {availableTargets.length === 0 && (
          <View style={styles.emptyState}>
            <ThemedText style={styles.emptyText}>No swap targets available for {capitalizeFirstLetter(network)}</ThemedText>
          </View>
        )}
      </View>
    </GradientFormSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginTop: 64,
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
    top: 16,
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
    gap: 2,
  },
  item: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
  },
  firstItem: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  lastItem: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  activeItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
  networkImage: {
    width: 24,
    height: 24,
  },
});
