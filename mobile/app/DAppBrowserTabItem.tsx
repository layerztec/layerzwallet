import React from 'react';
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
  isActive: boolean;
  isDragging: boolean;
  isDraggedOver?: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onPressIn?: () => void;
  onClose: () => void;
  getTabTitle: (url: string) => string;
}

export const DAppBrowserTabItem: React.FC<DAppBrowserTabItemProps> = ({ tab, index, isActive, isDragging, isDraggedOver, onPress, onLongPress, onPressIn, onClose, getTabTitle }) => {
  return (
    <TouchableOpacity
      style={[styles.tabCard, isActive && styles.activeTabCard, isDragging && { opacity: 0.6 }, isDraggedOver && styles.draggedOverTabCard]}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={onPressIn}
      delayLongPress={500}
    >
      <View style={styles.tabCardHeader}>
        <View style={styles.tabCardTitleContainer}>
          <ThemedText style={styles.tabCardNumber}>#{index + 1}</ThemedText>
          <ThemedText style={styles.tabCardTitle} numberOfLines={1}>
            {tab.title}
          </ThemedText>
        </View>
        <TouchableOpacity style={styles.tabCardCloseButton} onPress={onClose} disabled={isDragging}>
          <Ionicons name="close" size={16} color={isDragging ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.8)'} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabCardPreview}>
        {tab.screenshot ? (
          <Image key={tab.screenshot} source={{ uri: tab.screenshot }} style={styles.tabCardScreenshot} resizeMode="cover" />
        ) : (
          <View style={styles.tabCardContent}>
            <Text style={styles.tabCardUrl} numberOfLines={2}>
              {tab.title || getTabTitle(tab.url)}\n{tab.url}
            </Text>
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
  draggedOverTabCard: {
    backgroundColor: 'rgba(255, 255, 0, 0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 0, 0.6)',
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
    backgroundColor: 'white',
    overflow: 'hidden',
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
});
