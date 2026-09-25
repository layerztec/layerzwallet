import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable as RNPressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Pressable from '@/components/Pressable';
import { ThemedText } from '@/components/ThemedText';
import AssetListItem from '@/components/transfer/AssetListItem';
import { useSetting } from '@shared/hooks/useSettings';
import { getAssetInfo } from '@shared/models/asset-info';
import { getIsTestnet } from '@shared/models/network-getters';
import { AssetId } from '@shared/types/asset';
import { useTransferFlow } from '@/src/transfer/TransferFlowContext';

export type SelectAssetParams = {
  side: 'send' | 'receive';
};

const DISMISS_THRESHOLD = 150;

function setSharedValue(sharedValue: { value: unknown }, nextValue: unknown) {
  'worklet';
  sharedValue.value = nextValue;
}

export default function SelectAsset() {
  const router = useRouter();
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<SelectAssetParams>();
  const { setSendAsset, setReceiveAsset, transferService } = useTransferFlow();
  const [searchText, setSearchText] = useState('');
  const searchInputRef = useRef<TextInput>(null);
  const flatListRef = useRef<FlatList>(null);

  const translateY = useSharedValue(screenHeight);
  const scrollOffset = useSharedValue(0);

  useEffect(() => {
    setSharedValue(translateY, withTiming(0, { duration: 300 }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const side = params.side || 'send';
  const showTestnets = useSetting('showTestnets');
  const allAssets = useMemo(() => {
    const assetSet = new Set<AssetId>();
    for (const pair of transferService.getSupportedPairs()) {
      assetSet.add(pair.sendAssetId);
      assetSet.add(pair.receiveAssetId);
    }
    const assets = Array.from(assetSet);
    if (showTestnets === 'ON') return assets;
    return assets.filter((assetId) => !getIsTestnet(getAssetInfo(assetId).network));
  }, [transferService, showTestnets]);

  const filteredAssets = useMemo(() => {
    if (!searchText.trim()) return allAssets;
    const query = searchText.toLowerCase();
    return allAssets.filter((assetId) => {
      const assetInfo = getAssetInfo(assetId);
      return assetInfo.name.toLowerCase().includes(query) || assetInfo.ticker.toLowerCase().includes(query) || assetInfo.networkDisplayName.toLowerCase().includes(query);
    });
  }, [allAssets, searchText]);

  const handleDismiss = useCallback(() => {
    router.back();
  }, [router]);

  const animateDismiss = useCallback(() => {
    setSharedValue(
      translateY,
      withTiming(screenHeight, { duration: 250 }, () => {
        runOnJS(handleDismiss)();
      })
    );
  }, [translateY, screenHeight, handleDismiss]);

  const handleSelectAsset = (asset: AssetId) => {
    if (side === 'send') {
      setSendAsset(asset);
    } else {
      setReceiveAsset(asset);
    }
    router.back();
  };

  const handleSearchContainerPress = () => {
    searchInputRef.current?.focus();
  };

  const nativeGesture = Gesture.Native();

  const panGesture = Gesture.Pan()
    .simultaneousWithExternalGesture(nativeGesture)
    .onUpdate((event) => {
      // Only allow dragging down when scrolled to top
      if (scrollOffset.value <= 0 && event.translationY > 0) {
        setSharedValue(translateY, event.translationY);
      }
    })
    .onEnd((event) => {
      if (event.translationY > DISMISS_THRESHOLD || event.velocityY > 1000) {
        runOnJS(animateDismiss)();
      } else {
        setSharedValue(translateY, withTiming(0, { duration: 200 }));
      }
    });

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - translateY.value / (screenHeight * 0.75),
  }));

  const renderItem = ({ item, index }: { item: AssetId; index: number }) => (
    <AssetListItem asset={item} onPress={() => handleSelectAsset(item)} isFirst={index === 0} isLast={index === filteredAssets.length - 1} testID={`TransferAsset-${item}`} />
  );

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <Animated.View style={[styles.overlay, overlayAnimatedStyle]}>
        <RNPressable style={styles.overlayTouchable} onPress={handleDismiss} />
      </Animated.View>
      <View style={styles.cardWrapper} pointerEvents="box-none">
        <View style={styles.cardSpacer} pointerEvents="none" />
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.card, cardAnimatedStyle]}>
            <View style={styles.grabber} />

            <View style={styles.container}>
              {/* Header */}
              <View style={styles.header}>
                <ThemedText style={styles.title}>Select</ThemedText>
                <Pressable style={styles.closeButton} onPress={handleDismiss} testID="SelectAssetCloseButton">
                  <Ionicons name="close" size={20} color="rgba(255, 255, 255, 0.8)" />
                </Pressable>
              </View>

              {/* Search Input */}
              <Pressable style={styles.searchContainer} onPress={handleSearchContainerPress} activeOpacity={1}>
                <Ionicons name="search" size={18} color="rgba(255, 255, 255, 0.4)" style={styles.searchIcon} />
                <TextInput
                  ref={searchInputRef}
                  style={styles.searchInput}
                  placeholder="Search"
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  value={searchText}
                  onChangeText={setSearchText}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                  testID="SelectAssetSearch"
                />
              </Pressable>

              {/* Asset List */}
              <GestureDetector gesture={nativeGesture}>
                <FlatList
                  ref={flatListRef}
                  data={filteredAssets}
                  renderItem={renderItem}
                  keyExtractor={(item) => item}
                  contentContainerStyle={[styles.listContent, { paddingBottom: 40 + insets.bottom }]}
                  ItemSeparatorComponent={() => <View style={styles.separator} />}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  onScroll={(e) => {
                    setSharedValue(scrollOffset, e.nativeEvent.contentOffset.y);
                  }}
                  scrollEventThrottle={16}
                  ListEmptyComponent={
                    <View style={styles.emptyState}>
                      <ThemedText style={styles.emptyText}>No assets found</ThemedText>
                    </View>
                  }
                />
              </GestureDetector>
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  overlayTouchable: {
    flex: 1,
  },
  cardWrapper: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
  },
  cardSpacer: {
    flex: 0.15,
  },
  card: {
    flex: 0.85,
    backgroundColor: 'rgba(50, 50, 50, 0.95)',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    overflow: 'hidden',
  },
  grabber: {
    width: 46,
    height: 5,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  container: {
    flex: 1,
    marginHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    fontWeight: '500',
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    padding: 0,
    margin: 0,
  },
  listContent: {
    gap: 2,
  },
  separator: {
    height: 2,
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
