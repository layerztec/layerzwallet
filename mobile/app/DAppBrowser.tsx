import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { File as ExpoFsFile, Directory } from 'expo-file-system';
import React, { useCallback, useContext, useEffect, useRef, useState, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View, Alert, TextInput, PanResponder, Image, AppState, AppStateStatus, Dimensions, Text, ViewStyle, StyleProp } from 'react-native';
import WebView, { WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { Stack, useLocalSearchParams, useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as ExpoImage } from 'expo-image';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, withSpring, interpolate, runOnJS } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { ThemedText } from '@/components/ThemedText';
import GradientScreen from '@/components/GradientScreen';
import DashboardTiles, { LayerCard } from '@/components/DashboardTiles';
import { BrowserBridge } from '@/src/class/browser-bridge';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useAvailableNetworks } from '@shared/hooks/useAvailableNetworks';
import { getNetworkImageAsset } from '@/utils/networkAssets';
import { getNetworkGradient } from '@shared/constants/Colors';
import { getIsTestnet, getTickerByNetwork } from '@shared/models/network-getters';
import { capitalizeFirstLetter } from '@shared/modules/string-utils';
import { DAppBrowserTabs } from './DAppBrowserTabs';
import { useScreenshotManager } from './hooks/useScreenshotManager';

export type DappBrowserProps = {
  url?: string;
};

const getTabTitle = (url: string): string => {
  try {
    const { hostname } = new URL(url);
    return hostname.replace('www.', '');
  } catch {
    return url.length > 30 ? url.substring(0, 30) + '...' : url;
  }
};

