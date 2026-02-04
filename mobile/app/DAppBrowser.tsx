import { Asset } from 'expo-asset';
import Pressable from '../components/Pressable';
import * as FileSystem from 'expo-file-system';
import { File as ExpoFsFile, Directory } from 'expo-file-system';
import React, { useCallback, useContext, useEffect, useRef, useState, useMemo } from 'react';
import { StyleSheet, View, Alert, TextInput, PanResponder, Image, AppState, AppStateStatus, ViewStyle, StyleProp, Dimensions } from 'react-native';
import WebView, { WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { Stack, useLocalSearchParams, useRouter, Link, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as ExpoImage } from 'expo-image';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, withSpring, interpolate, runOnJS } from 'react-native-reanimated';
import { ThemedText } from '@/components/ThemedText';
import GradientScreen from '@/components/GradientScreen';
import { BrowserBridge } from '@/src/class/browser-bridge';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getNetworkImageAsset } from '@/utils/networkAssets';
import { DAppBrowserTabs } from './DAppBrowserTabs';
import { useWebViewPreviewManager } from './hooks/useWebViewPreviewManager';
import { handleError } from '@/src/modules/error-handler';

export const BROWSER_CONSTANTS = {
  ANIMATION: {
    STANDARD: 300,
    FAST: 250,
    QUICK: 150,
    INSTANT: 100,
    SLOW: 400,
  },
  TIMEOUTS: {
    SCREENSHOT_DELAY: 500,
    POST_LOAD_CAPTURE: 1000,
    LOADING_TIMEOUT: 10000,
  },
  MODAL: {
    MIN_HEIGHT: 120,
    MAX_HEIGHT: Dimensions.get('window').height,
  },
  GESTURE: {
    SWIPE_THRESHOLD: 100,
    SWIPE_VELOCITY: 0.3,
    SWIPE_DISTANCE: 200,
    EDGE_THRESHOLD: 50,
    MIN_SWIPE_DX: 10,
  },
  STORAGE: {
    TABS_KEY: '@browser_tabs',
    ACTIVE_TAB_KEY: '@browser_active_tab',
  },
} as const;

const getHomeUrl = (network: string): string => `https://layerztec.github.io/website/explore/?network=${network}`; // to test: https://metamask.github.io/test-dapp/ & https://eip6963.org/

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

type StoredTab = {
  id: string;
  url: string;
  title: string;
  history: { url: string; title: string }[];
  historyIndex: number;
  timestamp: number;
};

const createBrowserTab = (url: string, id?: string): BrowserTab => ({
  id: id || Date.now().toString(),
  url,
  title: getTabTitle(url),
  canGoBack: false,
  canGoForward: false,
  history: [{ url, title: getTabTitle(url) }],
  historyIndex: 0,
  timestamp: Date.now(),
});

const createHomeTab = (network: string, id?: string): BrowserTab => createBrowserTab(getHomeUrl(network), id);

export type DappBrowserProps = {
  url?: string;
};

const getScreenshotDir = (): string | null => {
  try {
    const cacheDir = (FileSystem as any).cacheDirectory;
    const docDir = (FileSystem as any).documentDirectory;

    const base = cacheDir || docDir;

    if (!base || typeof base !== 'string') {
      return null;
    }

    if (!base.startsWith('file://')) {
      return null;
    }

    const dir = `${base.endsWith('/') ? base : base + '/'}browser_screens/`;
    return dir;
  } catch (error) {
    return null;
  }
};

