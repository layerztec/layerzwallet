import React, { useCallback, useRef } from 'react';
import { View, ScrollView, StyleSheet, Platform, ActionSheetIOS, UIManager, findNodeHandle } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { DAppBrowserTabItem } from './DAppBrowserTabItem';
import Pressable from '../components/Pressable';

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
  isVisible: boolean;
  onSwitchTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  getTabTitle: (url: string) => string;
  onEnsurePreview: (tabId: string, forceReload?: boolean) => void | Promise<void>;
  onInvalidatePreview: (tabId: string) => void;
  onCloseAllTabs: () => void;
}

export const DAppBrowserTabs: React.FC<DAppBrowserTabsProps> = ({
  tabs,
  animatedStyle,
  pointerEvents,
  isVisible,
  onSwitchTab,
  onCloseTab,
  getTabTitle,
  onEnsurePreview,
  onInvalidatePreview,
  onCloseAllTabs,
}) => {
  const insets = useSafeAreaInsets();
  const menuAnchorRef = useRef<View>(null);

  const openTabsMenu = useCallback(() => {
    const node = findNodeHandle(menuAnchorRef.current);
    const popup = (UIManager as any).showPopupMenu as undefined | ((reactTag: number, items: string[], error: () => void, success: (eventName: string, index?: number) => void) => void);

    if (node && typeof popup === 'function') {
      popup(
        node,
        ['Close all tabs'],
        () => {},
        (eventName: string, index?: number) => {
          if (eventName !== 'itemSelected') return;
          if (index === 0) onCloseAllTabs();
        }
      );
      return;
    }

    // Fallback (should be rare): use system action sheet if popup menu isn't available.
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Close all tabs'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 1,
          userInterfaceStyle: 'dark',
        },
        (buttonIndex) => {
          if (buttonIndex === 1) onCloseAllTabs();
        }
      );
    }
  }, [onCloseAllTabs]);

  return (
    <Animated.View style={[styles.tabsOverviewContainer, animatedStyle, styles.tabsOverviewAbsolute]} pointerEvents={pointerEvents}>
      <SafeAreaView style={styles.tabsOverviewBackground} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Tabs</ThemedText>
          <Pressable ref={menuAnchorRef} style={styles.headerMenuButton} onPress={openTabsMenu} testID="BrowserTabsOverflowButton">
            <Ionicons name="ellipsis-horizontal" size={22} color="rgba(255, 255, 255, 0.9)" />
          </Pressable>
        </View>
        <ScrollView style={styles.tabsOverviewContent} contentContainerStyle={[styles.tabsGridContainer, { paddingBottom: insets.bottom + 140 }]}>
          <View style={styles.tabsGrid}>
            {tabs.map((tab, index) => (
              <DAppBrowserTabItem
                key={`tab-card-${tab.id}`}
                tab={tab}
                index={index}
                isVisible={isVisible}
                onPress={() => {
                  onSwitchTab(tab.id);
                }}
                onClose={() => {
                  onCloseTab(tab.id);
                }}
                getTabTitle={getTabTitle}
                onEnsurePreview={(forceReload) => {
                  void onEnsurePreview(tab.id, forceReload);
                }}
                onInvalidatePreview={() => {
                  onInvalidatePreview(tab.id);
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