const isValidUrl = (urlString: string): boolean => {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

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

interface ScreenshotManifestEntry {
  key: string;
  size: number;
  timestamp: number;
  lastAccessed: number;
}

type ScreenshotManifest = { [tabId: string]: ScreenshotManifestEntry };

type StoredTab = {
  id: string;
  url: string;
  title: string;
  history: { url: string; title: string }[];
  historyIndex: number;
  timestamp: number;
};

const TABS_STORAGE_KEY = '@browser_tabs';
const ACTIVE_TAB_STORAGE_KEY = '@browser_active_tab';

const getScreenshotDir = (): string | null => {
  try {
    const cacheDir = (FileSystem as any).cacheDirectory;
    const docDir = (FileSystem as any).documentDirectory;

    console.debug('[DAppBrowser] getScreenshotDir called', { cacheDir, docDir });

    const base = cacheDir || docDir;

    if (!base || typeof base !== 'string') {
      console.warn('[DAppBrowser] FileSystem directories not available', {
        base,
        type: typeof base,
        cacheDir,
        docDir,
      });
      return null;
    }

    if (!base.startsWith('file://')) {
      console.warn('[DAppBrowser] FileSystem base directory has invalid format', { base });
      return null;
    }

    const dir = `${base.endsWith('/') ? base : base + '/'}browser_screens/`;
    console.debug('[DAppBrowser] Screenshot directory resolved', { dir });
    return dir;
  } catch (error) {
    console.error('[DAppBrowser] Error getting screenshot directory', error);
    return null;
  }
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_MIN_HEIGHT = 120;
const MODAL_MAX_HEIGHT = SCREEN_HEIGHT;

const DAppBrowser: React.FC = () => {
  const { network, setNetwork } = useContext(NetworkContext);
  const router = useRouter();
  const webviewRef = useRef<WebView>(null);
  const tabWebViewRefs = useRef<{ [key: string]: React.RefObject<WebView | null> }>({});
  const tabContainerRefs = useRef<{ [key: string]: React.RefObject<View | null> }>({});
  const browserBridgeRef = useRef<BrowserBridge>(null);
  const addressInputRef = useRef<TextInput>(null);
  const [js, setJs] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const params = useLocalSearchParams<DappBrowserProps>();
  const initialUrl = params.url || 'https://layerztec.github.io/website/explore/?network=' + network; // to test: https://metamask.github.io/test-dapp/ & https://eip6963.org/
  const [tabs, setTabs] = useState<BrowserTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [isRestoringTabs, setIsRestoringTabs] = useState<boolean>(true);
  const [addressInput, setAddressInput] = useState<string>(initialUrl);
  const [showTabsOverview, setShowTabsOverview] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAddressInputFocused, setIsAddressInputFocused] = useState(false);

  const webviewOpacity = useSharedValue(1);
  const tabsOpacity = useSharedValue(0);
  const addressBarTranslateY = useSharedValue(0);
  const progressWidth = useSharedValue(0);
  const progressOpacity = useSharedValue(1);

  const swipeProgress = useSharedValue(0);
  const swipeOverlayOpacity = useSharedValue(0);

  const modalTranslateY = useSharedValue(0);
  const currentModalPosition = useSharedValue(0);
  const gestureStartPosition = useSharedValue(0);
  const whiteFlashAnim = useSharedValue(0);
  const lastHandledUrl = useRef<string | undefined>(undefined);
  const [isNetworkSelectorVisible, setIsNetworkSelectorVisible] = useState<boolean>(false);
  const isManualNavigation = useRef<boolean>(false);
  const lastManualNavigationUrl = useRef<string | undefined>(undefined);

  const setAddressBarValue = useCallback((value: string, options?: { ensureStartVisible?: boolean }) => {
    setAddressInput(value);
    if (!options?.ensureStartVisible) {
      return;
    }

    requestAnimationFrame(() => {
      if (addressInputRef.current?.isFocused() || !addressInputRef.current) {
        return;
      }

      try {
        addressInputRef.current.setNativeProps({ selection: { start: 0, end: 0 } });
      } catch (error) {}
    });
  }, []);

  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const currentUrl = activeTab?.url || initialUrl;
  const selectionAtStart = useMemo(() => ({ start: 0, end: 0 }), []);

  const modalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: modalTranslateY.value }],
  }));

  const whiteFlashAnimatedStyle = useAnimatedStyle(() => ({
    opacity: whiteFlashAnim.value,
  }));

  const addressBarAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tabsOpacity.value, [0, 1], [1, 0]),
    transform: [
      {
        translateY: addressBarTranslateY.value,
      },
    ],
  }));

  const webviewContainerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: webviewOpacity.value,
    transform: [{ translateY: addressBarTranslateY.value }],
  }));

  const tabsOverviewAnimatedStyle = useAnimatedStyle(() => ({
    opacity: tabsOpacity.value,
  }));

  const swipeIndicatorAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(swipeProgress.value, [0, 0.3, 1], [0, 1, 0]),
    transform: [
      {
        translateX: interpolate(swipeProgress.value, [0, 1], [-50, 100]),
      },
    ],
  }));

  const swipeOverlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: swipeOverlayOpacity.value,
  }));

  const swipeContentAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(swipeProgress.value, [0, 1], [0, 100]),
      },
    ],
  }));

  const progressBarAnimatedStyle = useAnimatedStyle(() => ({
    opacity: progressOpacity.value,
    transform: [
      {
        scaleX: progressWidth.value,
      },
    ],
  }));

  const panGesture = Gesture.Pan()
    .onStart(() => {
      gestureStartPosition.value = modalTranslateY.value;
    })
    .onUpdate((event) => {
      const { translationY } = event;
      const maxTranslate = MODAL_MAX_HEIGHT - MODAL_MIN_HEIGHT;

      const newPosition = gestureStartPosition.value + translationY;

      let constrainedPosition = newPosition;
      if (newPosition < 0) {
        constrainedPosition = 0;
      } else if (newPosition > maxTranslate) {
        constrainedPosition = maxTranslate;
      }

      modalTranslateY.value = constrainedPosition;
    })
    .onEnd((event) => {
      const { translationY, velocityY } = event;
      const maxTranslate = MODAL_MAX_HEIGHT - MODAL_MIN_HEIGHT;

      const shouldSnapToMin = translationY > 100 || velocityY > 500;

      if (shouldSnapToMin) {
        currentModalPosition.value = maxTranslate;
        modalTranslateY.value = withTiming(maxTranslate, { duration: 300 });
      } else {
        currentModalPosition.value = 0;
        modalTranslateY.value = withTiming(0, { duration: 300 });
      }
    })
    .activeOffsetY([-10, 10])
    .failOffsetX([-50, 50]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isHorizontalSwipe = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        const isFromLeftEdge = gestureState.moveX < 50;
        const isSwipingRight = gestureState.dx > 10;
        return isHorizontalSwipe && isFromLeftEdge && isSwipingRight && (activeTab?.canGoBack || false);
      },
      onPanResponderGrant: () => {
        swipeProgress.value = 0;
        swipeOverlayOpacity.value = 0.3;
      },
      onPanResponderMove: (_, gestureState) => {
        const progress = Math.min(Math.max(gestureState.dx / 200, 0), 1);
        swipeProgress.value = progress;
        swipeOverlayOpacity.value = 0.3 * (1 - progress);
      },
      onPanResponderRelease: (_, gestureState) => {
        const shouldGoBack = gestureState.dx > 100 && gestureState.vx > 0.3;

        if (shouldGoBack && activeTab?.canGoBack) {
          swipeProgress.value = withTiming(1, { duration: 150 }, (finished) => {
            if (finished) {
              runOnJS(goBack)();
              swipeProgress.value = 0;
              swipeOverlayOpacity.value = 0;
            }
          });
          swipeOverlayOpacity.value = withTiming(0, { duration: 150 });
        } else {
          swipeProgress.value = withSpring(0, { damping: 10, stiffness: 100 });
          swipeOverlayOpacity.value = withTiming(0, { duration: 200 });
        }
      },
      onPanResponderTerminate: () => {
        swipeProgress.value = withSpring(0, { damping: 10, stiffness: 100 });
        swipeOverlayOpacity.value = withTiming(0, { duration: 200 });
      },
    })
  ).current;

  useEffect(() => {
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const [{ localUri }] = await Asset.loadAsync(require('assets/js/inpage-bridge.jstxt'));

        if (!localUri) {
          throw new Error('Bridge asset URI is undefined');
        }

        const bridgeFile = new ExpoFsFile(localUri);
        const bridgeScript = await bridgeFile.text();

        setJs(bridgeScript);
      } catch (error: any) {
        setError('Failed to load DApp browser script: ' + error.message);
      }
    })();
  }, [network, setAddressBarValue]);

  // Centralized purge + UI reset to DRY error handling paths
  const isPurgingRef = useRef(false);
  const hasPurgedRef = useRef(false);
  const purgeAndReset = useCallback(
    async (reason?: string) => {
      if (isPurgingRef.current || hasPurgedRef.current) return;
      isPurgingRef.current = true;
      try {
        try {
          await AsyncStorage.clear();
          console.warn('[DAppBrowser] Purged AsyncStorage', reason ? `(${reason})` : '');
        } catch (purgeErr) {
          console.error('[DAppBrowser] Failed to purge AsyncStorage', purgeErr);
        }

        try {
          const dir = getScreenshotDir();
          if (dir) {
            const directory = new Directory(dir);
            if (directory.exists) {
              await directory.delete();
            }
            await directory.create();
          }
        } catch (e) {
          console.error('[DAppBrowser] Failed to purge screenshot files:', e);
        }

        const homeUrl = 'https://layerztec.github.io/website/explore/?network=' + network;
        const newTab: BrowserTab = {
          id: Date.now().toString(),
          url: homeUrl,
          title: getTabTitle(homeUrl),
          canGoBack: false,
          canGoForward: false,
          history: [{ url: homeUrl, title: getTabTitle(homeUrl) }],
          historyIndex: 0,
          timestamp: Date.now(),
        };
        setTabs([newTab]);
        setActiveTabId(newTab.id);
        setAddressBarValue(homeUrl, { ensureStartVisible: true });
        setShowTabsOverview(false);

        // Mark as purged so we only do this once during app lifetime
        hasPurgedRef.current = true;
      } finally {
        isPurgingRef.current = false;
      }
    },
    [network, setAddressBarValue]
  );

  const saveTabs = useCallback(
    async (tabsToSave: BrowserTab[], activeId: string) => {
      try {
        const storedTabs: StoredTab[] = tabsToSave.map((t) => ({
          id: t.id,
          url: t.url,
          title: t.title,
          history: t.history?.length ? t.history : [{ url: t.url, title: t.title || getTabTitle(t.url) }],
          historyIndex: typeof t.historyIndex === 'number' ? t.historyIndex : Math.max((t.history?.length || 1) - 1, 0),
          timestamp: t.timestamp || Date.now(),
        }));

        console.debug('[DAppBrowser] Saving tabs to storage', {
          tabCount: storedTabs.length,
          activeId,
          tabIds: storedTabs.map((t) => t.id),
        });

        await AsyncStorage.setItem(TABS_STORAGE_KEY, JSON.stringify({ version: 1, tabs: storedTabs }));
        await AsyncStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeId);
      } catch (error) {
        console.error('[DAppBrowser] Failed to save tabs:', error);
        await purgeAndReset('saveTabs error');
      }
    },
    [purgeAndReset]
  );

  const screenshots = useScreenshotManager(purgeAndReset);

  const loadTabs = useCallback(async (): Promise<{ tabs: BrowserTab[]; activeTabId: string } | null> => {
    try {
      const tabsJson = await AsyncStorage.getItem(TABS_STORAGE_KEY);
      const activeId = await AsyncStorage.getItem(ACTIVE_TAB_STORAGE_KEY);

      if (!tabsJson || !activeId) return null;

      let raw: any;
      try {
        raw = JSON.parse(tabsJson);
      } catch {
        return null;
      }

      const storedTabs: StoredTab[] = Array.isArray(raw)
        ? (raw as any[]).map((t) => ({
            id: t.id,
            url: t.url,
            title: t.title || getTabTitle(t.url),
            history: t.history && Array.isArray(t.history) && t.history.length > 0 ? t.history : [{ url: t.url, title: t.title || getTabTitle(t.url) }],
            historyIndex: typeof t.historyIndex === 'number' ? t.historyIndex : Math.max(((t.history && t.history.length) || 1) - 1, 0),
            timestamp: t.timestamp || Date.now(),
          }))
        : (raw?.tabs as StoredTab[]);

      if (!storedTabs || !Array.isArray(storedTabs) || storedTabs.length === 0) return null;

      const tabs: BrowserTab[] = storedTabs
        .filter((t) => {
          const hasValidUrl = isValidUrl(t.url);
          const hasValidHistory = t.history && t.history.length > 0 && t.history.every((h) => isValidUrl(h.url));
          return hasValidUrl && hasValidHistory;
        })
        .map((t) => {
          const history = t.history && t.history.length > 0 ? t.history : [{ url: t.url, title: t.title || getTabTitle(t.url) }];
          const historyIndex = Math.min(Math.max(t.historyIndex ?? history.length - 1, 0), history.length - 1);
          return {
            id: t.id,
            url: history[historyIndex]?.url || t.url,
            title: history[historyIndex]?.title || t.title || getTabTitle(t.url),
            canGoBack: historyIndex > 0,
            canGoForward: historyIndex < history.length - 1,
            history,
            historyIndex,
            timestamp: t.timestamp || Date.now(),
          } as BrowserTab;
        });

      if (tabs.length === 0) return null;

      const activeExists = tabs.some((t) => t.id === activeId);
      const finalActiveId = activeExists ? activeId : tabs[tabs.length - 1].id;

      console.debug('[DAppBrowser] Loaded tabs from storage', {
        tabCount: tabs.length,
        activeId: finalActiveId,
        tabIds: tabs.map((t) => t.id),
      });

      return { tabs, activeTabId: finalActiveId };
    } catch (error) {
      console.error('[DAppBrowser] Failed to load tabs:', error);
      await purgeAndReset('loadTabs error');
      return null;
    }
  }, [purgeAndReset]);

  const captureTabScreenshot = useCallback(
    async (tabId: string): Promise<string | null> => {
      const containerRef = tabContainerRefs.current[tabId];

      if (!containerRef?.current) {
        console.debug('[DAppBrowser] captureTabScreenshot skipped - no container', { tabId });
        return null;
      }

      console.debug('[DAppBrowser] captureTabScreenshot start', {
        tabId,
        availableRefs: Object.keys(tabContainerRefs.current),
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      try {
        const fileUri = await screenshots.capture(containerRef, tabId);

        if (fileUri) {
          setTabs((prev) =>
            prev.map((tab) =>
              tab.id === tabId
                ? {
                    ...tab,
                    screenshot: fileUri,
                    timestamp: Date.now(),
                  }
                : tab
            )
          );
        }

        return fileUri;
      } catch (error: any) {
        if (error?.code !== 'EUNSPECIFIED') {
          console.warn('[DAppBrowser] Failed to capture screenshot for tab:', tabId, error?.message || error);
        }
        return null;
      } finally {
        console.debug('[DAppBrowser] captureTabScreenshot end', { tabId });
      }
    },
    [screenshots]
  );

  const ensureTabPreview = useCallback(
    async (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) {
        console.debug('[DAppBrowser] ensureTabPreview skipped - tab missing', { tabId });
        return;
      }

      if (tab.screenshot) {
        console.debug('[DAppBrowser] ensureTabPreview skipped - screenshot exists', { tabId });
        return;
      }

      console.debug('[DAppBrowser] ensureTabPreview start', {
        tabId,
        url: tab.url,
      });

      const storedScreenshot = await screenshots.load(tabId);
      if (storedScreenshot) {
        console.debug('[DAppBrowser] ensureTabPreview loaded from storage', { tabId });
        setTabs((prev) =>
          prev.map((currentTab) =>
            currentTab.id === tabId
              ? {
                  ...currentTab,
                  screenshot: storedScreenshot,
                }
              : currentTab
          )
        );
        return;
      }

      console.debug('[DAppBrowser] ensureTabPreview capturing new screenshot', { tabId });
      await captureTabScreenshot(tabId);
    },
    [tabs, screenshots, captureTabScreenshot]
  );

  // Load screenshots when tabs overview is shown
  useEffect(() => {
    if (!showTabsOverview || isRestoringTabs) {
      return;
    }

    // Load screenshots from storage for tabs that don't have them in memory
    const loadScreenshots = async () => {
      for (const tab of tabs) {
        if (!tab.screenshot) {
          const storedScreenshot = await screenshots.load(tab.id);
          if (storedScreenshot) {
            setTabs((prev) =>
              prev.map((t) =>
                t.id === tab.id
                  ? {
                      ...t,
                      screenshot: storedScreenshot,
                    }
                  : t
              )
            );
          }
        }
      }
    };

    loadScreenshots();
  }, [showTabsOverview, tabs, isRestoringTabs, screenshots]);

  useEffect(() => {
    const restoreTabs = async () => {
      const restored = await loadTabs();

      if (restored && restored.tabs.length > 0) {
        setTabs(restored.tabs);
        setActiveTabId(restored.activeTabId);
        const activeTab = restored.tabs.find((t) => t.id === restored.activeTabId);
        if (activeTab) {
          setAddressBarValue(activeTab.url, { ensureStartVisible: true });
        }
      } else {
        const homeUrl = 'https://layerztec.github.io/website/explore/?network=' + network;
        const initialTab: BrowserTab = {
          id: Date.now().toString(),
          url: homeUrl,
          title: getTabTitle(homeUrl),
          canGoBack: false,
          canGoForward: false,
          history: [{ url: homeUrl, title: getTabTitle(homeUrl) }],
          historyIndex: 0,
          timestamp: Date.now(),
        };
        setTabs([initialTab]);
        setActiveTabId(initialTab.id);
        setAddressBarValue(initialTab.url, { ensureStartVisible: true });
      }

      setIsRestoringTabs(false);
    };

    restoreTabs();
  }, [network, loadTabs, captureTabScreenshot, setAddressBarValue]);

  useEffect(() => {
    if (!isRestoringTabs && tabs.length > 0 && activeTabId) {
      saveTabs(tabs, activeTabId);
    }
  }, [tabs, activeTabId, isRestoringTabs, saveTabs]);

  useEffect(() => {
    const currentTabIds = new Set(tabs.map((t) => t.id));
    const refTabIds = Object.keys(tabWebViewRefs.current);

    refTabIds.forEach((tabId) => {
      if (!currentTabIds.has(tabId)) {
        delete tabWebViewRefs.current[tabId];
        delete tabContainerRefs.current[tabId];
      }
    });
  }, [tabs]);

  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        if (activeTabId) {
          await captureTabScreenshot(activeTabId);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [activeTabId, captureTabScreenshot]);

  useEffect(() => {
    if (params.url && !isRestoringTabs && tabs.length > 0 && lastHandledUrl.current !== params.url) {
      lastHandledUrl.current = params.url;

      if (!isValidUrl(params.url)) {
        console.warn('Invalid URL from params:', params.url);
        return;
      }

      const existingTab = tabs.find((tab) => tab.url === params.url);
      if (!existingTab) {
        const newTab: BrowserTab = {
          id: Date.now().toString(),
          url: params.url,
          title: getTabTitle(params.url),
          canGoBack: false,
          canGoForward: false,
          history: [{ url: params.url, title: getTabTitle(params.url) }],
          historyIndex: 0,
          timestamp: Date.now(),
        };
        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(newTab.id);
        setAddressBarValue(newTab.url, { ensureStartVisible: true });
      }
    }
  }, [params.url, isRestoringTabs, tabs, setAddressBarValue]);

  const availableNetworks = useAvailableNetworks();

  const networkCards: LayerCard[] = useMemo(() => {
    return availableNetworks.map((networkItem) => {
      const isTestnet = getIsTestnet(networkItem);
      const gradientColors = getNetworkGradient(networkItem);
      const networkIcon = getNetworkImageAsset(networkItem);

      return {
        networkId: networkItem,
        name: capitalizeFirstLetter(networkItem),
        ticker: getTickerByNetwork(networkItem),
        balance: network === networkItem ? 'Selected' : 'Available',
        usdValue: isTestnet ? 'Testnet' : 'Mainnet',
        color: gradientColors[0],
        icon: networkIcon,
        tags: isTestnet ? ['Testnet'] : [],
        tokenCount: 0,
      };
    });
  }, [availableNetworks, network]);

  const showNetworkSwitcherModal = () => {
    const maxTranslate = MODAL_MAX_HEIGHT - MODAL_MIN_HEIGHT;
    currentModalPosition.value = maxTranslate;
    setIsNetworkSelectorVisible(true);
    modalTranslateY.value = withTiming(maxTranslate, { duration: 300 });
  };

  const hideNetworkSwitcherModal = () => {
    currentModalPosition.value = 0;
    setIsNetworkSelectorVisible(false);
    modalTranslateY.value = withTiming(0, { duration: 300 });
  };

  const handleNetworkSwitch = (index: number) => {
    if (index >= 0 && index < availableNetworks.length) {
      const selectedNetwork = availableNetworks[index];

      const flashDuration = 150;

      whiteFlashAnim.value = withTiming(1, { duration: flashDuration }, (finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setNetwork, selectedNetwork);

          whiteFlashAnim.value = withTiming(0, { duration: flashDuration }, (finished2) => {
            'worklet';
            if (finished2) {
              currentModalPosition.value = 0;
              modalTranslateY.value = withTiming(0, { duration: 400 });

              const homeUrl = `https://layerztec.github.io/website/explore/?network=${selectedNetwork}`;
              const homeTitle = 'layerztec.github.io';
              scheduleOnRN(setIsNetworkSelectorVisible, false);
              scheduleOnRN(updateActiveTab, {
                url: homeUrl,
                title: homeTitle,
                history: [{ url: homeUrl, title: homeTitle }],
                historyIndex: 0,
              });
              scheduleOnRN(setAddressBarValue, homeUrl, { ensureStartVisible: true });
            }
          });
        }
      });
    }
  };

  const createNewTab = () => {
    const homeUrl = 'https://layerztec.github.io/website/explore/?network=' + network;
    console.debug('[DAppBrowser] Creating new tab with URL:', homeUrl);

    const newTab: BrowserTab = {
      id: Date.now().toString(),
      url: homeUrl,
      title: getTabTitle(homeUrl),
      canGoBack: false,
      canGoForward: false,
      history: [{ url: homeUrl, title: getTabTitle(homeUrl) }],
      historyIndex: 0,
      timestamp: Date.now(),
    };

    console.debug('[DAppBrowser] New tab created:', newTab.id, newTab.url, newTab.title);

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setAddressBarValue(newTab.url, { ensureStartVisible: true });

    if (showTabsOverview) {
      hideTabsOverview();
    }
  };

  const closeTab = (tabId: string) => {
    console.debug('[DAppBrowser] Closing tab request', { tabId, totalTabs: tabs.length });

    // Delete screenshot from storage
    screenshots.remove(tabId);

    if (tabs.length === 1) {
      const homeUrl = 'https://layerztec.github.io/website/explore/?network=' + network;
      console.debug('[DAppBrowser] Closing last tab, creating fallback home tab', { homeUrl });
      const newTab: BrowserTab = {
        id: Date.now().toString(),
        url: homeUrl,
        title: getTabTitle(homeUrl),
        canGoBack: false,
        canGoForward: false,
        history: [{ url: homeUrl, title: getTabTitle(homeUrl) }],
        historyIndex: 0,
        timestamp: Date.now(),
      };
      setTabs([newTab]);
      setActiveTabId(newTab.id);
      setAddressBarValue(homeUrl, { ensureStartVisible: true });
      return;
    }

    const newTabs = tabs.filter((tab) => tab.id !== tabId);
    setTabs(newTabs);

    console.debug('[DAppBrowser] Tab closed', { tabId, remainingTabs: newTabs.length });

    if (activeTabId === tabId) {
      const newActiveTab = newTabs[newTabs.length - 1];
      console.debug('[DAppBrowser] Active tab closed, activating fallback', { tabId: newActiveTab.id });
      setActiveTabId(newActiveTab.id);
      setAddressBarValue(newActiveTab.url, { ensureStartVisible: true });
    }

    if (newTabs.length === 1 && showTabsOverview) {
      hideTabsOverview();
    }
  };

  const switchTab = async (tabId: string) => {
    console.debug('[DAppBrowser] switchTab invoked', { from: activeTabId, to: tabId });
    if (activeTabId === tabId) {
      console.debug('[DAppBrowser] switchTab early exit - already active');
      hideTabsOverview();
      return;
    }

    const oldActiveTabId = activeTabId;
    if (addressInputRef.current?.isFocused()) {
      addressInputRef.current.blur();
      setIsAddressInputFocused(false);
    }

    // Capture screenshot of old active tab (don't block on this)
    if (oldActiveTabId) {
      captureTabScreenshot(oldActiveTabId).catch((error) => {
        console.warn('[DAppBrowser] Failed to capture screenshot while switching tabs', { from: oldActiveTabId, error });
      });
    }

    setActiveTabId(tabId);
    const newTab = tabs.find((t) => t.id === tabId);
    if (newTab) {
      console.debug('[DAppBrowser] Tab activated', { tabId: newTab.id, url: newTab.url });
      setAddressBarValue(newTab.url, { ensureStartVisible: true });
    }

    hideTabsOverview();
  };

  const showTabsOverviewAnimated = async () => {
    console.debug('[DAppBrowser] Showing tabs overview', { totalTabs: tabs.length, activeTabId });

    // Capture screenshot of active tab BEFORE starting animation
    if (activeTabId) {
      try {
        await captureTabScreenshot(activeTabId);
      } catch (error) {
        console.warn('[DAppBrowser] Failed to capture active tab screenshot:', error);
      }
    }

    // Now start the animation
    setShowTabsOverview(true);
    console.debug('[DAppBrowser] Tabs overview animation starting');
    webviewOpacity.value = withTiming(0, { duration: 300 });
    tabsOpacity.value = withTiming(1, { duration: 300 });
    addressBarTranslateY.value = withTiming(-120, { duration: 300 });

    tabs.forEach((tab, index) => {
      console.debug(`[DAppBrowser] Tab ${index + 1}:`, {
        id: tab.id,
        url: tab.url,
        title: tab.title,
        hasScreenshot: !!tab.screenshot,
        timestamp: new Date(tab.timestamp).toISOString(),
        isActive: tab.id === activeTabId,
      });
    });
  };

  const hideTabsOverview = () => {
    console.debug('[DAppBrowser] Hiding tabs overview');
    webviewOpacity.value = withTiming(1, { duration: 250 });
    tabsOpacity.value = withTiming(0, { duration: 250 });
    addressBarTranslateY.value = withTiming(0, { duration: 250 }, (finished) => {
      if (finished) {
        runOnJS(setShowTabsOverview)(false);
        console.debug('[DAppBrowser] Tabs overview hidden');
      }
    });
  };

  const toggleTabsOverview = () => {
    console.debug('[DAppBrowser] Toggling tabs overview', { currentlyVisible: showTabsOverview });
    if (showTabsOverview) {
      hideTabsOverview();
    } else {
      showTabsOverviewAnimated();
    }
  };

  const handleCloseAllTabs = () => {
    Alert.alert('Close All Tabs', 'Are you sure you want to close all tabs?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Close All',
        style: 'destructive',
        onPress: () => {
          const homeUrl = 'https://layerztec.github.io/website/explore/?network=' + network;
          console.debug('[DAppBrowser] Closing all tabs and creating new tab with URL:', homeUrl);
          const newTab: BrowserTab = {
            id: Date.now().toString(),
            url: homeUrl,
            title: getTabTitle(homeUrl),
            canGoBack: false,
            canGoForward: false,
            history: [{ url: homeUrl, title: getTabTitle(homeUrl) }],
            historyIndex: 0,
            timestamp: Date.now(),
          };
          console.debug('[DAppBrowser] New tab object:', newTab);
          setTabs([newTab]);
          setActiveTabId(newTab.id);
          setAddressBarValue(homeUrl, { ensureStartVisible: true });
          if (showTabsOverview) {
            hideTabsOverview();
          }
        },
      },
    ]);
  };

  const updateActiveTab = (updates: Partial<BrowserTab>) => {
    console.debug('[DAppBrowser] Updating active tab:', activeTabId, updates);
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId
          ? {
              ...tab,
              ...updates,
              timestamp: Date.now(),
            }
          : tab
      )
    );
  };

  const stopLoading = () => {
    webviewRef.current?.stopLoading();
    setIsLoading(false);
  };

  const onRefresh = () => {
    webviewRef.current?.reload();
  };

  const goBack = () => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab || tab.historyIndex <= 0) return;

    const newIndex = tab.historyIndex - 1;
    const historyItem = tab.history[newIndex];

    isManualNavigation.current = true;
    lastManualNavigationUrl.current = historyItem.url;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              historyIndex: newIndex,
              url: historyItem.url,
              title: historyItem.title,
              canGoBack: newIndex > 0,
              canGoForward: newIndex < t.history.length - 1,
            }
          : t
      )
    );

    setAddressBarValue(historyItem.url, { ensureStartVisible: true });
    webviewRef.current?.injectJavaScript(`window.location.href = '${historyItem.url}';`);
  };

  const goForward = () => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab || tab.historyIndex >= tab.history.length - 1) return;

    const newIndex = tab.historyIndex + 1;
    const historyItem = tab.history[newIndex];

    isManualNavigation.current = true;
    lastManualNavigationUrl.current = historyItem.url;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              historyIndex: newIndex,
              url: historyItem.url,
              title: historyItem.title,
              canGoBack: newIndex > 0,
              canGoForward: newIndex < t.history.length - 1,
            }
          : t
      )
    );

    setAddressBarValue(historyItem.url, { ensureStartVisible: true });
    webviewRef.current?.injectJavaScript(`window.location.href = '${historyItem.url}';`);
  };

  const goToHistoryItem = (index: number) => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab || index < 0 || index >= tab.history.length) return;

    const historyItem = tab.history[index];

    isManualNavigation.current = true;
    lastManualNavigationUrl.current = historyItem.url;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              historyIndex: index,
              url: historyItem.url,
              title: historyItem.title,
              canGoBack: index > 0,
              canGoForward: index < t.history.length - 1,
            }
          : t
      )
    );

    setAddressBarValue(historyItem.url, { ensureStartVisible: true });
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

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    browserBridgeRef.current?.handleMessage(event);
  }, []);

  const handleLoadProgress = useCallback(
    ({ nativeEvent }: { nativeEvent: { progress: number } }) => {
      const progress = nativeEvent.progress;
      setIsLoading(progress < 1);

      if (progress < 1) {
        progressOpacity.value = 1;
      }

      progressWidth.value = withTiming(progress, { duration: 100 }, (finished) => {
        if (finished && progress >= 1) {
          progressOpacity.value = withTiming(0, { duration: 300 });

          // Capture screenshot after load completes
          setTimeout(async () => {
            await captureTabScreenshot(activeTabId);
          }, 1000);
        }
      });
    },
    [progressWidth, progressOpacity, activeTabId, captureTabScreenshot]
  );

  const handleNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      console.debug('[DAppBrowser] Navigation state change:', navState.url, 'canGoBack:', navState.canGoBack, 'canGoForward:', navState.canGoForward);

      if (isManualNavigation.current || lastManualNavigationUrl.current === navState.url) {
        console.debug('[DAppBrowser] Skipping navigation state change (manual navigation)');
        isManualNavigation.current = false;
        lastManualNavigationUrl.current = undefined;
        return;
      }

      const title = getTabTitle(navState.url);

      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id !== activeTabId) return tab;

          if (tab.url === navState.url) {
            console.debug('[DAppBrowser] Skipping navigation state change (URL unchanged)');
            return tab;
          }

          console.debug('[DAppBrowser] Updating tab with new navigation:', title);

          const newHistory = [...tab.history.slice(0, tab.historyIndex + 1)];

          if (newHistory[newHistory.length - 1]?.url !== navState.url) {
            newHistory.push({ url: navState.url, title });
          }

          const newHistoryIndex = newHistory.length - 1;

          return {
            ...tab,
            url: navState.url,
            title,
            canGoBack: newHistoryIndex > 0,
            canGoForward: false,
            history: newHistory,
            historyIndex: newHistoryIndex,
            needsScreenshotUpdate: true,
          };
        })
      );

      // Only update address input if it's not currently focused (user is not typing)
      if (!isAddressInputFocused) {
        setAddressBarValue(navState.url, { ensureStartVisible: true });
      }
    },
    [activeTabId, isAddressInputFocused, setAddressBarValue]
  );

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
    <GestureHandlerRootView style={styles.gestureRootView}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.blackBackground}>
        <DashboardTiles cards={networkCards} onCardPress={handleNetworkSwitch} showLogo={true} />
      </View>

      <Animated.View style={[styles.modalContainer, styles.modalMaxHeight, modalAnimatedStyle]}>
        <GradientScreen variant={network}>
          <GestureDetector gesture={panGesture}>
            <Animated.View style={addressBarAnimatedStyle} pointerEvents={showTabsOverview ? 'none' : 'auto'}>
              <View style={[styles.addressContainer, isNetworkSelectorVisible && styles.addressContainerWithSelector]}>
                {isNetworkSelectorVisible && <TouchableOpacity style={styles.absoluteFill} activeOpacity={1} onPress={hideNetworkSwitcherModal} />}
                <TouchableOpacity style={styles.networkButton} onPress={showNetworkSwitcherModal} disabled={isNetworkSelectorVisible}>
                  <ExpoImage source={getNetworkImageAsset(network)} style={styles.networkIcon} contentFit="contain" />
                </TouchableOpacity>
                <View style={styles.addressBarWrapper} pointerEvents={isNetworkSelectorVisible ? 'none' : 'auto'}>
                  <View style={styles.addressBar}>
                    <TextInput
                      ref={addressInputRef}
                      key={isAddressInputFocused ? 'address-input-focused' : 'address-input-blurred'}
                      style={styles.addressText}
                      value={addressInput}
                      selection={isAddressInputFocused ? undefined : selectionAtStart}
                      onChangeText={setAddressInput}
                      onFocus={() => {
                        setIsAddressInputFocused(true);
                        if (isNetworkSelectorVisible) {
                          setIsNetworkSelectorVisible(false);
                        }
                      }}
                      onBlur={() => {
                        setIsAddressInputFocused(false);
                        if (activeTab?.url) {
                          setAddressBarValue(activeTab.url, { ensureStartVisible: true });
                        }
                      }}
                      onSubmitEditing={() => {
                        let url = addressInput.trim();
                        if (!url) return;

                        // Add protocol if missing
                        if (!url.startsWith('http://') && !url.startsWith('https://')) {
                          url = 'https://' + url;
                        }

                        if (isValidUrl(url)) {
                          updateActiveTab({ url, title: getTabTitle(url) });
                        } else {
                          Alert.alert('Invalid URL', 'Please enter a valid URL');
                          setAddressBarValue(activeTab?.url || '', { ensureStartVisible: true });
                        }
                      }}
                      returnKeyType="go"
                      keyboardType="url"
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder="Enter URL"
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      selectTextOnFocus={true}
                      editable={!isNetworkSelectorVisible}
                      testID="DappBrowserAddressBar"
                    />
                    {isAddressInputFocused ? (
                      <TouchableOpacity style={styles.stopButton} onPress={() => setAddressInput('')}>
                        <Ionicons name="close-circle" size={20} color="rgba(255, 255, 255, 0.8)" />
                      </TouchableOpacity>
                    ) : isLoading ? (
                      <TouchableOpacity style={styles.stopButton} onPress={stopLoading} testID="BrowserStopButton">
                        <Ionicons name="close-circle" size={20} color="rgba(255, 255, 255, 0.8)" />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={styles.stopButton} onPress={onRefresh} testID="BrowserRefreshButton">
                        <Ionicons name="reload" size={18} color="rgba(255, 255, 255, 0.8)" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Animated.View style={[styles.progressBar, progressBarAnimatedStyle]} />
                </View>
                <TouchableOpacity style={styles.closeButton} onPress={() => router.back()} disabled={isAddressInputFocused || isNetworkSelectorVisible} testID="BrowserCloseButton">
                  <Ionicons name="close" size={20} color={isAddressInputFocused || isNetworkSelectorVisible ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.9)'} />
                </TouchableOpacity>
              </View>
            </Animated.View>
          </GestureDetector>

          <View style={styles.contentContainer}>
            {isNetworkSelectorVisible && <TouchableOpacity style={styles.networkSelectorDismissOverlay} activeOpacity={1} onPress={hideNetworkSwitcherModal} />}

            <Animated.View style={[styles.webviewContainer, webviewContainerAnimatedStyle, styles.flex1]} {...panResponder.panHandlers}>
              <Animated.View style={[styles.absoluteFill, swipeOverlayAnimatedStyle, styles.swipeOverlayStyle]} />
              <Animated.View style={[styles.swipeIndicator, swipeIndicatorAnimatedStyle]}>
                <Ionicons name="arrow-back" size={32} color="rgba(255, 255, 255, 0.9)" />
              </Animated.View>
              <Animated.View style={[styles.flex1, swipeContentAnimatedStyle]}>
                {tabs.map((tab) => {
                  const isActive = tab.id === activeTabId;
                  const containerStyles: StyleProp<ViewStyle>[] = [styles.tabContainer];

                  if (isActive) {
                    containerStyles.push(styles.tabContainerActive);
                  } else {
                    containerStyles.push(styles.tabContainerHidden);
                  }

                  return (
                    <View
                      key={`tab-container-${tab.id}`}
                      ref={(ref) => {
                        if (ref) {
                          const wasPresent = !!tabContainerRefs.current[tab.id];
                          tabContainerRefs.current[tab.id] = { current: ref };
                          if (!wasPresent) {
                            console.debug('[DAppBrowser] Tab container mounted', {
                              tabId: tab.id,
                              isActive,
                              totalRefs: Object.keys(tabContainerRefs.current).length,
                            });
                          }
                        }
                      }}
                      collapsable={false}
                      style={containerStyles}
                    >
                      {tab.screenshot && <Image source={{ uri: tab.screenshot }} style={styles.absoluteFill} resizeMode="cover" />}
                      <WebView
                        key={`webview-${tab.id}-${tab.url}`}
                        ref={(ref) => {
                          if (ref) {
                            if (!tabWebViewRefs.current[tab.id]) {
                              tabWebViewRefs.current[tab.id] = { current: ref };
                            }
                            if (isActive) {
                              webviewRef.current = ref;
                              browserBridgeRef.current = new BrowserBridge(ref);
                            }
                          }
                        }}
                        originWhitelist={['https://*', 'http://*', 'about:blank', 'about:srcdoc']}
                        allowsInlineMediaPlayback={true}
                        source={{ uri: tab.url }}
                        onMessage={isActive ? handleMessage : undefined}
                        onNavigationStateChange={isActive ? handleNavigationStateChange : undefined}
                        onLoadProgress={isActive ? handleLoadProgress : undefined}
                        injectedJavaScriptBeforeContentLoaded={js}
                        style={styles.webviewVisible}
                        incognito={false}
                        scrollEnabled={!isAddressInputFocused}
                      />
                    </View>
                  );
                })}
              </Animated.View>
            </Animated.View>

            <DAppBrowserTabs
              tabs={tabs}
              activeTabId={activeTabId}
              animatedStyle={tabsOverviewAnimatedStyle}
              pointerEvents={showTabsOverview ? 'auto' : 'none'}
              onSwitchTab={switchTab}
              onCloseTab={closeTab}
              getTabTitle={getTabTitle}
              onEnsurePreview={ensureTabPreview}
            />
          </View>

          <View style={styles.bottomNavigation}>
            <View style={styles.navigationLeft}>
              {!showTabsOverview && (
                <>
                  <View style={styles.navButtonContainer}>
                    {activeTab?.canGoBack && getBackHistory().length > 0 ? (
                      <Link href="/DAppBrowser" asChild>
                        <TouchableOpacity style={styles.navButton} onPress={goBack}>
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
                      <TouchableOpacity style={styles.navButton} onPress={goBack} disabled={!activeTab?.canGoBack} testID="BrowserBackButton">
                        <Ionicons name="arrow-back" size={24} color={activeTab?.canGoBack ? 'white' : 'rgba(255, 255, 255, 0.3)'} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.navButtonContainer}>
                    {activeTab?.canGoForward && getForwardHistory().length > 0 ? (
                      <Link href="/DAppBrowser" asChild>
                        <TouchableOpacity style={styles.navButton} onPress={goForward}>
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
                      <TouchableOpacity style={styles.navButton} onPress={goForward} disabled={!activeTab?.canGoForward} testID="BrowserForwardButton">
                        <Ionicons name="arrow-forward" size={24} color={activeTab?.canGoForward ? 'white' : 'rgba(255, 255, 255, 0.3)'} />
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}
            </View>

            <View style={styles.navigationCenter}>
              <TouchableOpacity style={styles.addTabButton} onPress={createNewTab} testID="BrowserAddTabButton">
                <Ionicons name="add" size={24} color="white" />
              </TouchableOpacity>
            </View>

            <View style={styles.navigationRight}>
              <View style={styles.navButtonContainer}>
                <View style={styles.navButton} />
              </View>
              <View style={styles.navButtonContainer}>
                <TouchableOpacity style={styles.navButton} onPress={toggleTabsOverview} onLongPress={handleCloseAllTabs} disabled={tabs.length === 1} testID="BrowserTabsOverviewButton">
                  <View style={[styles.tabsOverviewIcon, tabs.length === 1 && { opacity: 0.3 }]}>
                    <ThemedText style={styles.tabsCount}>{tabs.length}</ThemedText>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <Animated.View style={[styles.whiteFlashOverlayAnimated, whiteFlashAnimatedStyle]} />
        </GradientScreen>
      </Animated.View>
    </GestureHandlerRootView>
  );
};

export default DAppBrowser;

const styles = StyleSheet.create({
  gestureRootView: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  absoluteFill: {
    ...StyleSheet.absoluteFillObject,
  },
  blackBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'black',
    flex: 1,
    paddingHorizontal: 16,
  },
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalMaxHeight: {
    height: MODAL_MAX_HEIGHT,
  },
  whiteFlashOverlayAnimated: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'white',
    zIndex: 9998,
    pointerEvents: 'none',
  },
  networkSelectorDismissOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    backgroundColor: 'transparent',
  },
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
  addressContainerWithSelector: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    marginHorizontal: 8,
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
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 2,
    transformOrigin: 'left',
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
  networkButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  networkIcon: {
    width: 24,
    height: 24,
  },
  contentContainer: {
    flex: 1,
    position: 'relative',
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  tabContainer: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  tabContainerActive: {
    zIndex: 1,
    opacity: 1,
    pointerEvents: 'auto',
  },
  tabContainerHidden: {
    zIndex: 0,
    opacity: 0,
    pointerEvents: 'none',
  },
  swipeOverlayStyle: {
    backgroundColor: 'black',
    pointerEvents: 'none',
  },
  webviewHidden: {
    opacity: 0,
  },
  webviewVisible: {
    opacity: 1,
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
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  navigationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start',
  },
  navigationCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigationRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
  },
  navButtonContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  navButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTabButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsOverviewIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  tabsCount: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
});
