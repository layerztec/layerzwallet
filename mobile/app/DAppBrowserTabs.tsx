import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { ThemedText } from '@/components/ThemedText';
import { DAppBrowserTabItem } from './DAppBrowserTabItem';

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

interface DAppBrowserTabsProps {
  tabs: BrowserTab[];
  activeTabId: string;
  draggingTabId: string | null;
  draggedOverIndex: number | null;
  animatedStyle: any;
  pointerEvents: 'auto' | 'none';
  onSwitchTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onStartDrag: (tabId: string) => void;
  onDragOver: (index: number | null) => void;
  onReorderTabs: (fromIndex: number, toIndex: number) => void;
  onDragEnd: () => void;
  getTabTitle: (url: string) => string;
}

export const DAppBrowserTabs: React.FC<DAppBrowserTabsProps> = ({
  tabs,
  activeTabId,
  draggingTabId,
  draggedOverIndex,
  animatedStyle,
  pointerEvents,
  onSwitchTab,
  onCloseTab,
  onStartDrag,
  onDragOver,
  onReorderTabs,
  onDragEnd,
  getTabTitle,
}) => {
  const handleDragEnd = () => {
    if (draggingTabId !== null && draggedOverIndex !== null) {
      const fromIndex = tabs.findIndex((tab) => tab.id === draggingTabId);
      if (fromIndex !== -1 && fromIndex !== draggedOverIndex) {
        onReorderTabs(fromIndex, draggedOverIndex);
      }
    }
    onDragEnd();
  };
  return (
    <Animated.View style={[styles.tabsOverviewContainer, animatedStyle, styles.tabsOverviewAbsolute]} pointerEvents={pointerEvents}>
      <View style={styles.tabsOverviewBackground}>
        <View style={styles.tabsOverviewHeader}>
          <ThemedText style={styles.tabsOverviewTitle}>Tabs</ThemedText>
        </View>

        <ScrollView style={styles.tabsOverviewContent} contentContainerStyle={styles.tabsGridContainer}>
          <View style={styles.tabsGrid}>
            {tabs.map((tab, index) => (
              <DAppBrowserTabItem
                key={`tab-card-${tab.id}`}
                tab={tab}
                index={index}
                isActive={activeTabId === tab.id}
                isDragging={draggingTabId === tab.id}
                isDraggedOver={draggedOverIndex === index}
                onPress={() => {
                  if (draggingTabId === null) {
                    onSwitchTab(tab.id);
                  } else {
                    onDragOver(index);
                    handleDragEnd();
                  }
                }}
                onLongPress={() => onStartDrag(tab.id)}
                onPressIn={() => {
                  if (draggingTabId !== null && draggingTabId !== tab.id) {
                    onDragOver(index);
                  }
                }}
                onClose={() => onCloseTab(tab.id)}
                getTabTitle={getTabTitle}
              />
            ))}
          </View>
        </ScrollView>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  tabsOverviewContainer: {
    flex: 1,
  },
  tabsOverviewAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  tabsOverviewBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  tabsOverviewHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 60,
  },
  tabsOverviewTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  tabsOverviewContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  tabsGridContainer: {
    paddingBottom: 20,
  },
  tabsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
});
