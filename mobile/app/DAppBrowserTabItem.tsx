import React, { useEffect, useState } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import Pressable from '../components/Pressable';
import type { BrowserTab } from './DAppBrowser';

interface DAppBrowserTabItemProps {
  tab: BrowserTab;
  isVisible: boolean;
  onPress: () => void;
  onClose: () => void;
  onEnsurePreview: (forceReload?: boolean) => void;
}

export const DAppBrowserTabItem: React.FC<DAppBrowserTabItemProps> = ({ tab, isVisible, onPress, onClose, onEnsurePreview }) => {
  const [imageError, setImageError] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const getDomainName = (url: string): string => {
    try {
      const { hostname } = new URL(url);
      return hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  const getFaviconUrl = (url: string): string | null => {
    try {
      const domain = getDomainName(url);
      if (!domain) {
        return null;
      }
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    // Reset error state when screenshot changes
    if (tab.screenshot) {
      const timeout = setTimeout(() => {
        setImageError(false);
        setHasLoaded(false);
        setReloadToken((v) => v + 1);
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [tab.screenshot]);

  useEffect(() => {
    if (isVisible) {
      const timeout = setTimeout(() => {
        setImageError(false);
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [isVisible]);

  useEffect(() => {
    // Ensure preview is loaded for tabs without screenshots
    if (!tab.screenshot) {
      onEnsurePreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.screenshot, tab.id]);

  useEffect(() => {
    if (!tab.screenshot || imageError || hasLoaded) return;
    const timeout = setTimeout(() => {
      if (!hasLoaded) {
        setReloadToken((v) => v + 1);
      }
    }, 1500);
    return () => clearTimeout(timeout);
  }, [tab.screenshot, imageError, hasLoaded]);

  const faviconUrl = getFaviconUrl(tab.url);

  return (
    <Pressable style={styles.tabCard} onPress={onPress}>
      <View style={styles.tabCardHeader}>
        <View style={styles.tabCardTitleContainer}>
          <View style={styles.faviconWrapper}>
            {faviconUrl ? (
              <Image source={{ uri: faviconUrl }} style={styles.favicon} />
            ) : (
              <View style={styles.faviconFallback}>
                <ThemedText style={styles.faviconFallbackText}>{getDomainName(tab.url).charAt(0).toUpperCase()}</ThemedText>
              </View>
            )}
          </View>
        </View>
        <Pressable style={styles.tabCardCloseButton} onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={16} color="rgba(255, 255, 255, 0.8)" />
        </Pressable>
      </View>

      <View style={styles.tabCardPreview}>
        {tab.screenshot && !imageError ? (
          <Image
            key={`${tab.screenshot}-${tab.timestamp}-${reloadToken}`}
            source={{ uri: tab.screenshot }}
            style={styles.tabCardScreenshot}
            resizeMode="cover"
            onLoad={() => {
              setHasLoaded(true);
            }}
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
            {tab.title || getDomainName(tab.url) || 'Untitled Tab'}
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
  faviconWrapper: {
    width: 18,
    height: 18,
    borderRadius: 9,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favicon: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  faviconFallback: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  faviconFallbackText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  tabCardCloseButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
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
