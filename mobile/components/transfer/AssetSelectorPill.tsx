import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet } from 'react-native';

import { getAssetInfo } from '@shared/models/asset-info';
import { AssetId } from '@shared/types/asset';
import Pressable from '../Pressable';
import { ThemedText } from '../ThemedText';
import TransferAssetIcon from './TransferAssetIcon';

interface AssetSelectorPillProps {
  asset: AssetId | undefined;
  onPress: () => void;
  testID?: string;
}

export default function AssetSelectorPill({ asset, onPress, testID }: AssetSelectorPillProps) {
  if (!asset) {
    return (
      <Pressable style={styles.pill} onPress={onPress} activeOpacity={0.7} testID={testID}>
        <ThemedText style={styles.selectText}>Select</ThemedText>
        <Ionicons name="chevron-down" size={14} color="rgba(255, 255, 255, 0.6)" />
      </Pressable>
    );
  }

  const { name, ticker } = getAssetInfo(asset);
  const assetTicker = name === 'USDT' ? 'USDT' : ticker;

  return (
    <Pressable style={styles.pill} onPress={onPress} activeOpacity={0.7} testID={testID}>
      <TransferAssetIcon asset={asset} size={22} />
      <ThemedText style={styles.ticker}>{assetTicker}</ThemedText>
      <Ionicons name="chevron-down" size={14} color="rgba(255, 255, 255, 0.6)" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  ticker: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  selectText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
  },
});
