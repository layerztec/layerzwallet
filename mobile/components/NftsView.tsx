import React, { useCallback, useContext, useEffect, useImperativeHandle, useMemo, useState, forwardRef } from 'react';
import { StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import NftImage from '@/components/NftImage';
import { LayerzStorage } from '@/src/class/layerz-storage';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getTokenIconColor } from '@shared/models/token-list';
import { NftInfo } from '@shared/types/token-info';
import { useNftDiscovery } from '@shared/hooks/useNftDiscovery';
import { NftScreenParams } from '@/app/Nft';

const MAX_PREVIEW_ITEMS = 4;

const NftPreviewItem: React.FC<{
  nft: NftInfo;
  onPress: (nft: NftInfo) => void;
  selected: boolean;
  style?: StyleProp<ViewStyle>;
}> = ({ nft, onPress, selected, style }) => {
  const iconColor = getTokenIconColor(nft?.name);

  return (
    <TouchableOpacity
      style={[styles.nftPreviewItem, style, selected && styles.selectedNftPreviewItem]}
      onPress={() => onPress(nft)}
      activeOpacity={0.8}
      testID={`nft-preview-${nft.tokenId}`}
      accessibilityLabel={nft?.name ? `NFT ${nft.name}` : 'NFT'}
    >
      <View style={[styles.nftPreviewImageWrapper, { backgroundColor: iconColor }]}>
        {nft.image ? (
          <NftImage source={{ uri: nft.image }} style={styles.nftPreviewImage} resizeMode="cover" />
        ) : (
          <ThemedText style={styles.nftPreviewFallbackText}>{nft?.name?.charAt(0) || '?'}</ThemedText>
        )}
      </View>
    </TouchableOpacity>
  );
};

const NftsView = forwardRef<{ refresh: () => void }, { selectedNft?: string; onViewGalleryPress?: () => void }>(({ selectedNft, onViewGalleryPress }, ref) => {
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { nftList, error, mutate } = useNftDiscovery(network, accountNumber, BackgroundExecutor, LayerzStorage);
  const [show, setShow] = useState(false);
  const handleViewGalleryPress = useCallback(() => {
    if (onViewGalleryPress) return onViewGalleryPress();
    router.push('/NftGallery');
  }, [onViewGalleryPress, router]);

  const handleNftPress = useCallback(
    (nft: NftInfo) => {
      const params: NftScreenParams = { nft: JSON.stringify(nft) };
      router.push({ pathname: '/Nft', params });
    },
    [router]
  );

  useEffect(() => {
    if (nftList.length > 0) setShow(true);
  }, [nftList.length]);

  useImperativeHandle(ref, () => ({
    refresh: () => {
      mutate();
    },
  }));

  if (nftList.length === 0) {
    return null;
  }

  const previewNfts = nftList.slice(0, MAX_PREVIEW_ITEMS);
  const hasMoreThanPreview = nftList.length > MAX_PREVIEW_ITEMS;

  return (
    <View style={[styles.container, !show && styles.hiddenContainer]}>
      <ThemedText style={styles.title}>NFTs</ThemedText>
      <View style={styles.previewRow}>
        {previewNfts.map((nft, idx) => (
          <NftPreviewItem
            key={nft.tokenId}
            nft={nft}
            onPress={handleNftPress}
            selected={selectedNft === nft.tokenId}
            style={idx !== previewNfts.length - 1 ? styles.nftPreviewItemSpacing : undefined}
          />
        ))}
      </View>

      {error ? <ThemedText style={styles.errorText}>Error: {error.message}</ThemedText> : null}

      {hasMoreThanPreview && (
        <TouchableOpacity
          style={styles.viewGalleryButton}
          onPress={handleViewGalleryPress}
          activeOpacity={0.85}
          testID="view-gallery-button"
          accessibilityRole="button"
          accessibilityLabel="View NFT Gallery"
        >
          <ThemedText style={styles.viewGalleryButtonText}>View Gallery</ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );
});

NftsView.displayName = 'NftsView';

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    paddingVertical: 16,
  },
  hiddenContainer: {
    display: 'none',
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    color: 'white',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorText: {
    fontSize: 16,
    color: 'rgba(255, 100, 100, 0.8)',
    textAlign: 'center',
    paddingTop: 8,
  },
  previewRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    justifyContent: 'center',
  },
  nftPreviewItem: {
    flexGrow: 0,
    flexShrink: 0,
  },
  nftPreviewItemSpacing: {
    marginRight: 20,
  },
  selectedNftPreviewItem: {
    opacity: 0.9,
  },
  nftPreviewImageWrapper: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  nftPreviewImage: {
    width: '100%',
    height: '100%',
  },
  nftPreviewFallbackText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  viewGalleryButton: {
    marginTop: 18,
    marginHorizontal: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewGalleryButtonText: {
    fontSize: 18,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
  },
});

export default NftsView;
