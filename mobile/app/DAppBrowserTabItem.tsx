import React, { useEffect, useState } from 'react';
import { TouchableOpacity, View, Image, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';

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
  onEnsurePreview: () => void;
}

export const DAppBrowserTabItem: React.FC<DAppBrowserTabItemProps> = ({ tab, index, onPress, onClose, getTabTitle, onEnsurePreview }) => {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(tab.screenshot ? 'loaded' : 'loading');
  const [retryAttempts, setRetryAttempts] = useState(0);

  console.debug('[DAppBrowserTabItem] render', {
    tabId: tab.id,
    index,
    hasScreenshot: !!tab.screenshot,
    status,
    retryAttempts,
  });

  useEffect(() => {
    // If the component is told it has a screenshot, but its status is not 'loaded', sync it.
    if (tab.screenshot && status !== 'loaded') {
      console.debug('[DAppBrowserTabItem] Sync: Screenshot arrived, setting status to loaded', { tabId: tab.id });
      setStatus('loaded');
      setRetryAttempts(0);
    }
    // If the component is told it has no screenshot, but its status is 'loaded', it means the screenshot was removed.
    else if (!tab.screenshot && status === 'loaded') {
      console.debug('[DAppBrowserTabItem] Sync: Screenshot removed, setting status to loading', { tabId: tab.id });
      setStatus('loading');
    }
  }, [tab.screenshot, status, tab.id]);

  useEffect(() => {
    // This effect triggers the loading process
    if (status === 'loading') {
      console.debug('[DAppBrowserTabItem] Effect: Status is loading, ensuring preview.', { tabId: tab.id, index });
      onEnsurePreview();

      // Set a timeout to prevent indefinite loading state
      const timeout = setTimeout(() => {
        // Re-check inside timeout to avoid race conditions
        if (status === 'loading') {
          console.warn('[DAppBrowserTabItem] Screenshot load timeout', { tabId: tab.id });
          setStatus('error');
        }
      }, 10000); // 10 seconds

      return () => clearTimeout(timeout);
    }
  }, [status, tab.id, index, onEnsurePreview]);

  return (
    <TouchableOpacity style={styles.tabCard} onPress={onPress}>
      <View style={styles.tabCardHeader}>
        <View style={styles.tabCardTitleContainer}>
          <ThemedText style={styles.tabCardNumber}>#{index + 1}</ThemedText>
          <ThemedText style={styles.tabCardTitle} numberOfLines={1}>
            {tab.title}
          </ThemedText>
        </View>
        <TouchableOpacity style={styles.tabCardCloseButton} onPress={onClose}>
          <Ionicons name="close" size={16} color="rgba(255, 255, 255, 0.8)" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabCardPreview}>
        {status === 'loaded' && tab.screenshot ? (
          <Image
            key={tab.screenshot}
            source={{ uri: tab.screenshot }}
            style={styles.tabCardScreenshot}
            resizeMode="cover"
            onLoad={() => {
              // Already in 'loaded' state, but this confirms the image data is valid.
              console.debug('[DAppBrowserTabItem] Screenshot image loaded successfully', { tabId: tab.id });
              if (status !== 'loaded') setStatus('loaded');
            }}
            onError={(error) => {
              console.warn('[DAppBrowserTabItem] Failed to load screenshot URI', {
                tabId: tab.id,
                error: error.nativeEvent.error,
                retryAttempts,
              });
              setStatus('error');
            }}
          />
        ) : status === 'loading' ? (
          <View style={styles.loadingContainer}>
            <Ionicons name="hourglass-outline" size={48} color="rgba(255, 255, 255, 0.5)" />
            <Text style={styles.loadingText}>Loading preview...</Text>
          </View>
        ) : (
          // This covers 'error' status and any other edge cases
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="rgba(255, 255, 255, 0.4)" />
            <Text style={styles.errorText}>Preview unavailable</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                console.log('[DAppBrowserTabItem] Manual retry pressed', { tabId: tab.id });
                setStatus('loading');
                setRetryAttempts((prev) => prev + 1);
                onEnsurePreview();
              }}
            >
              <Ionicons name="refresh" size={16} color="white" />
              <Text style={styles.retryButtonText}>Tap to retry</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.tabCardUrlOverlay}>
          <ThemedText style={styles.tabCardUrlText} numberOfLines={1} ellipsizeMode="middle">
            {tab.url || 'Untitled Tab'}
          </ThemedText>
        </View>
      </View>
    </TouchableOpacity>
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
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
  },
  placeholderContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  placeholderText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    paddingHorizontal: 12,
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
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginTop: 8,
  },
  errorSubtext: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
    marginTop: 4,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
    marginTop: 12,
  },
  retryButtonText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
  },
});
