import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import * as Linking from 'expo-linking';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Alert, TextInput, ScrollView, Animated, PanResponder } from 'react-native';
import WebView, { WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { Stack, useLocalSearchParams, useRouter, Link } from 'expo-router';
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
  history: { url: string; title: string }[];
  historyIndex: number;
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

  const [tabs, setTabs] = useState<BrowserTab[]>([
    {
      id: '1',
      url: initialUrl,
      title: 'site-url.com',
      canGoBack: false,
      canGoForward: false,
      history: [{ url: initialUrl, title: 'site-url.com' }],
      historyIndex: 0,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('1');
  const [addressInput, setAddressInput] = useState<string>(initialUrl);
  const [showTabsOverview, setShowTabsOverview] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const webviewOpacity = useRef(new Animated.Value(1)).current;
  const tabsOpacity = useRef(new Animated.Value(0)).current;
  const addressBarTranslateY = useRef(new Animated.Value(0)).current;
  const webviewTopMargin = useRef(new Animated.Value(0)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;
  const progressOpacity = useRef(new Animated.Value(1)).current;

  const scrollOffset = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const scrollStartY = useRef(0);
  const isAddressBarVisible = useRef(true);

  const swipeProgress = useRef(new Animated.Value(0)).current;
  const swipeOverlayOpacity = useRef(new Animated.Value(0)).current;

  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const currentUrl = activeTab?.url || initialUrl;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only capture gesture if it's a horizontal swipe from the left edge
        // and the webview can go back
        const isHorizontalSwipe = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        const isFromLeftEdge = gestureState.moveX < 50;
        const isSwipingRight = gestureState.dx > 10;
        return isHorizontalSwipe && isFromLeftEdge && isSwipingRight && (activeTab?.canGoBack || false);
      },
      onPanResponderGrant: () => {
        swipeProgress.setValue(0);
        swipeOverlayOpacity.setValue(0.3);
      },
      onPanResponderMove: (_, gestureState) => {
        // Update swipe progress (0 to 1)
        const progress = Math.min(Math.max(gestureState.dx / 200, 0), 1);
        swipeProgress.setValue(progress);
        swipeOverlayOpacity.setValue(0.3 * (1 - progress));
      },
      onPanResponderRelease: (_, gestureState) => {
        const shouldGoBack = gestureState.dx > 100 && gestureState.vx > 0.3;

        if (shouldGoBack && activeTab?.canGoBack) {
          // Animate to completion and go back
          Animated.parallel([
            Animated.timing(swipeProgress, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(swipeOverlayOpacity, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }),
          ]).start(() => {
            goBack();
            swipeProgress.setValue(0);
            swipeOverlayOpacity.setValue(0);
          });
        } else {
          // Animate back to start
          Animated.parallel([
            Animated.spring(swipeProgress, {
              toValue: 0,
              useNativeDriver: true,
              tension: 100,
              friction: 10,
            }),
            Animated.timing(swipeOverlayOpacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
      onPanResponderTerminate: () => {
        // Reset on termination
        Animated.parallel([
          Animated.spring(swipeProgress, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
          }),
          Animated.timing(swipeOverlayOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      },
    })
  ).current;

  useEffect(() => {
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const [{ localUri }] = await Asset.loadAsync(require('assets/js/inpage-bridge.jstxt'));
        const file = new File(localUri || '');
        const r = await file.text();

        const scrollDetectionScript = `
          let lastScrollY = 0;
          let ticking = false;
          
          function onScroll() {
            lastScrollY = window.scrollY || window.pageYOffset;
            if (!ticking) {
              window.requestAnimationFrame(() => {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'scroll',
                  scrollY: lastScrollY
                }));
                ticking = false;
              });
              ticking = true;
            }
          }
          
          window.addEventListener('scroll', onScroll, { passive: true });
        `;

        setJs(r + '\n' + scrollDetectionScript);
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

  const createNewTab = () => {
    const homeUrl = 'https://layerztec.github.io/website/explore/?network=' + network;
    const newTab: BrowserTab = {
      id: Date.now().toString(),
      url: homeUrl,
      title: 'site-url.com',
      canGoBack: false,
      canGoForward: false,
      history: [{ url: homeUrl, title: 'site-url.com' }],
      historyIndex: 0,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setAddressInput(newTab.url);
  };

  const closeTab = (tabId: string) => {
    if (tabs.length === 1) {
      const homeUrl = 'https://layerztec.github.io/website/explore/?network=' + network;
      updateActiveTab({
        url: homeUrl,
        title: 'site-url.com',
        history: [{ url: homeUrl, title: 'site-url.com' }],
        historyIndex: 0,
      });
      setAddressInput(homeUrl);
      return;
    }

    const newTabs = tabs.filter((tab) => tab.id !== tabId);
    setTabs(newTabs);

    if (activeTabId === tabId) {
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
      webviewRef.current?.injectJavaScript(`window.location.href = '${tab.url}';`);
    }
    hideTabsOverview();
  };

  const showTabsOverviewAnimated = () => {
    setShowTabsOverview(true);
    isAddressBarVisible.current = false;
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
        toValue: -120,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(webviewTopMargin, {
        toValue: -64,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const hideTabsOverview = () => {
    isAddressBarVisible.current = true;
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
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(webviewTopMargin, {
        toValue: 0,
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

  const stopLoading = () => {
    webviewRef.current?.stopLoading();
    setIsLoading(false);
  };

  const goBack = () => {
    webviewRef.current?.goBack();
  };

  const goForward = () => {
    webviewRef.current?.goForward();
  };

  const goToHistoryItem = (index: number) => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab || index < 0 || index >= tab.history.length) return;

    const historyItem = tab.history[index];
    webviewRef.current?.injectJavaScript(`window.location.href = '${historyItem.url}';`);
  };

  const getBackHistory = () => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return [];
    return tab.history.slice(0, tab.historyIndex).reverse();
  };

  const getForwardHistory = () => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return [];
    return tab.history.slice(tab.historyIndex + 1);
  };

  const unwhitelistCurrentDapp = async () => {
    try {
      const { hostname } = new URL(currentUrl);
      await BackgroundExecutor.unwhitelistDapp(hostname);
      refresh();
    } catch {
      Alert.alert('Error', 'Failed to unwhitelist dapp');
    }
  };

  const openInExternalBrowser = () => {
    Linking.openURL(currentUrl);
  };

  const handleScroll = useCallback(
    (scrollY: number) => {
      const delta = scrollY - lastScrollY.current;

      // Reset scroll start when changing direction or at top
      if (scrollY < 10) {
        scrollStartY.current = 0;
        scrollOffset.setValue(0);
        isAddressBarVisible.current = true;
      } else if ((delta > 0 && isAddressBarVisible.current) || (delta < 0 && !isAddressBarVisible.current)) {
        // Starting a new scroll gesture
        if (Math.abs(scrollY - scrollStartY.current) < 5) {
          scrollStartY.current = scrollY;
        }
      }

      // Calculate scroll distance from start
      const scrollDistance = scrollY - scrollStartY.current;
      const maxScrollDistance = 80; // Distance to fully hide/show

      // Clamp the scroll offset between 0 (visible) and 1 (hidden)
      const progress = Math.max(0, Math.min(1, scrollDistance / maxScrollDistance));

      // Update scroll offset for interpolation
      scrollOffset.setValue(progress);

      // Track visibility state
      if (progress > 0.5 && isAddressBarVisible.current) {
        isAddressBarVisible.current = false;
      } else if (progress < 0.5 && !isAddressBarVisible.current) {
        isAddressBarVisible.current = true;
      }

      // Update last scroll position
      lastScrollY.current = scrollY;
    },
    [scrollOffset]
  );

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const data = event.nativeEvent.data;

      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'scroll' && typeof parsed.scrollY === 'number') {
          handleScroll(parsed.scrollY);
          return;
        }
      } catch {
        // Not a scroll message, pass to bridge
      }

      browserBridgeRef.current?.handleMessage(event);
    },
    [handleScroll]
  );

  const handleLoadProgress = useCallback(
    ({ nativeEvent }: { nativeEvent: { progress: number } }) => {
      const progress = nativeEvent.progress;
      setLoadingProgress(progress);
      setIsLoading(progress < 1);

      if (progress < 1) {
        progressOpacity.setValue(1);
      }

      Animated.timing(progressWidth, {
        toValue: progress,
        duration: 100,
        useNativeDriver: false,
      }).start(() => {
        if (progress >= 1) {
          Animated.timing(progressOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start();
        }
      });
    },
    [progressWidth, progressOpacity]
  );

  const handleNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      const title = getTabTitle(navState.url);

      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id !== activeTabId) return tab;

          const newHistory = [...tab.history.slice(0, tab.historyIndex + 1)];

          if (newHistory[newHistory.length - 1]?.url !== navState.url) {
            newHistory.push({ url: navState.url, title });
          }

          return {
            ...tab,
            url: navState.url,
            title,
            canGoBack: navState.canGoBack,
            canGoForward: navState.canGoForward,
            history: newHistory,
            historyIndex: newHistory.length - 1,
          };
        })
      );

      setAddressInput(navState.url);
    },
    [activeTabId]
  );

  const navigateToAddress = () => {
    let url = addressInput.trim();

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    try {
      new URL(url);
      webviewRef.current?.injectJavaScript(`window.location.href = '${url}';`);
    } catch {
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

      <Animated.View
        style={{
          transform: [
            {
              translateY: scrollOffset.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -120],
              }),
            },
          ],
        }}
      >
        <View style={styles.addressContainer}>
          <View style={styles.addressBarWrapper}>
            <View style={styles.addressBar}>
              <ThemedText style={styles.addressText} numberOfLines={1}>
                {addressInput}
              </ThemedText>
              {isLoading && (
                <TouchableOpacity style={styles.stopButton} onPress={stopLoading}>
                  <Ionicons name="close-circle" size={20} color="rgba(255, 255, 255, 0.8)" />
                </TouchableOpacity>
              )}
            </View>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  opacity: progressOpacity,
                  width: progressWidth.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
            <Ionicons name="close" size={20} color="rgba(255, 255, 255, 0.9)" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.View
        style={[
          styles.contentContainer,
          {
            marginTop: scrollOffset.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -64],
            }),
          },
        ]}
      >
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
          {...panResponder.panHandlers}
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: swipeOverlayOpacity,
                backgroundColor: 'black',
                pointerEvents: 'none',
              },
            ]}
          />
          <Animated.View
            style={[
              styles.swipeIndicator,
              {
                opacity: swipeProgress.interpolate({
                  inputRange: [0, 0.3, 1],
                  outputRange: [0, 1, 0],
                }),
                transform: [
                  {
                    translateX: swipeProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-50, 100],
                    }),
                  },
                ],
              },
            ]}
          >
            <Ionicons name="arrow-back" size={32} color="rgba(255, 255, 255, 0.9)" />
          </Animated.View>
          <Animated.View
            style={{
              flex: 1,
              transform: [
                {
                  translateX: swipeProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 100],
                  }),
                },
              ],
            }}
          >
            <WebView
              ref={callbackRef}
              originWhitelist={['https://*', 'http://*', 'about:blank', 'about:srcdoc']}
              allowsInlineMediaPlayback={true}
              source={{ uri: currentUrl }}
              onMessage={handleMessage}
              onNavigationStateChange={handleNavigationStateChange}
              onLoadProgress={handleLoadProgress}
              injectedJavaScriptBeforeContentLoaded={js}
              webviewDebuggingEnabled={true}
            />
          </Animated.View>
        </Animated.View>

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
      </Animated.View>

      <View style={styles.bottomNavigation}>
        <View style={styles.navigationLeft}>
          {activeTab?.canGoBack && getBackHistory().length > 0 ? (
            <Link href="/DAppBrowser" asChild>
              <TouchableOpacity style={[styles.navButton]} onPress={goBack}>
                <Link.Trigger>
                  <View>
                    <Ionicons name="arrow-back" size={24} color="white" />
                  </View>
                </Link.Trigger>
                <Link.Menu>
                  {getBackHistory().map((item, index) => {
                    const historyIndex = (activeTab?.historyIndex || 0) - index - 1;
                    return <Link.MenuAction key={`back-${historyIndex}`} title={item.title} icon="arrow.left" onPress={() => goToHistoryItem(historyIndex)} />;
                  })}
                </Link.Menu>
              </TouchableOpacity>
            </Link>
          ) : (
            <TouchableOpacity style={[styles.navButton, styles.disabledButton]} onPress={goBack} disabled={!activeTab?.canGoBack}>
              <Ionicons name="arrow-back" size={24} color="rgba(255, 255, 255, 0.4)" />
            </TouchableOpacity>
          )}

          {activeTab?.canGoForward && getForwardHistory().length > 0 ? (
            <Link href="/DAppBrowser" asChild>
              <TouchableOpacity style={[styles.navButton]} onPress={goForward}>
                <Link.Trigger>
                  <View>
                    <Ionicons name="arrow-forward" size={24} color="white" />
                  </View>
                </Link.Trigger>
                <Link.Menu>
                  {getForwardHistory().map((item, index) => {
                    const historyIndex = (activeTab?.historyIndex || 0) + index + 1;
                    return <Link.MenuAction key={`forward-${historyIndex}`} title={item.title} icon="arrow.right" onPress={() => goToHistoryItem(historyIndex)} />;
                  })}
                </Link.Menu>
              </TouchableOpacity>
            </Link>
          ) : (
            <TouchableOpacity style={[styles.navButton, styles.disabledButton]} onPress={goForward} disabled={!activeTab?.canGoForward}>
              <Ionicons name="arrow-forward" size={24} color="rgba(255, 255, 255, 0.4)" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.navigationCenter}>
          <TouchableOpacity style={styles.addTabButton} onPress={createNewTab}>
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>

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
  addressContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  addressBarWrapper: {
    flex: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  addressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 40,
    zIndex: 1,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  stopButton: {
    padding: 4,
    marginLeft: 8,
  },
  progressText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: 8,
    fontWeight: '600',
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 2,
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
  contentContainer: {
    flex: 1,
    position: 'relative',
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  swipeIndicator: {
    position: 'absolute',
    left: 20,
    top: '50%',
    marginTop: -16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    pointerEvents: 'none',
  },
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
  tabsOverviewContainer: {
    flex: 1,
  },
  tabsOverviewBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  tabsOverviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
