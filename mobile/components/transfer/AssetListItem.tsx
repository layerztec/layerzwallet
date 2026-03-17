import React from 'react';
import { StyleSheet, View } from 'react-native';

import { getAssetInfo } from '@shared/models/asset-info';
import { AssetId } from '@shared/types/asset';
import Pressable from '../Pressable';
import { ThemedText } from '../ThemedText';
import TransferAssetIcon from './TransferAssetIcon';

interface AssetListItemProps {
  asset: AssetId;
  onPress: () => void;
  isFirst: boolean;
  isLast: boolean;
  testID?: string;
}

export default function AssetListItem({ asset, onPress, isFirst, isLast, testID }: AssetListItemProps) {
  const assetInfo = getAssetInfo(asset);

  return (
    <Pressable style={[styles.item, isFirst && styles.firstItem, isLast && styles.lastItem]} onPress={onPress} activeOpacity={0.7} testID={testID}>
      <View style={styles.iconWrapper}>
        <TransferAssetIcon asset={asset} size={38} />
      </View>
      <View style={styles.textContainer}>
        <ThemedText style={styles.name}>{assetInfo.name}</ThemedText>
        <ThemedText style={styles.network}>{assetInfo.networkDisplayName}</ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  iconWrapper: {
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
  network: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 2,
  },
});
