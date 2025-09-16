import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import * as Linking from 'expo-linking';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Alert, TextInput, ScrollView, Animated } from 'react-native';
import WebView, { WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import GradientScreen from '@/components/GradientScreen';
import { BrowserBridge } from '@/src/class/browser-bridge';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { NetworkContext } from '@shared/hooks/NetworkContext';

export type DappBrowserProps = {
  url?: string;
};

interface BrowserTab {
  id: string;
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
}

const DAppBrowser: React.FC = () => {
  const { network } = useContext(NetworkContext);
  const router = useRouter();
  const webviewRef = useRef<WebView>(null);
  const browserBridgeRef = useRef<BrowserBridge>(null);
  const [js, setJs] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const params = useLocalSearchParams<DappBrowserProps>();
  const initialUrl = params.url || 'https://layerztec.github.io/website/explore/?network=' + network;

  // Tab management state
  const [tabs, setTabs] = useState<BrowserTab[]>([
    {
      id: '1',
      url: initialUrl,
      title: 'site-url.com',
      canGoBack: false,
      canGoForward: false,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('1');
  const [addressInput, setAddressInput] = useState<string>(initialUrl);
  const [showTabsOverview, setShowTabsOverview] = useState<boolean>(false);

  // Animation values for crossfade and address bar
  const webviewOpacity = useRef(new Animated.Value(1)).current;
  const tabsOpacity = useRef(new Animated.Value(0)).current;
  const addressBarTranslateY = useRef(new Animated.Value(0)).current;

  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const currentUrl = activeTab?.url || initialUrl;

  useEffect(() => {
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const [{ localUri }] = await Asset.loadAsync(require('assets/js/inpage-bridge.jstxt'));
        const file = new File(localUri || '');
        const r = await file.text();
        setJs(r);
      } catch (error: any) {
        setError('Failed to load DApp browser script: ' + error.message);
      }
    })();
  }, []);

  const callbackRef = useCallback((r: WebView | null) => {
    if (r === null) {
      return;
    }
    webviewRef.current = r;
    browserBridgeRef.current = new BrowserBridge(r);

    return () => {
      BrowserBridge.instance = null;
    };
  }, []);

  // Tab management functions
  const createNewTab = () => {
    const newTab: BrowserTab = {
      id: Date.now().toString(),
      url: 'https://layerztec.github.io/website/explore/?network=' + network,
      title: 'site-url.com',
      canGoBack: false,
      canGoForward: false,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setAddressInput(newTab.url);
  };

  const closeTab = (tabId: string) => {
    if (tabs.length === 1) {
      // Don't close the last tab, just navigate to home
      const homeUrl = 'https://layerztec.github.io/website/explore/?network=' + network;
      updateActiveTab({ url: homeUrl, title: 'site-url.com' });
      setAddressInput(homeUrl);
      return;
    }

    const newTabs = tabs.filter((tab) => tab.id !== tabId);
    setTabs(newTabs);

    if (activeTabId === tabId) {
      // Switch to the last tab if closing active tab
      const newActiveTab = newTabs[newTabs.length - 1];
      setActiveTabId(newActiveTab.id);
      setAddressInput(newActiveTab.url);
    }
  };

  const switchTab = (tabId: string) => {
    setActiveTabId(tabId);
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) {
      setAddressInput(tab.url);
      // Navigate the webview to the tab's URL
      webviewRef.current?.injectJavaScript(`window.location.href = '${tab.url}';`);
    }
    hideTabsOverview(); // Hide tabs overview after switching
  };

  const showTabsOverviewAnimated = () => {
    setShowTabsOverview(true);
    Animated.parallel([
      Animated.timing(webviewOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(tabsOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(addressBarTranslateY, {
        toValue: -80, // Slide up out of view
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const hideTabsOverview = () => {
    Animated.parallel([
      Animated.timing(webviewOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(tabsOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(addressBarTranslateY, {
        toValue: 0, // Slide back down
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowTabsOverview(false);
    });
  };

  const updateActiveTab = (updates: Partial<BrowserTab>) => {
    setTabs((prev) => prev.map((tab) => (tab.id === activeTabId ? { ...tab, ...updates } : tab)));
  };

  const getTabTitle = (url: string): string => {
    try {
      const { hostname } = new URL(url);
      return hostname.replace('www.', '');
    } catch {
      return 'site-url.com';
    }
  };

  const refresh = () => {
    browserBridgeRef.current?.refresh();
  };

  const goBack = () => {
    webviewRef.current?.goBack();
  };

  const goForward = () => {
    webviewRef.current?.goForward();
  };

  const unwhitelistCurrentDapp = async () => {
    try {
      const { hostname } = new URL(currentUrl);
      await BackgroundExecutor.unwhitelistDapp(hostname);
      refresh();
    } catch (error) {
      Alert.alert('Error', 'Failed to unwhitelist dapp');
    }
  };

  const openInExternalBrowser = () => {
    Linking.openURL(currentUrl);
  };

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    browserBridgeRef.current?.handleMessage(event);
  }, []);

  const handleNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      const title = getTabTitle(navState.url);
      updateActiveTab({
        url: navState.url,
        title,
        canGoBack: navState.canGoBack,
        canGoForward: navState.canGoForward,
      });
      setAddressInput(navState.url);
    },
    [activeTabId]
  );

  const navigateToAddress = () => {
    let url = addressInput.trim();

    // Add https:// if no protocol is specified
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    try {
      // Validate URL
      new URL(url);
      webviewRef.current?.injectJavaScript(`window.location.href = '${url}';`);
    } catch (error) {
      Alert.alert('Invalid URL', 'Please enter a valid URL');
    }
  };

  const handleAddressSubmit = () => {
    navigateToAddress();
  };

  if (error) {
    return (
      <GradientScreen variant={network}>
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      </GradientScreen>
    );
  }

  if (!js) {
    return (
      <GradientScreen variant={network}>
        <View style={styles.loadingContainer}>
          <ThemedText style={styles.loadingText}>Loading DApp browser...</ThemedText>
        </View>
      </GradientScreen>
    );
  }

  return (
    <GradientScreen variant={network}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Address Bar with Animation */}
      <Animated.View
        style={[
          styles.addressContainer,
          {
            transform: [{ translateY: addressBarTranslateY }],
          },
        ]}
      >
        <TextInput
          style={styles.addressInput}
          value={addressInput}
          onChangeText={setAddressInput}
          onSubmitEditing={handleAddressSubmit}
          placeholder="Enter URL..."
          placeholderTextColor="rgba(255, 255, 255, 0.6)"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          testID="DappBrowserAddressBar"
          returnKeyType="go"
        />
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <Ionicons name="close" size={20} color="rgba(255, 255, 255, 0.9)" />
        </TouchableOpacity>
      </Animated.View>

      {/* Main Content Container with Crossfade Animation */}
      <View style={styles.contentContainer}>
        {/* WebView */}
        <Animated.View
          style={[
            styles.webviewContainer,
            {
              opacity: webviewOpacity,
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            },
          ]}
        >
          <WebView
            ref={callbackRef}
            originWhitelist={['https://*', 'http://*', 'about:blank', 'about:srcdoc']}
            allowsInlineMediaPlayback={true}
            source={{ uri: currentUrl }}
            onMessage={handleMessage}
            onNavigationStateChange={handleNavigationStateChange}
            injectedJavaScriptBeforeContentLoaded={js}
            webviewDebuggingEnabled={true}
          />
        </Animated.View>

        {/* Tabs Overview with Crossfade */}
        <Animated.View
          style={[
            styles.tabsOverviewContainer,
            {
              opacity: tabsOpacity,
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            },
          ]}
          pointerEvents={showTabsOverview ? 'auto' : 'none'}
        >
          <View style={styles.tabsOverviewBackground}>
            <View style={styles.tabsOverviewHeader}>
              <ThemedText style={styles.tabsOverviewTitle}>Tabs</ThemedText>
              <TouchableOpacity onPress={hideTabsOverview} style={styles.tabsOverviewCloseButton}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.tabsOverviewContent} contentContainerStyle={styles.tabsGridContainer}>
              <View style={styles.tabsGrid}>
                {tabs.map((tab) => (
                  <TouchableOpacity key={tab.id} style={[styles.tabCard, activeTabId === tab.id && styles.activeTabCard]} onPress={() => switchTab(tab.id)}>
                    <View style={styles.tabCardHeader}>
                      <ThemedText style={styles.tabCardTitle} numberOfLines={1}>
                        {tab.title}
                      </ThemedText>
                      <TouchableOpacity style={styles.tabCardCloseButton} onPress={() => closeTab(tab.id)}>
                        <Ionicons name="close" size={16} color="rgba(255, 255, 255, 0.8)" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.tabCardPreview}>
                      <View style={styles.tabCardContent}>
                        <ThemedText style={styles.tabCardUrl} numberOfLines={2}>
                          {tab.url}
                        </ThemedText>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </Animated.View>
      </View>

      {/* Bottom Navigation */}
      <View style={styles.bottomNavigation}>
        {/* Left side - Back and Forward buttons */}
        <View style={styles.navigationLeft}>
          <TouchableOpacity style={[styles.navButton, !activeTab?.canGoBack && styles.disabledButton]} onPress={goBack} disabled={!activeTab?.canGoBack}>
            <Ionicons name="arrow-back" size={24} color={activeTab?.canGoBack ? 'white' : 'rgba(255, 255, 255, 0.4)'} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.navButton, !activeTab?.canGoForward && styles.disabledButton]} onPress={goForward} disabled={!activeTab?.canGoForward}>
            <Ionicons name="arrow-forward" size={24} color={activeTab?.canGoForward ? 'white' : 'rgba(255, 255, 255, 0.4)'} />
          </TouchableOpacity>
        </View>

        {/* Center - Add tab button (circled) */}
        <View style={styles.navigationCenter}>
          <TouchableOpacity style={styles.addTabButton} onPress={createNewTab}>
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Right side - Tabs overview button */}
        <View style={styles.navigationRight}>
          <TouchableOpacity style={styles.tabsButton} onPress={showTabsOverviewAnimated}>
            <View style={styles.tabsOverviewIcon}>
              <ThemedText style={styles.tabsCount}>{tabs.length}</ThemedText>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </GradientScreen>
  );
};

export default DAppBrowser;

const styles = StyleSheet.create({
  // Error and Loading states
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },

  // Address Bar
  addressContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  addressInput: {
    flex: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // WebView Container
  contentContainer: {
    flex: 1,
    position: 'relative',
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: 'white',
  },

  // Bottom Navigation
  bottomNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  navigationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  navigationCenter: {
    flex: 1,
    alignItems: 'center',
  },
  navigationRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  navButton: {
    padding: 12,
  },
  addTabButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsButton: {
    padding: 12,
  },
  disabledButton: {
    opacity: 0.4,
  },
  tabsOverviewIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsCount: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Animated Tabs Overview
  tabsOverviewContainer: {
    flex: 1,
  },
  tabsOverviewBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },

  // Tabs Overview Modal
  tabsOverviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 60, // Account for status bar
  },
  tabsOverviewTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  tabsOverviewCloseButton: {
    padding: 8,
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
  tabCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    flex: 1,
    marginRight: 8,
  },
  tabCardCloseButton: {
    padding: 4,
  },
  tabCardPreview: {
    flex: 1,
    backgroundColor: 'white',
    padding: 12,
  },
  tabCardContent: {
    flex: 1,
  },
  tabCardUrl: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
});
