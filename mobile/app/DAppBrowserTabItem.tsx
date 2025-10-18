import React, { useState } from 'react';
import { TouchableOpacity, View, Image, Text, StyleSheet, ActivityIndicator } from 'react-native';
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
  needsScreenshotUpdate?: boolean;
  isCapturingScreenshot?: boolean;
}

interface DAppBrowserTabItemProps {
  tab: BrowserTab;
  index: number;
  isActive: boolean;
  onPress: () => void;
  onClose: () => void;
  getTabTitle: (url: string) => string;
}

export const DAppBrowserTabItem: React.FC<DAppBrowserTabItemProps> = ({ tab, index, isActive, onPress, onClose, getTabTitle }) => {
  const [imageError, setImageError] = useState(false);

  const showLoadingIndicator = !tab.screenshot && tab.isCapturingScreenshot;

  return (
    <TouchableOpacity style={[styles.tabCard, isActive && styles.activeTabCard]} onPress={onPress}>
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
        {tab.screenshot ? (
          <>
            <Image
              key={tab.screenshot}
              source={{ uri: tab.screenshot }}
              style={styles.tabCardScreenshot}
              resizeMode="cover"
              onError={(error) => {
                console.warn('[DAppBrowserTabItem] Failed to load screenshot for tab:', tab.id, error.nativeEvent.error);
                setImageError(true);
              }}
            />
            {imageError && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={32} color="rgba(255, 255, 255, 0.6)" />
                <Text style={styles.errorText}>Failed to load preview</Text>
              </View>
            )}
          </>
        ) : showLoadingIndicator ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="rgba(255, 255, 255, 0.8)" />
          </View>
        ) : (
          <View style={styles.placeholderContainer}>
            <Ionicons name="globe-outline" size={48} color="rgba(255, 255, 255, 0.3)" />
            <Text style={styles.placeholderText}>{getTabTitle(tab.url)}</Text>
          </View>
        )}
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
  activeTabCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
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
});
