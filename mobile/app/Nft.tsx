import React, { useCallback, useContext, useMemo } from 'react';
import Pressable from '../components/Pressable';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { MaterialIcons } from '@expo/vector-icons';

import RadialGradientScreen from '@/components/RadialGradientScreen';
import NftImage from '@/components/NftImage';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import { ThemedText } from '@/components/ThemedText';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getTokenIconColor } from '@shared/models/token-list';
import { NftInfo } from '@shared/types/token-info';
import { NETWORK_SPARK } from '@shared/types/networks';

export type NftScreenParams = {
  nft: string;
};

function truncateMiddle(value: string, head = 6, tail = 4) {
  if (!value) return value;
  if (value.length <= head + tail + 1) return value;
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function parseNftParam(nftParam: string): NftInfo | null {
  try {
    return JSON.parse(nftParam) as NftInfo;
  } catch (_) {
    return null;
  }
}

export default function Nft() {
  const params = useLocalSearchParams<NftScreenParams>();
  const { network } = useContext(NetworkContext);
  const router = useRouter();

  const nft = useMemo(() => parseNftParam(params.nft), [params.nft]);

  const title = useMemo(() => {
    if (!nft) return '';
    if (nft.name) return nft.name;
    const base = nft.collectionName || 'NFT';
    return nft.tokenId ? `${base}-#${nft.tokenId}` : base;
  }, [nft]);

  const buildExplorerUrl = useCallback(
    (nft: NftInfo) => {
      if (network === NETWORK_SPARK) return '';
      return `https://gamma.io/collections/${nft.contractAddress}/${nft.tokenId}`;
    },
    [network]
  );

  const description = useMemo(() => (nft as NftInfo | null)?.description ?? '', [nft]);

  const iconColor = useMemo(() => getTokenIconColor(nft?.name), [nft?.name]);

  const handleCopy = async (text?: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
  };

  const handleOpenInExplorer = () => {
    if (!nft) return;
    const url = buildExplorerUrl(nft);
    Linking.openURL(url);
  };

  const handleSend = () => {
    if (!nft) return;
    const sendParams: NftScreenParams = { nft: JSON.stringify(nft) };
    router.push({ pathname: '/SendNft', params: sendParams });
  };

  if (!nft) {
    return (
      <RadialGradientScreen network={network} scroll={true}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.root}>
          <ScreenHeader />
          <View style={styles.center}>
            <ThemedText style={styles.errorText}>NFT not found</ThemedText>
          </View>
        </View>
      </RadialGradientScreen>
    );
  }

  return (
    <RadialGradientScreen network={network} scroll={true}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.root}>
        <ScreenHeader />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.imageWrapper}>
            <View style={[styles.imageBg, { backgroundColor: iconColor }]}>{nft.image ? <NftImage source={{ uri: nft.image }} style={styles.image} resizeMode="cover" /> : null}</View>
          </View>

          <ThemedText style={styles.title} numberOfLines={2}>
            {title}
          </ThemedText>

          {description ? <ThemedText style={styles.description}>{description}</ThemedText> : null}

          <View style={styles.details}>
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Contract</ThemedText>
              <View style={styles.detailValueWrap}>
                <Pressable onPress={() => handleCopy(nft.contractAddress)} accessibilityLabel="Copy contract address">
                  <MaterialIcons name="content-copy" size={16} color="rgba(255, 255, 255, 0.8)" />
                </Pressable>
                <ThemedText style={styles.detailValue} numberOfLines={1} ellipsizeMode="middle">
                  {truncateMiddle(nft.contractAddress.split('.')[0], 7, 5)}
                </ThemedText>
              </View>
            </View>

            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Token ID</ThemedText>
              <View style={styles.detailValueWrap}>
                <Pressable onPress={() => handleCopy(nft.tokenId)} accessibilityLabel="Copy token id">
                  <MaterialIcons name="content-copy" size={16} color="rgba(255, 255, 255, 0.8)" />
                </Pressable>
                <ThemedText style={styles.detailValue}>{truncateMiddle(nft.tokenId, 7, 5)}</ThemedText>
              </View>
            </View>
          </View>

          {/* Spacer so content doesn't hide behind bottom button */}
          <View style={{ height: 90 }} />
        </ScrollView>

        <View style={styles.bottomButtonWrap}>
          <View style={styles.bottomButtonsRow}>
            <Pressable style={styles.actionButton} onPress={handleSend} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Send NFT">
              <MaterialIcons name="call-made" size={20} color="rgba(255, 255, 255, 0.95)" />
              <ThemedText style={styles.actionButtonText} numberOfLines={1}>
                Send
              </ThemedText>
            </Pressable>

            {buildExplorerUrl(nft) ? (
              <Pressable style={styles.actionButton} onPress={handleOpenInExplorer} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="View NFT on explorer">
                <ThemedText style={styles.actionButtonText} numberOfLines={1}>
                  View on explorer
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </RadialGradientScreen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 0,
  },
  imageWrapper: {
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  imageBg: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  title: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.95)',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  chip: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
  },
  description: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  details: {
    marginTop: 18,
    gap: 14,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.55)',
  },
  detailValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: '70%',
  },
  detailValue: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  bottomButtonWrap: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 22,
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.95)',
  },
});
