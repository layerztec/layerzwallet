import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { DAppBrowserTabItem } from './DAppBrowserTabItem';
import Pressable from '../components/Pressable';
import type { BrowserTab } from './DAppBrowser';

interface DAppBrowserTabsProps {
  tabs: BrowserTab[];
  animatedStyle: any;
  pointerEvents: 'auto' | 'none';
  isVisible: boolean;
  onSwitchTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onEnsurePreview: (tabId: string, forceReload?: boolean) => void | Promise<void>;
  onCloseOverview: () => void;
}

export const DAppBrowserTabs: React.FC<DAppBrowserTabsProps> = ({ tabs, animatedStyle, pointerEvents, isVisible, onSwitchTab, onCloseTab, onEnsurePreview, onCloseOverview }) => {
  const insets = useSafeAreaInsets();

  return (
    <Animated.View style={[styles.tabsOverviewContainer, animatedStyle, styles.tabsOverviewAbsolute]} pointerEvents={pointerEvents}>
      <SafeAreaView style={styles.tabsOverviewBackground} edges={['left', 'right']}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <ThemedText style={styles.title}>Tabs</ThemedText>
          <Pressable style={styles.headerMenuButton} onPress={onCloseOverview} testID="BrowserTabsCloseOverviewButton">
            <Ionicons name="close" size={24} color="rgba(255, 255, 255, 0.9)" />
          </Pressable>
        </View>
        <ScrollView style={styles.tabsOverviewContent} contentContainerStyle={[styles.tabsGridContainer, { paddingBottom: insets.bottom + 140 }]}>
          <View style={styles.tabsGrid}>
            {tabs.map((tab) => (
              <DAppBrowserTabItem
                key={`tab-card-${tab.id}`}
                tab={tab}
                isVisible={isVisible}
                onPress={() => {
                  onSwitchTab(tab.id);
                }}
                onClose={() => {
                  onCloseTab(tab.id);
                }}
                onEnsurePreview={(forceReload) => {
                  void onEnsurePreview(tab.id, forceReload);
                }}
              />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 42,
    color: 'rgba(255, 255, 255, 0.95)',
    letterSpacing: -0.6,
  },
  headerMenuButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.20)',
  },
  tabsOverviewContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
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
