import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import Pressable from '@/components/Pressable';
import { ThemedText } from '@/components/ThemedText';
import SectionContainer from '@/components/SectionContainer';
import { Image as ExpoImage } from 'expo-image';

import { getPartnersList } from '@shared/models/partners-list';
import type { PartnerInfo } from '@shared/types/partner-info';
import { getTokenIconColor, getTokenInfo } from '@shared/models/token-list';
import { YIELD_TOKEN_DEFINITIONS_BY_NETWORK } from '@shared/hooks/useYieldDiscovery';
import type { Networks } from '@shared/types/networks';
import { NETWORK_BITCOIN, NETWORK_BOTANIX, NETWORK_CITREA, NETWORK_ROOTSTOCK, NETWORK_LIGHTNING, NETWORK_SPARK, NETWORK_ARK } from '@shared/types/networks';
import type { TokenInfo } from '@shared/types/token-info';

export type ExplorerCategory = 'all' | 'bitcoin' | 'botanix' | 'rootstock' | 'citrea' | 'lightning' | 'spark' | 'arkade';

const getCategoryLabel = (category: ExplorerCategory): string => {
  switch (category) {
    case 'all':
      return 'All';
    case 'bitcoin':
      return 'Bitcoin';
    case 'lightning':
      return 'Lightning';
    case 'botanix':
      return 'Botanix';
    case 'rootstock':
      return 'Rootstock';
    case 'citrea':
      return 'Citrea';
    case 'spark':
      return 'Spark';
    case 'arkade':
      return 'Arkade';
    default:
      return 'Bitcoin';
  }
};

const getPartnersForCategory = (category: ExplorerCategory): PartnerInfo[] => {
  switch (category) {
    case 'bitcoin':
      return getPartnersList(NETWORK_BITCOIN);
    case 'botanix':
      return getPartnersList(NETWORK_BOTANIX);
    case 'rootstock':
      return getPartnersList(NETWORK_ROOTSTOCK);
    case 'citrea':
      return getPartnersList(NETWORK_CITREA);
    case 'lightning':
      return getPartnersList(NETWORK_LIGHTNING);
    case 'spark':
      return getPartnersList(NETWORK_SPARK);
    case 'arkade':
      return getPartnersList(NETWORK_ARK);
    case 'all':
      return [
        ...getPartnersForCategory('bitcoin'),
        ...getPartnersForCategory('botanix'),
        ...getPartnersForCategory('rootstock'),
        ...getPartnersForCategory('citrea'),
        ...getPartnersForCategory('lightning'),
        ...getPartnersForCategory('spark'),
        ...getPartnersForCategory('arkade'),
      ];
    default:
      return [];
  }
};