const DAppBrowser: React.FC = () => {
  const { network } = useContext(NetworkContext);
  const router = useRouter();
  const navigation = useNavigation();
  const webviewRef = useRef<WebView>(null);
  const tabWebViewRefs = useRef<{ [key: string]: React.RefObject<WebView | null> }>({});
  const tabContainerRefs = useRef<{ [key: string]: React.RefObject<View | null> }>({});
  const browserBridgeRef = useRef<BrowserBridge>(null);
  const addressInputRef = useRef<TextInput>(null);
  const [js, setJs] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const params = useLocalSearchParams<DappBrowserProps>();
  const initialUrl = params.url || getHomeUrl(network);
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
  const lastHandledUrl = useRef<string | undefined>(undefined);
  const isManualNavigation = useRef<boolean>(false);
  const lastManualNavigationUrl = useRef<string | undefined>(undefined);
  const loadingScreenshotsRef = useRef<Set<string>>(new Set());
  const tabsNeedingScreenshotsRef = useRef<Set<string>>(new Set());

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
  const selectionAtStart = useMemo(() => ({ start: 0, end: 0 }), []);

  const modalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: modalTranslateY.value }],
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
      const maxTranslate = BROWSER_CONSTANTS.MODAL.MAX_HEIGHT - BROWSER_CONSTANTS.MODAL.MIN_HEIGHT;

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
      const maxTranslate = BROWSER_CONSTANTS.MODAL.MAX_HEIGHT - BROWSER_CONSTANTS.MODAL.MIN_HEIGHT;

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
        const isFromLeftEdge = gestureState.moveX < BROWSER_CONSTANTS.GESTURE.EDGE_THRESHOLD;
        const isSwipingRight = gestureState.dx > BROWSER_CONSTANTS.GESTURE.MIN_SWIPE_DX;
        return isHorizontalSwipe && isFromLeftEdge && isSwipingRight && (activeTab?.canGoBack || false);
      },
      onPanResponderGrant: () => {
        swipeProgress.value = 0;
        swipeOverlayOpacity.value = 0.3;
      },
      onPanResponderMove: (_, gestureState) => {
        const progress = Math.min(Math.max(gestureState.dx / BROWSER_CONSTANTS.GESTURE.SWIPE_DISTANCE, 0), 1);
        swipeProgress.value = progress;
        swipeOverlayOpacity.value = 0.3 * (1 - progress);
      },
      onPanResponderRelease: (_, gestureState) => {
        const shouldGoBack = gestureState.dx > BROWSER_CONSTANTS.GESTURE.SWIPE_THRESHOLD && gestureState.vx > BROWSER_CONSTANTS.GESTURE.SWIPE_VELOCITY;

        if (shouldGoBack && activeTab?.canGoBack) {
          swipeProgress.value = withTiming(1, { duration: BROWSER_CONSTANTS.ANIMATION.QUICK }, (finished) => {
            if (finished) {
              runOnJS(goBack)();
              swipeProgress.value = 0;
              swipeOverlayOpacity.value = 0;
            }
          });
          swipeOverlayOpacity.value = withTiming(0, { duration: BROWSER_CONSTANTS.ANIMATION.QUICK });
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
    navigation.setOptions({
      headerShown: showTabsOverview,
      title: 'Tabs',
      headerBackVisible: false,
      headerTransparent: true,
      headerBlurEffect: 'dark',
      headerTintColor: 'white',
      headerStyle: {
        backgroundColor: 'transparent',
      },
    });
  }, [showTabsOverview, navigation]);

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

  const isPurgingRef = useRef(false);
  const hasPurgedRef = useRef(false);
  const purgeAndReset = useCallback(
    async (reason?: string) => {
      if (isPurgingRef.current || hasPurgedRef.current) return;
      isPurgingRef.current = true;
      try {
        try {
          await AsyncStorage.clear();
        } catch (purgeErr) {}

        try {
          const dir = getScreenshotDir();
          if (dir) {
            const directory = new Directory(dir);
            if (directory.exists) {
              await directory.delete();
            }
            await directory.create();
          }
        } catch (e) {}

        const newTab = createHomeTab(network);
        setTabs([newTab]);
        setActiveTabId(newTab.id);
        setAddressBarValue(newTab.url, { ensureStartVisible: true });
        setShowTabsOverview(false);

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

        await AsyncStorage.setItem(BROWSER_CONSTANTS.STORAGE.TABS_KEY, JSON.stringify({ version: 1, tabs: storedTabs }));
        await AsyncStorage.setItem(BROWSER_CONSTANTS.STORAGE.ACTIVE_TAB_KEY, activeId);
      } catch (error) {
        await purgeAndReset('saveTabs error');
      }
    },
    [purgeAndReset]
  );

  const screenshots = useWebViewPreviewManager(purgeAndReset);

  const loadTabs = useCallback(async (): Promise<{ tabs: BrowserTab[]; activeTabId: string } | null> => {
    try {
      const tabsJson = await AsyncStorage.getItem(BROWSER_CONSTANTS.STORAGE.TABS_KEY);
      const activeId = await AsyncStorage.getItem(BROWSER_CONSTANTS.STORAGE.ACTIVE_TAB_KEY);

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

      return { tabs, activeTabId: finalActiveId };
    } catch (error) {
      await purgeAndReset('loadTabs error');
      return null;
    }
  }, [purgeAndReset]);

  const captureTabScreenshot = useCallback(
    async (tabId: string, delay: number = BROWSER_CONSTANTS.TIMEOUTS.SCREENSHOT_DELAY): Promise<string | null> => {
      // Wait for delay before attempting capture
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      // Check if ref is ready, with retry logic
      let containerRef = tabContainerRefs.current[tabId];
      if (!containerRef?.current) {
        // Wait a bit for ref to be set
        await new Promise((resolve) => setTimeout(resolve, 100));
        containerRef = tabContainerRefs.current[tabId];

        if (!containerRef?.current) {
          return null;
        }
      }

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
        return null;
      }
    },
    [screenshots]
  );

  const ensureTabPreview = useCallback(
    async (tabId: string, forceReload = false) => {
      let shouldProceed = false;
      let hasScreenshot = false;

      setTabs((prev) => {
        const tab = prev.find((t) => t.id === tabId);
        shouldProceed = !!tab;
        hasScreenshot = !!tab?.screenshot;
        return prev;
      });

      if (!shouldProceed || (hasScreenshot && !forceReload)) {
        return;
      }

      // Try to load from storage first
      const storedScreenshot = await screenshots.load(tabId);
      if (storedScreenshot) {
        setTabs((prev) => {
          const stillExists = prev.find((t) => t.id === tabId);
          if (!stillExists) return prev;

          return prev.map((currentTab) =>
            currentTab.id === tabId
              ? {
                  ...currentTab,
                  screenshot: storedScreenshot,
                }
              : currentTab
          );
        });
      } else {
        // If no stored screenshot, mark tab as needing one and trigger reload
        if (!tabsNeedingScreenshotsRef.current.has(tabId)) {
          tabsNeedingScreenshotsRef.current.add(tabId);

          // Try forcing the WebView to load by triggering a reload
          const webviewRef = tabWebViewRefs.current[tabId];
          if (webviewRef?.current) {
            webviewRef.current.reload();
          }
        }
      }
    },
    [screenshots]
  );

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
        const initialTab = createHomeTab(network);
        setTabs([initialTab]);
        setActiveTabId(initialTab.id);
        setAddressBarValue(initialTab.url, { ensureStartVisible: true });
      }

      setIsRestoringTabs(false);
    };

    restoreTabs();
  }, [network, loadTabs, setAddressBarValue]);

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
        loadingScreenshotsRef.current.delete(tabId);
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
        return;
      }

      const existingTab = tabs.find((tab) => tab.url === params.url);
      if (!existingTab) {
        const newTab = createBrowserTab(params.url!);
        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(newTab.id);
        setAddressBarValue(newTab.url, { ensureStartVisible: true });
      }
    }
  }, [params.url, isRestoringTabs, tabs, setAddressBarValue]);

  const redirectActiveTabToHome = () => {
    const homeUrl = getHomeUrl(network);
    const homeTitle = 'layerztec.github.io';

    updateActiveTab({
      url: homeUrl,
      title: homeTitle,
      history: [{ url: homeUrl, title: homeTitle }],
      historyIndex: 0,
      canGoBack: false,
      canGoForward: false,
    });
    setAddressBarValue(homeUrl, { ensureStartVisible: true });
  };

  const createNewTab = async () => {
    if (activeTabId) {
      await captureTabScreenshot(activeTabId, 50).catch((error) => handleError(error, 'captureTabScreenshot'));
    }

    const newTab = createHomeTab(network);

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setAddressBarValue(newTab.url, { ensureStartVisible: true });

    if (showTabsOverview) {
      hideTabsOverview();
    }
  };

  const closeTab = (tabId: string) => {
    screenshots.remove(tabId);

    if (tabs.length === 1) {
      const newTab = createHomeTab(network);
      setTabs([newTab]);
      setActiveTabId(newTab.id);
      setAddressBarValue(newTab.url, { ensureStartVisible: true });
      return;
    }

    const newTabs = tabs.filter((tab) => tab.id !== tabId);
    setTabs(newTabs);

    if (activeTabId === tabId) {
      const newActiveTab = newTabs[newTabs.length - 1];

      setActiveTabId(newActiveTab.id);
      setAddressBarValue(newActiveTab.url, { ensureStartVisible: true });
    }

    if (newTabs.length === 1 && showTabsOverview) {
      hideTabsOverview();
    }
  };

  const switchTab = async (tabId: string) => {
    if (activeTabId === tabId) {
      hideTabsOverview();
      return;
    }

    if (addressInputRef.current?.isFocused()) {
      addressInputRef.current.blur();
      setIsAddressInputFocused(false);
    }

    // Capture screenshot of current active tab before switching
    if (activeTabId) {
      await captureTabScreenshot(activeTabId, 50).catch((error) => handleError(error, 'captureTabScreenshot'));
    }

    setActiveTabId(tabId);
    const newTab = tabs.find((t) => t.id === tabId);
    if (newTab) {
      setAddressBarValue(newTab.url, { ensureStartVisible: true });
    }

    hideTabsOverview();
  };

  const showTabsOverviewAnimated = async () => {
    setShowTabsOverview(true);

    webviewOpacity.value = withTiming(0, { duration: BROWSER_CONSTANTS.ANIMATION.STANDARD });
    tabsOpacity.value = withTiming(1, { duration: BROWSER_CONSTANTS.ANIMATION.STANDARD });
    addressBarTranslateY.value = withTiming(-120, { duration: BROWSER_CONSTANTS.ANIMATION.STANDARD });

    // Capture current tab screenshot
    if (activeTabId) {
      captureTabScreenshot(activeTabId).catch((error) => handleError(error, 'captureTabScreenshot'));
    }

    // Ensure all tabs have screenshots (stagger to avoid overwhelming the system)
    tabs.forEach((tab, index) => {
      if (!tab.screenshot) {
        setTimeout(
          () => {
            ensureTabPreview(tab.id, false).catch((error) => handleError(error, 'ensureTabPreview'));
          },
          500 + index * 300
        ); // Start after 500ms, then 300ms delay between each tab
      }
    });
  };

  const hideTabsOverview = () => {
    webviewOpacity.value = withTiming(1, { duration: BROWSER_CONSTANTS.ANIMATION.FAST });
    tabsOpacity.value = withTiming(0, { duration: BROWSER_CONSTANTS.ANIMATION.FAST });
    addressBarTranslateY.value = withTiming(0, { duration: BROWSER_CONSTANTS.ANIMATION.FAST }, (finished) => {
      if (finished) {
        runOnJS(setShowTabsOverview)(false);
      }
    });
  };

  const toggleTabsOverview = () => {
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
          const newTab = createHomeTab(network);

          setTabs([newTab]);
          setActiveTabId(newTab.id);
          setAddressBarValue(newTab.url, { ensureStartVisible: true });
          if (showTabsOverview) {
            hideTabsOverview();
          }
        },
      },
    ]);
  };

  const updateActiveTab = (updates: Partial<BrowserTab>) => {
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

      progressWidth.value = withTiming(progress, { duration: BROWSER_CONSTANTS.ANIMATION.INSTANT }, (finished) => {
        if (finished && progress >= 1) {
          progressOpacity.value = withTiming(0, { duration: BROWSER_CONSTANTS.ANIMATION.STANDARD });

          setTimeout(async () => {
            if (activeTabId) {
              await captureTabScreenshot(activeTabId, BROWSER_CONSTANTS.TIMEOUTS.SCREENSHOT_DELAY);
            }
          }, BROWSER_CONSTANTS.TIMEOUTS.POST_LOAD_CAPTURE);
        }
      });
    },
    [progressWidth, progressOpacity, activeTabId, captureTabScreenshot]
  );

  const handleInactiveTabLoad = useCallback(
    async (tabId: string) => {
      // Check if this tab needs a screenshot
      if (tabsNeedingScreenshotsRef.current.has(tabId)) {
        tabsNeedingScreenshotsRef.current.delete(tabId);
        // Wait a bit for the page to render
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await captureTabScreenshot(tabId, 0);
      }
    },
    [captureTabScreenshot]
  );

  const handleNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      if (isManualNavigation.current || lastManualNavigationUrl.current === navState.url) {
        isManualNavigation.current = false;
        lastManualNavigationUrl.current = undefined;
        return;
      }

      const title = getTabTitle(navState.url);

      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id !== activeTabId) return tab;

          if (tab.url === navState.url) {
            return tab;
          }

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
        <View style={styles.loadingContainer} testID="DappBrowserLoading">
          <ThemedText style={styles.loadingText}>Loading DApp browser...</ThemedText>
        </View>
      </GradientScreen>
    );
  }

  return (
    <GestureHandlerRootView style={styles.gestureRootView}>
      <Stack.Screen options={{ headerShown: false }} />

      <Animated.View style={[styles.modalContainer, styles.modalMaxHeight, modalAnimatedStyle]}>
        <GradientScreen variant={network}>
          <GestureDetector gesture={panGesture}>
            <Animated.View style={addressBarAnimatedStyle} pointerEvents={showTabsOverview ? 'none' : 'auto'}>
              <View style={styles.addressContainer}>
                <Pressable style={styles.networkButton} onPress={redirectActiveTabToHome}>
                  <ExpoImage source={getNetworkImageAsset(network)} style={styles.networkIcon} contentFit="contain" />
                </Pressable>
                <View style={styles.addressBarWrapper}>
                  <View style={styles.addressBar}>
                    <TextInput
                      ref={addressInputRef}
                      style={styles.addressText}
                      value={addressInput}
                      selection={isAddressInputFocused ? undefined : selectionAtStart}
                      onChangeText={setAddressInput}
                      onFocus={() => {
                        setIsAddressInputFocused(true);
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
                      testID="DappBrowserAddressBar"
                    />
                    {isAddressInputFocused ? (
                      <Pressable style={styles.stopButton} onPress={() => setAddressInput('')}>
                        <Ionicons name="close-circle" size={20} color="rgba(255, 255, 255, 0.8)" />
                      </Pressable>
                    ) : isLoading ? (
                      <Pressable style={styles.stopButton} onPress={stopLoading} testID="BrowserStopButton">
                        <Ionicons name="close-circle" size={20} color="rgba(255, 255, 255, 0.8)" />
                      </Pressable>
                    ) : (
                      <Pressable style={styles.stopButton} onPress={onRefresh} testID="BrowserRefreshButton">
                        <Ionicons name="reload" size={18} color="rgba(255, 255, 255, 0.8)" />
                      </Pressable>
                    )}
                  </View>
                  <Animated.View style={[styles.progressBar, progressBarAnimatedStyle]} />
                </View>
                <Pressable style={styles.closeButton} onPress={() => router.back()} testID="BrowserCloseButton">
                  <Ionicons name="close" size={20} color={isAddressInputFocused ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.9)'} />
                </Pressable>
              </View>
            </Animated.View>
          </GestureDetector>

          <View style={styles.contentContainer}>
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
                          }
                        }
                      }}
                      collapsable={false}
                      style={containerStyles}
                    >
                      {tab.screenshot && <Image source={{ uri: tab.screenshot }} style={styles.absoluteFill} resizeMode="cover" />}
                      <WebView
                        key={`webview-${tab.id}`}
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
                        onLoadEnd={
                          !isActive
                            ? () => {
                                handleInactiveTabLoad(tab.id);
                              }
                            : undefined
                        }
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
                        <Pressable style={styles.navButton} onPress={goBack}>
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
                        </Pressable>
                      </Link>
                    ) : (
                      <Pressable style={styles.navButton} onPress={goBack} disabled={!activeTab?.canGoBack} testID="BrowserBackButton">
                        <Ionicons name="arrow-back" size={24} color={activeTab?.canGoBack ? 'white' : 'rgba(255, 255, 255, 0.3)'} />
                      </Pressable>
                    )}
                  </View>

                  <View style={styles.navButtonContainer}>
                    {activeTab?.canGoForward && getForwardHistory().length > 0 ? (
                      <Link href="/DAppBrowser" asChild>
                        <Pressable style={styles.navButton} onPress={goForward}>
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
                        </Pressable>
                      </Link>
                    ) : (
                      <Pressable style={styles.navButton} onPress={goForward} disabled={!activeTab?.canGoForward} testID="BrowserForwardButton">
                        <Ionicons name="arrow-forward" size={24} color={activeTab?.canGoForward ? 'white' : 'rgba(255, 255, 255, 0.3)'} />
                      </Pressable>
                    )}
                  </View>
                </>
              )}
            </View>

            <View style={styles.navigationCenter}>
              <Pressable style={styles.addTabButton} onPress={createNewTab} testID="BrowserAddTabButton">
                <Ionicons name="add" size={24} color="white" />
              </Pressable>
            </View>

            <View style={styles.navigationRight}>
              <View style={styles.navButtonContainer}>
                <View style={styles.navButton} />
              </View>
              <View style={styles.navButtonContainer}>
                <Pressable style={styles.navButton} onPress={toggleTabsOverview} onLongPress={handleCloseAllTabs} testID="BrowserTabsOverviewButton">
                  <View style={styles.tabsOverviewIcon}>
                    <ThemedText style={styles.tabsCount}>{tabs.length}</ThemedText>
                  </View>
                </Pressable>
              </View>
            </View>
          </View>
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
    height: BROWSER_CONSTANTS.MODAL.MAX_HEIGHT,
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
