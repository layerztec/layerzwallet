import React, { useEffect, useState } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { BROWSER_CONSTANTS } from './DAppBrowser';
import Pressable from '@/components/Pressable';

interface BrowserTab {
  id: string;
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  history: { url: string; title: string }[];
  historyIndex: number;
  screenshot?: string;
  timestamp: number;
}

interface DAppBrowserTabItemProps {
  tab: BrowserTab;
  index: number;
  onPress: () => void;
  onClose: () => void;
  getTabTitle: (url: string) => string;
  onEnsurePreview: (forceReload?: boolean) => void;
}

export const DAppBrowserTabItem: React.FC<DAppBrowserTabItemProps> = ({ tab, index, onPress, onClose, onEnsurePreview }) => {
  const [imageError, setImageError] = useState(false);

  const getDomainName = (url: string): string => {
    try {
      const { hostname } = new URL(url);
      return hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  useEffect(() => {
    // Reset error state when screenshot changes
    if (tab.screenshot) {
      setImageError(false);
    }
  }, [tab.screenshot]);

  useEffect(() => {
    // Ensure preview is loaded for tabs without screenshots
    if (!tab.screenshot) {
      onEnsurePreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.screenshot, tab.id]);

  return (
    <Pressable style={styles.tabCard} onPress={onPress}>
      <View style={styles.tabCardHeader}>
        <View style={styles.tabCardTitleContainer}>
          <ThemedText style={styles.tabCardNumber}>#{index + 1}</ThemedText>
          <ThemedText style={styles.tabCardTitle} numberOfLines={1}>
            {tab.title}
          </ThemedText>
        </View>
        <Pressable style={styles.tabCardCloseButton} onPress={onClose}>
          <Ionicons name="close" size={16} color="rgba(255, 255, 255, 0.8)" />
        </Pressable>
      </View>

      <View style={styles.tabCardPreview}>
        {tab.screenshot && !imageError ? (
          <Image
            key={tab.screenshot}
            source={{ uri: tab.screenshot }}
            style={styles.tabCardScreenshot}
            resizeMode="cover"
            onError={() => {
              setImageError(true);
              // Try to reload from storage if the screenshot URI is invalid
              onEnsurePreview(true);
            }}
          />
        ) : (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderText}>{getDomainName(tab.url)}</Text>
          </View>
        )}
        <View style={styles.tabCardUrlOverlay}>
          <ThemedText style={styles.tabCardUrlText} numberOfLines={1} ellipsizeMode="middle">
            {tab.url || 'Untitled Tab'}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  tabCard: {
    width: '45%',
    aspectRatio: 0.7,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  tabCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  tabCardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  tabCardNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.6)',
    marginRight: 6,
  },
  tabCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    flex: 1,
  },
  tabCardCloseButton: {
    padding: 4,
  },
  tabCardPreview: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    overflow: 'hidden',
    position: 'relative',
  },
  tabCardScreenshot: {
    width: '100%',
    height: '100%',
  },
  tabCardContent: {
    flex: 1,
    padding: 12,
  },
  tabCardUrl: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  placeholderContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  tabCardUrlOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tabCardUrlText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
  },
});
