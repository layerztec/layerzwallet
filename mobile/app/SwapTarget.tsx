import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useContext, useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import GradientFormSheet from '@/components/GradientFormSheet';
import { ThemedText } from '@/components/ThemedText';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getSwapPairs, getSwapTargetName } from '@shared/models/swap-providers-list';
import { SwapOptions, SwapPlatform } from '@shared/types/swap';
import { getNetworkImageAsset } from '@/utils/networkAssets';
import { sleep } from '@shared/modules/sleep';

interface TargetNetworkItem {
  target: SwapOptions;
  name: string;
}

export type SwapTargetParams = {
  fromNetwork: SwapOptions;
};

const ListItem = ({ item, onPress, active, first, last }: { item: TargetNetworkItem; onPress: () => void; active: boolean; first: boolean; last: boolean }) => {
  const networkImage = getNetworkImageAsset(item.target);

  return (
    <TouchableOpacity style={[styles.item, active && styles.activeItem, first && styles.firstItem, last && styles.lastItem]} onPress={onPress} activeOpacity={0.7} testID={`SwapTarget-${item.target}`}>
      <View style={styles.networkIcon}>{networkImage ? <Image source={networkImage} style={styles.networkImage} contentFit="contain" /> : null}</View>
      <ThemedText style={styles.networkName}>{item.name}</ThemedText>
    </TouchableOpacity>
  );
};

export default function SwapTarget() {
  const router = useRouter();
  const params = useLocalSearchParams<SwapTargetParams>();
  const { network } = useContext(NetworkContext);
  const [availableTargets, setAvailableTargets] = useState<TargetNetworkItem[]>([]);

  const fromNetwork = params.fromNetwork;

  useEffect(() => {
    const swapPairs = getSwapPairs(fromNetwork, SwapPlatform.MOBILE);
    const targetsO = Array.from(new Set(swapPairs.map((pair) => pair.to)));
    const targets: TargetNetworkItem[] = targetsO.map((target) => ({
      target: target,
      name: getSwapTargetName(target),
    }));
    setAvailableTargets(targets);
  }, [fromNetwork]);

  const handleClose = () => {
    router.back();
  };

  const handleSelectTarget = async (targetNetwork: SwapOptions) => {
    router.back();
    // let transition happen and then update the params
    await sleep(100);
    router.setParams({ toNetwork: targetNetwork });
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
            <ListItem key={item.target} item={item} onPress={() => handleSelectTarget(item.target)} active={false} first={index === 0} last={index === availableTargets.length - 1} />
          ))}
        </View>

        {/* Empty State */}
        {availableTargets.length === 0 && (
          <View style={styles.emptyState}>
            <ThemedText style={styles.emptyText}>No swap targets available for {getSwapTargetName(fromNetwork)}</ThemedText>
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
