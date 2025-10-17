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
  needsScreenshotUpdate?: boolean;
  isCapturingScreenshot?: boolean;
}

interface DAppBrowserTabsProps {
  tabs: BrowserTab[];
  activeTabId: string;
  animatedStyle: any;
  pointerEvents: 'auto' | 'none';
  onSwitchTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  getTabTitle: (url: string) => string;
}

export const DAppBrowserTabs: React.FC<DAppBrowserTabsProps> = ({ tabs, activeTabId, animatedStyle, pointerEvents, onSwitchTab, onCloseTab, getTabTitle }) => {
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
                onPress={() => onSwitchTab(tab.id)}
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
