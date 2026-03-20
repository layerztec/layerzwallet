import React, { useMemo, useState, useContext, useCallback } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';

import Pressable from '@/components/Pressable';
import { ThemedText } from '@/components/ThemedText';
import RadialGradientScreen from '@/components/RadialGradientScreen';
import YieldView from '@/components/YieldView';
import SectionContainer from '@/components/SectionContainer';

import { useRouter } from 'expo-router';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { NETWORK_BITCOIN, NETWORK_CITREA } from '@shared/types/networks';
import { getPartnersList } from '@shared/models/partners-list';
import type { PartnerInfo } from '@shared/types/partner-info';

type ExplorerCategory = 'all' | 'bitcoin' | 'lightning' | 'arkade' | 'citrea';

const getCategoryLabel = (category: ExplorerCategory): string => {
  switch (category) {
    case 'all':
      return 'All';
    case 'bitcoin':
      return 'Bitcoin';
    case 'lightning':
      return 'Lightning';
    case 'arkade':
      return 'Arkade';
    case 'citrea':
      return 'Citrea';
    default:
      return 'Bitcoin';
  }
};

const getPartnersForCategory = (category: ExplorerCategory): PartnerInfo[] => {
  switch (category) {
    case 'bitcoin':
      return getPartnersList(NETWORK_BITCOIN);
    // MVP: show the same partner set as bitcoin (matches explore website behavior for `network=lightning`)
    case 'lightning':
      return getPartnersList(NETWORK_BITCOIN);
    case 'arkade':
      return [];
    case 'citrea':
      return getPartnersList(NETWORK_CITREA);
    case 'all':
      return [...getPartnersForCategory('bitcoin'), ...getPartnersForCategory('citrea')];
    default:
      return [];
  }
};

export type ExplorerViewProps = {
  onBackToBrowser: () => void;
  onOpenWebApp: (url: string) => void;
};