function shuffleArray<T>(input: readonly T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export type ExplorerContentProps = {
  category: ExplorerCategory;
  query: string;
  onChangeCategory: (category: ExplorerCategory) => void;
  onOpenWebApp: (url: string) => void;
};

export default function ExplorerContent({ category, query, onChangeCategory, onOpenWebApp }: ExplorerContentProps) {
  const router = useRouter();
  const basePartners = useMemo(() => {
    const partners = getPartnersForCategory(category);
    // "See all" should show a randomized ordering (only affects non-search view).
    return category === 'all' ? shuffleArray(partners) : partners;
  }, [category]);
  const allPartners = useMemo(
    () => [
      ...getPartnersList(NETWORK_BITCOIN),
      ...getPartnersList(NETWORK_BOTANIX),
      ...getPartnersList(NETWORK_ROOTSTOCK),
      ...getPartnersList(NETWORK_CITREA),
      ...getPartnersList(NETWORK_LIGHTNING),
      ...getPartnersList(NETWORK_SPARK),
      ...getPartnersList(NETWORK_ARK),
    ],
    []
  );

  const filteredPartners = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return basePartners;
    return allPartners.filter((p) => {
      const haystack = `${p.name} ${p.description ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [allPartners, basePartners, query]);

  // Highlight is random and must not depend on category/pill.
  // Only partners with a `highlight` image are eligible.
  const highlightCandidates = useMemo(() => allPartners.filter((p) => !!p.highlight), [allPartners]);
  const highlightPartner = useMemo(() => {
    if (highlightCandidates.length === 0) return null;
    if (highlightCandidates.length === 1) return highlightCandidates[0] ?? null;
    const idx = Math.floor(Math.random() * highlightCandidates.length);
    return highlightCandidates[idx] ?? null;
  }, [highlightCandidates]);
  const highlightImageUri = highlightPartner?.highlight ?? null;

  const availableEarnItems = useMemo(() => {
    const entries = Object.entries(YIELD_TOKEN_DEFINITIONS_BY_NETWORK) as [Networks, { tokenId: string; apr: string; url: string }[]][];
    const items: { token: TokenInfo; apr: string; url: string }[] = [];

    for (const [network, defs] of entries) {
      // Currently MVP yields are stored per network in the shared hook.
      // We still surface them here as “available”.
      for (const def of defs) {
        try {
          const token = getTokenInfo(def.tokenId);
          items.push({ token, apr: def.apr, url: def.url });
        } catch {
          // If token info is missing from the token list, skip it.
          continue;
        }
      }
    }

    return items;
  }, []);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.sectionGap}>
        <SectionContainer title="Earn" onViewAll={() => router.push('/YieldList')}>
          <View style={styles.earnList}>
            {availableEarnItems.slice(0, 3).map((item) => (
              <View key={item.token.id} style={styles.earnRow}>
                <View style={[styles.earnTokenIconWrap, { backgroundColor: getTokenIconColor(item.token.name) }]}>
                  {item.token.logoURI ? (
                    <ExpoImage source={{ uri: item.token.logoURI }} style={styles.earnTokenIcon} contentFit="cover" />
                  ) : (
                    <ThemedText style={styles.earnTokenIconText}>{item.token.symbol?.charAt(0) || '?'}</ThemedText>
                  )}
                </View>
                <View style={styles.earnRowInfo}>
                  <ThemedText style={styles.earnTokenSymbol}>{item.token.symbol}</ThemedText>
                </View>
                <ThemedText style={styles.earnUpToText} numberOfLines={1}>
                  up to {item.apr}
                </ThemedText>
              </View>
            ))}
          </View>
        </SectionContainer>
      </View>

      <View style={styles.sectionGap}>
        <SectionContainer title="Highlight" contentStyle={{ paddingVertical: 0 }}>
          <Pressable
            style={styles.highlightCard}
            disabled={!highlightPartner?.url}
            onPress={() => {
              if (!highlightPartner?.url) return;
              onOpenWebApp(highlightPartner.url);
            }}
            activeOpacity={0.9}
          >
            <View style={styles.highlightMap}>
              {highlightImageUri && <ExpoImage source={{ uri: highlightImageUri }} style={styles.highlightBackgroundImage} contentFit="cover" />}
              <View style={styles.highlightGrid} />
              <View style={styles.highlightOverlay}>
                <ThemedText style={styles.highlightTitle}>{highlightPartner?.name ?? 'Explore partners'}</ThemedText>
                <ThemedText style={styles.highlightDescription} numberOfLines={2}>
                  {highlightPartner?.description ?? 'Discover services and apps across networks.'}
                </ThemedText>
              </View>
            </View>
          </Pressable>
        </SectionContainer>
      </View>

      <View style={styles.sectionGap}>
        <ThemedText style={styles.bitcoinAppsTitle}>Bitcoin apps</ThemedText>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsRow}>
          {(
            [
              { key: 'all', label: 'See all' },
              { key: 'bitcoin', label: 'Bitcoin' },
              { key: 'lightning', label: 'Lightning' },
              { key: 'botanix', label: 'Botanix' },
              { key: 'rootstock', label: 'Rootstock' },
              { key: 'citrea', label: 'Citrea' },
              { key: 'spark', label: 'Spark' },
              { key: 'arkade', label: 'Arkade' },
            ] as const
          ).map((c) => (
            <Pressable key={c.key} onPress={() => onChangeCategory(c.key)} style={[styles.chip, c.key === category ? styles.chipSelected : styles.chipUnselected]} hitSlop={8} activeOpacity={0.85}>
              <ThemedText style={[styles.chipText, c.key === category ? styles.chipTextSelected : styles.chipTextUnselected]}>{c.label}</ThemedText>
            </Pressable>
          ))}
        </ScrollView>

        {filteredPartners.length === 0 ? (
          <View style={styles.emptyState}>
            <ThemedText style={styles.emptyStateText}>{query.trim() ? `No results for "${query.trim()}".` : `No partners found for ${getCategoryLabel(category)}.`}</ThemedText>
          </View>
        ) : (
          <View style={styles.appsList}>
            {filteredPartners.map((p) => (
              <Pressable key={p.url} onPress={() => onOpenWebApp(p.url)} style={styles.appCard} activeOpacity={0.85}>
                <View style={styles.appIconWrap}>{p.imgUrl ? <ExpoImage source={{ uri: p.imgUrl }} style={styles.appIcon} contentFit="cover" /> : <View style={styles.appIconPlaceholder} />}</View>

                <View style={styles.appInfo}>
                  <ThemedText style={styles.appName} numberOfLines={1}>
                    {p.name}
                  </ThemedText>
                  {p.description ? (
                    <ThemedText style={styles.appDescription} numberOfLines={2}>
                      {p.description}
                    </ThemedText>
                  ) : (
                    <View style={{ height: 18 }} />
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#000',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 60,
    paddingTop: 12,
  },
  sectionGap: {
    marginBottom: 18,
  },
  highlightCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  highlightMap: {
    height: 200,
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
  },
  highlightBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 1,
    zIndex: 0,
  },
  highlightGrid: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.05)',
    opacity: 0.18,
    zIndex: 1,
  },
  highlightOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 2,
    elevation: 2,
  },
  highlightTitle: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 16,
    fontWeight: '600',
  },
  highlightDescription: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '400',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 10,
    paddingRight: 0,
    paddingLeft: 0,
    minWidth: '100%',
  },
  chipsScroll: {
    flexGrow: 1,
    width: '100%',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 0,
  },
  chipSelected: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  chipUnselected: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: 'rgba(255,255,255,0.95)',
  },
  chipTextUnselected: {
    color: 'rgba(255,255,255,0.7)',
  },
  emptyState: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    textAlign: 'center',
  },
  appsList: {
    gap: 12,
  },
  appCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  appIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appIcon: {
    width: '100%',
    height: '100%',
  },
  appIconPlaceholder: {
    width: '70%',
    height: '70%',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  appInfo: {
    flex: 1,
  },
  appName: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 15,
    fontWeight: '600',
  },
  appDescription: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '400',
  },
  bitcoinAppsTitle: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 10,
  },
  earnList: {
    gap: 8,
  },
  earnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 10,
  },
  earnTokenIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 40,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  earnTokenIcon: {
    width: '100%',
    height: '100%',
  },
  earnTokenIconText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  earnRowInfo: {
    flex: 1,
  },
  earnTokenSymbol: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 14,
    fontWeight: '600',
  },
  earnUpToText: {
    color: '#00ff6e',
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 120,
  },
});
