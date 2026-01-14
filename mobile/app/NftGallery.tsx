import React, { useCallback, useContext, useMemo } from 'react';
import Pressable from '../components/Pressable';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import GradientScreen from '@/components/GradientScreen';
import NftImage from '@/components/NftImage';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import { ThemedText } from '@/components/ThemedText';
import { LayerzStorage } from '@/src/class/layerz-storage';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useNftDiscovery } from '@shared/hooks/useNftDiscovery';
import { getTokenIconColor } from '@shared/models/token-list';
import { NftInfo } from '@shared/types/token-info';
import { NftScreenParams } from './Nft';

const ITEM_GAP = 14;

function keyForNft(nft: NftInfo) {
  return `${nft.contractAddress}:${nft.tokenId}`;
}

const NftTile = ({ nft, onPress }: { nft: NftInfo; onPress: (nft: NftInfo) => void }) => {
  const iconColor = getTokenIconColor(nft?.name);

  return (
    <Pressable style={styles.tileOuter} onPress={() => onPress(nft)} activeOpacity={0.85} accessibilityLabel="Open NFT">
      <View style={[styles.tileInner, { backgroundColor: iconColor }]}>{nft.image ? <NftImage source={{ uri: nft.image }} style={styles.image} resizeMode="cover" /> : null}</View>
    </Pressable>
  );
};

export default function NftGallery() {
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { nftList, isLoading, error } = useNftDiscovery(network, accountNumber, BackgroundExecutor, LayerzStorage);

  const data = useMemo(() => nftList ?? [], [nftList]);
  const handleOpenNft = useCallback(
    (nft: NftInfo) => {
      const params: NftScreenParams = { nft: JSON.stringify(nft) };
      router.push({ pathname: '/Nft', params });
    },
    [router]
  );

  return (
    <GradientScreen variant={network}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.root}>
        <ScreenHeader title="NFTs" />

        {(() => {
          if (isLoading && data.length === 0) {
            return (
              <View style={styles.center}>
                <ActivityIndicator size="large" color="rgba(255, 255, 255, 0.8)" />
              </View>
            );
          }

          if (data.length === 0) {
            return (
              <View style={styles.center}>
                <ThemedText style={styles.emptyText}>No NFTs</ThemedText>
              </View>
            );
          }

          return (
            <View style={styles.listWrapper}>
              {error ? <ThemedText style={styles.errorText}>Error: {error.message}</ThemedText> : null}
              <FlatList
                data={data}
                numColumns={2}
                keyExtractor={keyForNft}
                renderItem={({ item }) => <NftTile nft={item} onPress={handleOpenNft} />}
                showsVerticalScrollIndicator={false}
                style={styles.list}
                contentContainerStyle={styles.listContent}
                columnWrapperStyle={styles.columnWrapper}
              />
            </View>
          );
        })()}
      </View>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  listWrapper: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    color: 'rgba(255, 100, 100, 0.9)',
    textAlign: 'center',
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 24,
  },
  columnWrapper: {
    gap: ITEM_GAP,
    marginBottom: ITEM_GAP,
  },
  tileOuter: {
    flex: 1,
  },
  tileInner: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
