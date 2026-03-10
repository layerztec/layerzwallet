import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { getNetworkImageAsset, getTransferAssetColor, getTransferAssetIcon } from '@/utils/networkAssets';
import { getAssetInfo } from '@shared/models/asset-info';
import { AssetId } from '@shared/types/asset';
import { ThemedText } from '../ThemedText';

interface TransferAssetIconProps {
  asset: AssetId;
  /** Outer container size. Default 43 (matches Figma). */
  size?: number;
}

/** Convert hex color to rgba with given opacity */
function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export default function TransferAssetIcon({ asset, size = 43 }: TransferAssetIconProps) {
  const assetInfo = getAssetInfo(asset);
  const mainIcon = getTransferAssetIcon(asset, assetInfo.network);
  const networkIcon = getNetworkImageAsset(assetInfo.network);
  const showBadge = !!assetInfo.tokenId && mainIcon !== networkIcon;

  const brandColor = getTransferAssetColor(asset);
  const bgColor = brandColor ? hexToRgba(brandColor, 0.25) : 'rgba(255, 255, 255, 0.1)';

  const iconSize = size * 0.6;
  const badgeSize = size * 0.6;
  const badgeImageSize = badgeSize * 0.65;

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor }]}>
      {mainIcon ? <Image source={mainIcon} style={{ width: iconSize, height: iconSize }} contentFit="contain" /> : <ThemedText style={styles.fallback}>{assetInfo.ticker[0]}</ThemedText>}
      {showBadge && networkIcon && (
        <View style={[styles.badge, { width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2 }]}>
          <BlurView intensity={20} tint="light" style={[styles.blurFill, { borderRadius: badgeSize / 2 }]} />
          <Image source={networkIcon} style={{ width: badgeImageSize, height: badgeImageSize }} contentFit="contain" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  badge: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blurFill: {
    ...StyleSheet.absoluteFillObject,
  },
});