export default function ExplorerView({ onBackToBrowser, onOpenWebApp }: ExplorerViewProps) {
  const router = useRouter();
  const { network } = useContext(NetworkContext);

  const [category, setCategory] = useState<ExplorerCategory>('bitcoin');
  const [query, setQuery] = useState<string>('');
  const [isFocused, setIsFocused] = useState(false);

  const basePartners = useMemo(() => getPartnersForCategory(category), [category]);

  const filteredPartners = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return basePartners;
    return basePartners.filter((p) => {
      const haystack = `${p.name} ${p.description ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [basePartners, query]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return filteredPartners.slice(0, 6);
  }, [filteredPartners, query]);

  const highlightPartner = filteredPartners[0] ?? basePartners[0] ?? null;

  const openFirstSuggestion = useCallback(() => {
    const first = suggestions[0] ?? filteredPartners[0];
    if (!first) return;
    onOpenWebApp(first.url);
  }, [filteredPartners, onOpenWebApp, suggestions]);

  const handleSubmitEditing = useCallback(() => {
    openFirstSuggestion();
  }, [openFirstSuggestion]);

  return (
    <RadialGradientScreen network={network} scroll={true}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Pressable style={styles.iconButton} onPress={onBackToBrowser} hitSlop={10}>
            <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.9)" />
          </Pressable>

          <Pressable style={styles.iconButton} onPress={() => router.replace('/Home')} hitSlop={10}>
            <Ionicons name="home" size={20} color="rgba(255,255,255,0.9)" />
          </Pressable>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder={`Search on ${getCategoryLabel(category)}...`}
              placeholderTextColor="rgba(255,255,255,0.45)"
              value={query}
              onChangeText={(t) => setQuery(t)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              returnKeyType="go"
              keyboardType="default"
              autoCorrect={false}
              autoCapitalize="none"
              onSubmitEditing={handleSubmitEditing}
              testID="ExplorerSearchInput"
            />

            <View style={styles.searchIconSpacer} />
          </View>

          <Pressable style={styles.iconButton} onPress={() => {}} hitSlop={10} testID="ExplorerOptionsButton">
            <Ionicons name="ellipsis-vertical" size={20} color="rgba(255,255,255,0.7)" />
          </Pressable>
        </View>

        {isFocused && suggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            {suggestions.map((p) => (
              <Pressable
                key={p.url}
                style={styles.suggestionItem}
                onPress={() => {
                  setIsFocused(false);
                  setQuery(p.name);
                  onOpenWebApp(p.url);
                }}
                activeOpacity={0.7}
              >
                <ThemedText style={styles.suggestionText} numberOfLines={1}>
                  {p.name}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.sections}>
          <View style={styles.sectionGap}>
            <YieldView
              onYieldPress={(_token) => {
                router.push('/YieldList');
              }}
            />
          </View>

          <View style={styles.sectionGap}>
            <SectionContainer title="Highlight">
              <View style={styles.highlightCard}>
                <View style={styles.highlightMap}>
                  <View style={styles.highlightGrid} />
                  <View style={styles.highlightOverlay}>
                    <ThemedText style={styles.highlightTitle}>{highlightPartner?.name ?? 'Explore partners'}</ThemedText>
                    {highlightPartner?.description ? (
                      <ThemedText style={styles.highlightDescription} numberOfLines={2}>
                        {highlightPartner.description}
                      </ThemedText>
                    ) : (
                      <ThemedText style={styles.highlightDescription} numberOfLines={2}>
                        Discover services and apps across networks.
                      </ThemedText>
                    )}
                  </View>
                </View>
              </View>
            </SectionContainer>
          </View>

          <View style={styles.sectionGap}>
            <SectionContainer title="Bitcoin apps">
              <View style={styles.chipsRow}>
                {(
                  [
                    { key: 'all', label: 'See all' },
                    { key: 'bitcoin', label: 'Bitcoin' },
                    { key: 'lightning', label: 'Lightning' },
                    { key: 'arkade', label: 'Arkade' },
                    { key: 'citrea', label: 'Citrea' },
                  ] as const
                ).map((c) => (
                  <Pressable key={c.key} onPress={() => setCategory(c.key)} style={[styles.chip, c.key === category ? styles.chipSelected : styles.chipUnselected]} hitSlop={8} activeOpacity={0.85}>
                    <ThemedText style={[styles.chipText, c.key === category ? styles.chipTextSelected : styles.chipTextUnselected]}>{c.label}</ThemedText>
                  </Pressable>
                ))}
              </View>

              {filteredPartners.length === 0 ? (
                <View style={styles.emptyState}>
                  <ThemedText style={styles.emptyStateText}>No partners found for {getCategoryLabel(category)}.</ThemedText>
                </View>
              ) : (
                <View style={styles.appsList}>
                  {filteredPartners.map((p) => (
                    <Pressable key={p.url} onPress={() => onOpenWebApp(p.url)} style={styles.appCard} activeOpacity={0.85}>
                      <View style={styles.appIconWrap}>
                        {p.imgUrl ? <ExpoImage source={{ uri: p.imgUrl }} style={styles.appIcon} contentFit="cover" /> : <View style={styles.appIconPlaceholder} />}
                      </View>

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
            </SectionContainer>
          </View>
        </View>
      </View>
    </RadialGradientScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255,255,255,0.92)',
    paddingVertical: 0,
  },
  searchIconSpacer: {
    width: 1,
  },
  suggestionsContainer: {
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.75)',
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  suggestionText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    fontWeight: '500',
  },
  sections: {
    marginTop: 12,
    paddingHorizontal: 14,
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
    height: 130,
    backgroundColor: 'rgba(0,0,0,0.35)',
    position: 'relative',
  },
  highlightGrid: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.05)',
    opacity: 0.18,
  },
  highlightOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
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
    gap: 8,
    flexWrap: 'wrap',
    paddingBottom: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipSelected: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.25)',
  },
  chipUnselected: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
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
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  appIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.07)',
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
});
