import { Asset } from 'expo-asset';
import Pressable from '../components/Pressable';
import * as FileSystem from 'expo-file-system';
import { File as ExpoFsFile, Directory } from 'expo-file-system';
import React, { useCallback, useContext, useEffect, useRef, useState, useMemo } from 'react';
import { StyleSheet, View, Alert, TextInput, PanResponder, Image, AppState, AppStateStatus, ViewStyle, StyleProp, Dimensions, BackHandler } from 'react-native';
import WebView, { WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import type { WebViewErrorEvent, WebViewNavigationEvent } from 'react-native-webview/lib/WebViewTypes';
import { Stack, useLocalSearchParams, useRouter, Link, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as ExpoImage } from 'expo-image';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, withSpring, interpolate, runOnJS } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/ThemedText';
import { BrowserBridge } from '@/src/class/browser-bridge';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useFocusEffect } from '@react-navigation/native';
import { NETWORK_BITCOIN, NETWORK_BOTANIX, NETWORK_CITREA, NETWORK_ROOTSTOCK, NETWORK_LIGHTNING, NETWORK_SPARK, NETWORK_ARK } from '@shared/types/networks';
import { getNetworkImageAsset } from '@/utils/networkAssets';
import { ActionPopupButton } from '@/components/ActionPopupButton';
import { DAppBrowserTabs } from './DAppBrowserTabs';
import { useWebViewPreviewManager } from './hooks/useWebViewPreviewManager';
import PlatformBlurView from '@/components/PlatformBlurView';
import ExplorerContent, { ExplorerCategory } from '@/components/Explorer/ExplorerContent';
import { getPartnersList } from '@shared/models/partners-list';
import type { PartnerInfo } from '@shared/types/partner-info';

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
    POST_LOAD_CAPTURE: 1500,
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
    AUTOFILL_BTC_DISABLED_KEY: '@browser_autofill_btc_disabled',
  },
} as const;

const homeIcon = require('@/assets/images/home.svg');

const getTabTitle = (url: string): string => {
  try {
    const { hostname } = new URL(url);
    return hostname.replace('www.', '');
  } catch {
    return url.length > 30 ? url.substring(0, 30) + '...' : url;
  }
};

const BLANK_TAB_URL = 'https://google.com';

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
  const { accountNumber } = useContext(AccountNumberContext);
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
  const [viewMode, setViewMode] = useState<'explorer' | 'browser'>(() => (params.url ? 'browser' : 'explorer'));
  const [explorerCategory, setExplorerCategory] = useState<ExplorerCategory>('all');
  const viewModeRef = useRef(viewMode);
  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);
  const explorerPlaceholder = 'Search on Bitcoin';
  const initialUrl = params.url || '';
  const [tabs, setTabs] = useState<BrowserTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [isRestoringTabs, setIsRestoringTabs] = useState<boolean>(true);
  const [addressInput, setAddressInput] = useState<string>(() => (params.url ? initialUrl : ''));
  const [showTabsOverview, setShowTabsOverview] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAddressInputFocused, setIsAddressInputFocused] = useState(false);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [btcAddress, setBtcAddress] = useState<string>('');
  const [autofillEnabled, setAutofillEnabled] = useState<boolean>(true);

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
  const addressSuggestions = useMemo(() => {
    const query = addressInput.trim().toLowerCase();
    if (!query) return [];

    const entries = tabs.flatMap((tab) => tab.history || []);
    const unique = new Map<string, string>();

    for (const item of entries) {
      if (!item?.url) continue;
      if (!unique.has(item.url)) {
        unique.set(item.url, item.url);
      }
    }

    return Array.from(unique.keys())
      .filter((url) => url.toLowerCase().includes(query))
      .slice(0, 6);
  }, [addressInput, tabs]);

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
    .enabled(false)
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
      // Tabs overlay has its own header; keep native header hidden to avoid double headers.
      headerShown: false,
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => subscription.remove();
    }, [])
  );

  useEffect(() => {
    let cancelled = false;
    const loadBtcAddress = async () => {
      try {
        const address = await BackgroundExecutor.getAddress(NETWORK_BITCOIN, accountNumber);
        if (!cancelled) {
          setBtcAddress(address);
        }
      } catch (error) {}
    };

    loadBtcAddress();
    return () => {
      cancelled = true;
    };
  }, [accountNumber]);

  useEffect(() => {
    let cancelled = false;
    const loadAutofillSetting = async () => {
      try {
        const raw = await AsyncStorage.getItem(BROWSER_CONSTANTS.STORAGE.AUTOFILL_BTC_DISABLED_KEY);
        if (cancelled) return;
        setAutofillEnabled(raw !== 'true');
      } catch (error) {
        setAutofillEnabled(true);
      }
    };

    loadAutofillSetting();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (viewMode !== 'browser') return;
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const [{ localUri }] = await Asset.loadAsync(require('assets/js/inpage-bridge.jstxt'));

        if (!localUri) {
          throw new Error('Bridge asset URI is undefined');
        }

        const bridgeFile = new ExpoFsFile(localUri);
        const bridgeScript = await bridgeFile.text();

        const rebrandScript = `
;(function() {
  var T = 'Browser Wallet';
  var R = 'LAYERZ WALLET';
  var LOGO = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMS42NjggLTQuNDc0IDM4LjY3NiAzOC42NzYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0yMS44NTYyIDE5LjQxODVIMy4zOTg3QzEuODUwNjkgMTkuNDE4NSAxLjA2ODM5IDE3LjUxMjEgMi4xNDkzOSAxNi4zODE5TDEzLjQxNDUgNC41OTk0NUMxNC41MTQ1IDMuNDQ5ODIgMTYuMDE5OCAyLjgwMjI0IDE3LjU5MTUgMi44MDIyNEgzNi4wNDlDMzcuNTk3IDIuODAyMjQgMzguMzc5MyA0LjcwODU4IDM3LjI5ODMgNS44Mzg4MUwyNi4wMzMyIDE3LjYyMTNDMjQuOTMzMyAxOC43NzA5IDIzLjQyNzkgMTkuNDE4NSAyMS44NTYyIDE5LjQxODVaIiBmaWxsPSJ1cmwoI3BhaW50MF9saW5lYXJfNTUwXzMxOTEpIi8+CjxwYXRoIGQ9Ik0yMC4wNDIxIDEwLjMwODRIMzguNDk5NkM0MC4wNDc2IDEwLjMwODQgNDAuODI5OSAxMi4yMTQ3IDM5Ljc0ODkgMTMuMzQ0OUwyOC40ODM4IDI1LjEyNzRDMjcuMzgzOSAyNi4yNzcgMjUuODc4NSAyNi45MjQ2IDI0LjMwNjggMjYuOTI0Nkg1Ljg0OTI5QzQuMzAxMjkgMjYuOTI0NiAzLjUxODk5IDI1LjAxODIgNC41OTk5OCAyMy44ODhMMTUuODY1MSAxMi4xMDU2QzE2Ljk2NTEgMTAuOTU1OSAxOC40NzA0IDEwLjMwODQgMjAuMDQyMSAxMC4zMDg0WiIgZmlsbD0idXJsKCNwYWludDFfbGluZWFyXzU1MF8zMTkxKSIvPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJwYWludDBfbGluZWFyXzU1MF8zMTkxIiB4MT0iMS42Njc3MiIgeTE9IjE5LjI1MjgiIHgyPSIzOC4xMzA1IiB5Mj0iNC41OTQ2MiIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPgo8c3RvcCBzdG9wLWNvbG9yPSIjRkYwMDA0IiBzdG9wLW9wYWNpdHk9IjAiLz4KPHN0b3Agb2Zmc2V0PSIwLjg1IiBzdG9wLWNvbG9yPSIjRkYwMDA0Ii8+CjwvbGluZWFyR3JhZGllbnQ+CjxsaW5lYXJHcmFkaWVudCBpZD0icGFpbnQxX2xpbmVhcl81NTBfMzE5MSIgeDE9IjQwLjM0MzIiIHkxPSIxMC40MzA2IiB4Mj0iMy44ODA0IiB5Mj0iMjUuMDg4OCIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPgo8c3RvcCBzdG9wLWNvbG9yPSIjRkYwMDA0IiBzdG9wLW9wYWNpdHk9IjAiLz4KPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjRkYwMDA0Ii8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPC9zdmc+Cg==';
  function replaceImgSrc(el) {
    el.setAttribute('src', LOGO);
    if (el.hasAttribute('srcset')) el.removeAttribute('srcset');
    if (el.hasAttribute('href')) el.setAttribute('href', LOGO);
    if (el.hasAttribute('xlink:href')) el.setAttribute('xlink:href', LOGO);
  }
  function fixImg(n) {
    var p = n.parentNode;
    while (p && p !== document.body && p !== document.documentElement) {
      if (p.nodeType === 1) {
        var imgs = p.querySelectorAll('img, image, svg image');
        if (imgs.length > 0) {
          for (var k = 0; k < imgs.length; k++) replaceImgSrc(imgs[k]);
          return true;
        }
      }
      p = p.parentNode;
    }
    return false;
  }
  function fix(n) {
    if (n.nodeValue && n.nodeValue.indexOf(T) !== -1) {
      n.nodeValue = n.nodeValue.split(T).join(R);
      if (!fixImg(n)) {
        setTimeout(function() { fixImg(n); }, 300);
        setTimeout(function() { fixImg(n); }, 1000);
      }
    }
  }
  function walk(root) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var n; while (n = w.nextNode()) fix(n);
  }
  var obs = new MutationObserver(function(muts) {
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i];
      if (m.type === 'characterData') { fix(m.target); continue; }
      for (var j = 0; j < m.addedNodes.length; j++) {
        var a = m.addedNodes[j];
        if (a.nodeType === 3) fix(a);
        else if (a.nodeType === 1) walk(a);
      }
    }
  });
  function start() {
    var el = document.documentElement || document.body;
    if (el) { obs.observe(el, { childList: true, subtree: true, characterData: true }); walk(el); }
  }
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();`;

        setJs(bridgeScript + rebrandScript);
      } catch (error: any) {
        setError('Failed to load DApp browser script: ' + error.message);
      }
    })();
  }, [viewMode, network, setAddressBarValue]);

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

        setTabs([]);
        setActiveTabId('');
        setAddressInput('');
        setViewMode('explorer');
        setShowTabsOverview(false);

        hasPurgedRef.current = true;
      } finally {
        isPurgingRef.current = false;
      }
    },
    [setAddressBarValue]
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

      // Check if ref is ready, with small bounded retry (mount/layout race)
      const retryDelaysMs = [100, 200, 400];
      let containerRef = tabContainerRefs.current[tabId];
      for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
        if (containerRef?.current) break;
        if (attempt === retryDelaysMs.length) return null;
        await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt]));
        containerRef = tabContainerRefs.current[tabId];
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
                  timestamp: Date.now(),
                }
              : currentTab
          );
        });
        return;
      } else {
        // If we already have a screenshot, don't force a reload/capture just because the manifest is missing.
        // This avoids replacing a working image with a failing one.
        if (hasScreenshot) {
          return;
        }

        // If no stored screenshot, mark tab as needing one and trigger reload
        if (!tabsNeedingScreenshotsRef.current.has(tabId)) {
          tabsNeedingScreenshotsRef.current.add(tabId);

          // Try a short capture attempt first (sometimes reload isn't needed)
          setTimeout(() => {
            captureTabScreenshot(tabId, 0).catch(() => {});
          }, 300);

          // Then try forcing the WebView to load by triggering a reload (fallback)
          const webviewRef = tabWebViewRefs.current[tabId];
          if (webviewRef?.current) {
            webviewRef.current.reload();
          }
        }
      }
    },
    [screenshots, captureTabScreenshot]
  );

  const invalidateTabPreview = useCallback((tabId: string) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, screenshot: undefined, timestamp: Date.now() } : t)));
  }, []);

  useEffect(() => {
    const restoreTabs = async () => {
      const restored = await loadTabs();

      if (restored && restored.tabs.length > 0) {
        setTabs(restored.tabs);
        setActiveTabId(restored.activeTabId);
        const activeTab = restored.tabs.find((t) => t.id === restored.activeTabId);
        if (activeTab) {
          if (viewModeRef.current === 'browser') {
            setAddressBarValue(activeTab.url, { ensureStartVisible: true });
          } else {
            setAddressInput('');
          }
        }
      } else {
        setTabs([]);
        setActiveTabId('');
        setAddressInput('');
      }

      setIsRestoringTabs(false);
    };

    restoreTabs();
  }, [loadTabs, setAddressBarValue]);

  useEffect(() => {
    if (isRestoringTabs) return;
    if (tabs.length > 0 && activeTabId) {
      saveTabs(tabs, activeTabId);
      return;
    }
    void AsyncStorage.multiRemove([BROWSER_CONSTANTS.STORAGE.TABS_KEY, BROWSER_CONSTANTS.STORAGE.ACTIVE_TAB_KEY]);
  }, [tabs, activeTabId, isRestoringTabs, saveTabs]);

  useEffect(() => {
    if (!addressInput.trim()) {
      setShowAddressSuggestions(false);
    }
  }, [addressInput]);

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
      if (viewMode !== 'browser') return;
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        if (activeTabId) {
          await captureTabScreenshot(activeTabId);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [activeTabId, captureTabScreenshot, viewMode]);

  useEffect(() => {
    if (params.url && !isRestoringTabs && lastHandledUrl.current !== params.url) {
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

  const handleHomePress = () => {
    // "Home" should always go to Explorer-only.
    setViewMode('explorer');
    setAddressInput('');
    setShowTabsOverview(false);
    setShowAddressSuggestions(false);
    setIsAddressInputFocused(false);
    addressInputRef.current?.blur();
  };

  const openWebAppInNewTab = async (url: string) => {
    if (!url) return;

    // Explorer UX: submitting/opening should dismiss keyboard.
    if (addressInputRef.current?.isFocused()) {
      addressInputRef.current.blur();
    }
    setIsAddressInputFocused(false);
    setShowAddressSuggestions(false);

    // If we're already in browser mode, capture the current tab preview before switching.
    if (viewMode === 'browser' && activeTabId) {
      await captureTabScreenshot(activeTabId, 50).catch((error) => globalThis.handleError?.(error, 'captureTabScreenshot'));
    }

    const newTab = createBrowserTab(url);
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setShowAddressSuggestions(false);
    setShowTabsOverview(false);

    setAddressBarValue(newTab.url, { ensureStartVisible: true });
    setViewMode('browser');
  };

  const createNewTab = async () => {
    if (viewModeRef.current !== 'browser') {
      setViewMode('browser');
    }
    if (addressInputRef.current?.isFocused()) {
      addressInputRef.current.blur();
    }
    setIsAddressInputFocused(false);
    setShowAddressSuggestions(false);
    if (activeTabId) {
      await captureTabScreenshot(activeTabId, 50).catch((error) => globalThis.handleError?.(error, 'captureTabScreenshot'));
    }

    const newTab = createBrowserTab(BLANK_TAB_URL);

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setAddressBarValue(newTab.url, { ensureStartVisible: true });

    if (showTabsOverview) {
      hideTabsOverview();
    }
  };

  const closeTab = (tabId: string) => {
    if (viewModeRef.current !== 'browser') {
      setViewMode('browser');
    }
    if (addressInputRef.current?.isFocused()) {
      addressInputRef.current.blur();
    }
    setIsAddressInputFocused(false);
    setShowAddressSuggestions(false);
    screenshots.remove(tabId);

    if (tabs.length === 1) {
      setTabs([]);
      setActiveTabId('');
      setAddressInput('');
      setViewMode('explorer');
      if (showTabsOverview) {
        hideTabsOverview();
      }
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
    if (viewModeRef.current !== 'browser') {
      setViewMode('browser');
    }
    if (addressInputRef.current?.isFocused()) {
      addressInputRef.current.blur();
    }
    setIsAddressInputFocused(false);
    setShowAddressSuggestions(false);
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
      await captureTabScreenshot(activeTabId, 50).catch((error) => globalThis.handleError?.(error, 'captureTabScreenshot'));
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

    // Capture current tab screenshot only if missing (don't replace an existing preview on overlay open)
    if (activeTabId) {
      const active = tabs.find((t) => t.id === activeTabId);
      if (!active?.screenshot) {
        captureTabScreenshot(activeTabId).catch((error) => globalThis.handleError?.(error, 'captureTabScreenshot'));
      }
    }

    // Refresh previews for the first visible cards (helps after cache prune / restore)
    const topN = 6;
    tabs.slice(0, topN).forEach((tab, index) => {
      if (tab.screenshot) return;
      setTimeout(
        () => {
          ensureTabPreview(tab.id, false).catch((error) => globalThis.handleError?.(error, 'ensureTabPreview'));
        },
        250 + index * 200
      );
    });

    // Ensure all tabs have screenshots (stagger to avoid overwhelming the system)
    tabs.forEach((tab, index) => {
      if (!tab.screenshot) {
        setTimeout(
          () => {
            ensureTabPreview(tab.id, false).catch((error) => globalThis.handleError?.(error, 'ensureTabPreview'));
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
          if (viewModeRef.current !== 'browser') {
            setViewMode('browser');
          }
          setTabs([]);
          setActiveTabId('');
          setAddressInput('');
          setViewMode('explorer');
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

  const handleSuggestionSelect = (url: string) => {
    setAddressBarValue(url, { ensureStartVisible: true });
    updateActiveTab({ url, title: getTabTitle(url) });
    setShowAddressSuggestions(false);
    if (addressInputRef.current?.isFocused()) {
      addressInputRef.current.blur();
      setIsAddressInputFocused(false);
    }
  };

  const stopLoading = () => {
    webviewRef.current?.stopLoading();
    setIsLoading(false);
  };

  const onRefresh = () => {
    webviewRef.current?.reload();
  };

  const goBack = () => {
    if (viewMode !== 'browser') return;
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

  const injectAutofillScript = useCallback((address: string) => {
    const script = `
      (function() {
        try {
          var address = ${JSON.stringify(address)};

          var findMatch = function() {
            var fields = Array.prototype.slice.call(document.querySelectorAll('input, textarea'));
            var candidates = fields.filter(function(input) {
              var type = (input.getAttribute('type') || 'text').toLowerCase();
              if (input.tagName === 'INPUT' && type && ['text', 'tel', 'url'].indexOf(type) === -1) return false;
              if (input.disabled || input.readOnly) return false;
              return true;
            });
            return candidates.find(function(input) {
              var hint = [input.placeholder, input.name, input.id, input.getAttribute('aria-label')].filter(Boolean).join(' ').toLowerCase();
              var hasBitcoinHint = /btc|bitcoin|address|bc1/i.test(hint);
              return (!!hasBitcoinHint);
            }) || null;
          };

          var setValue = function(el, value) {
            var prototype = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
            var descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
            if (descriptor && descriptor.set) {
              descriptor.set.call(el, value);
            } else {
              el.value = value;
            }
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          };

          var applyIfEmpty = function() {
            var match = findMatch();
            if (match && !match.value) {
              setValue(match, address);
            }
          };

          if (!window.__lwBtcManager) {
            window.__lwBtcManager = { observer: null };
            var observer = new MutationObserver(function() {
              applyIfEmpty();
            });
            observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
            window.__lwBtcManager.observer = observer;
          }

          applyIfEmpty();

          var start = Date.now();
          var interval = setInterval(function() {
            applyIfEmpty();
            if (Date.now() - start > 8000) {
              clearInterval(interval);
            }
          }, 500);
        } catch (e) {}
      })();
      true;
    `;

    webviewRef.current?.injectJavaScript(script);
  }, []);

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

  const handleActiveTabLoadEnd = useCallback(
    (_event: WebViewNavigationEvent | WebViewErrorEvent) => {
      if (autofillEnabled && btcAddress) {
        injectAutofillScript(btcAddress);
        setTimeout(() => {
          injectAutofillScript(btcAddress);
        }, 1500);
      }
    },
    [autofillEnabled, btcAddress, injectAutofillScript]
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

  if (error && viewMode === 'browser') {
    return (
      <SafeAreaView style={styles.blackScreen} edges={['top', 'left', 'right']}>
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (!js && viewMode === 'browser') {
    return (
      <SafeAreaView style={styles.blackScreen} edges={['top', 'left', 'right']}>
        <View style={styles.loadingContainer} testID="DappBrowserLoading">
          <ThemedText style={styles.loadingText}>Loading DApp browser...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.gestureRootView}>
      <Stack.Screen options={{ headerShown: false }} />

      <Animated.View style={[styles.modalContainer, styles.modalMaxHeight, modalAnimatedStyle]}>
        <SafeAreaView style={styles.blackScreen} edges={['top', 'left', 'right']}>
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.addressBarContainer, addressBarAnimatedStyle]} pointerEvents={showTabsOverview ? 'none' : 'auto'}>
              <View style={styles.addressContainer}>
                <Pressable style={styles.networkButton} onPress={handleHomePress} testID="BrowserHomeButton">
                  <ExpoImage source={homeIcon} style={styles.homeIcon} contentFit="contain" />
                </Pressable>
                <View style={styles.addressBarWrapper}>
                  <View style={styles.addressBar}>
                    <Pressable
                      style={styles.addressBackButton}
                      onPress={goBack}
                      disabled={viewMode !== 'browser' || !activeTab?.canGoBack || showTabsOverview || isAddressInputFocused}
                      testID="BrowserBackButton"
                    >
                      <Ionicons name="arrow-back" size={18} color={activeTab?.canGoBack && !showTabsOverview && !isAddressInputFocused ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.3)'} />
                    </Pressable>
                    <TextInput
                      ref={addressInputRef}
                      style={styles.addressText}
                      value={addressInput}
                      selection={isAddressInputFocused ? undefined : selectionAtStart}
                      onChangeText={(value) => {
                        setAddressInput(value);
                        setShowAddressSuggestions(true);
                      }}
                      onFocus={() => {
                        setIsAddressInputFocused(true);
                        setShowAddressSuggestions(true);
                      }}
                      onBlur={() => {
                        setIsAddressInputFocused(false);
                        setShowAddressSuggestions(false);
                        if (viewMode === 'browser' && activeTab?.url) {
                          setAddressBarValue(activeTab.url, { ensureStartVisible: true });
                        }
                      }}
                      onSubmitEditing={() => {
                        if (viewMode === 'explorer') {
                          const raw = addressInput.trim();
                          if (!raw) return;

                          // If the user typed a URL, open it directly (keeps browser behavior intact).
                          let urlCandidate = raw;
                          if (!urlCandidate.startsWith('http://') && !urlCandidate.startsWith('https://')) {
                            urlCandidate = 'https://' + urlCandidate;
                          }
                          if (isValidUrl(urlCandidate)) {
                            void openWebAppInNewTab(urlCandidate);
                            return;
                          }

                          // Otherwise treat it as an app search and open the first match.
                          const q = raw.toLowerCase();
                          const partners = [
                            ...getPartnersList(NETWORK_BITCOIN),
                            ...getPartnersList(NETWORK_BOTANIX),
                            ...getPartnersList(NETWORK_ROOTSTOCK),
                            ...getPartnersList(NETWORK_CITREA),
                            ...getPartnersList(NETWORK_LIGHTNING),
                            ...getPartnersList(NETWORK_SPARK),
                            ...getPartnersList(NETWORK_ARK),
                          ];
                          const first = partners.find((p) => `${p.name} ${p.description ?? ''}`.toLowerCase().includes(q));
                          if (first?.url) {
                            void openWebAppInNewTab(first.url);
                          }
                          return;
                        }

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
                      keyboardType={viewMode === 'explorer' ? 'default' : 'url'}
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder={viewMode === 'explorer' ? explorerPlaceholder : 'Enter URL'}
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      selectTextOnFocus={true}
                      testID="DappBrowserAddressBar"
                    />
                    {isAddressInputFocused ? (
                      <Pressable
                        style={styles.stopButton}
                        onPress={() => {
                          setAddressInput('');
                          setIsAddressInputFocused(false);
                          setShowAddressSuggestions(false);
                          addressInputRef.current?.blur();
                        }}
                      >
                        <Ionicons name="close-circle" size={20} color="rgba(255, 255, 255, 0.8)" />
                      </Pressable>
                    ) : isLoading ? (
                      <Pressable style={styles.stopButton} onPress={stopLoading} testID="BrowserStopButton">
                        <Ionicons name="close-circle" size={20} color="rgba(255, 255, 255, 0.8)" />
                      </Pressable>
                    ) : (
                      <View style={styles.stopButton} />
                    )}
                    {!isAddressInputFocused && (
                      <ActionPopupButton
                        title="Options"
                        actions={[
                          {
                            onClick: () => {},
                            variant: 'section',
                            children: <ThemedText style={styles.menuSectionText}>Page</ThemedText>,
                          },
                          {
                            onClick: onRefresh,
                            children: (
                              <View style={styles.menuItemContentColumn}>
                                <View style={styles.menuItemContent}>
                                  <Ionicons name="reload" size={20} color="rgba(255, 255, 255, 0.9)" />
                                  <ThemedText style={styles.menuItemText}>Refresh</ThemedText>
                                </View>
                              </View>
                            ),
                          },
                          {
                            onClick: () => {},
                            variant: 'section',
                            children: <ThemedText style={styles.menuSectionText}>Autofill</ThemedText>,
                          },
                          {
                            onClick: async () => {
                              const next = !autofillEnabled;
                              setAutofillEnabled(next);
                              await AsyncStorage.setItem(BROWSER_CONSTANTS.STORAGE.AUTOFILL_BTC_DISABLED_KEY, next ? '' : 'true');
                              if (next && btcAddress) {
                                injectAutofillScript(btcAddress);
                              }
                            },
                            children: (
                              <View style={styles.menuItemContentColumn}>
                                <View style={styles.menuItemContent}>
                                  <Ionicons name={autofillEnabled ? 'checkbox' : 'square-outline'} size={20} color="rgba(255, 255, 255, 0.9)" />
                                  <ThemedText style={styles.menuItemText}>Autofill Bitcoin Address</ThemedText>
                                </View>
                                <ThemedText style={styles.menuItemSubtitle}>Automatically fill BTC address fields on websites.</ThemedText>
                              </View>
                            ),
                          },
                          {
                            onClick: () => {},
                            variant: 'section',
                            children: <ThemedText style={styles.menuSectionText}>Clipboard</ThemedText>,
                          },
                          {
                            onClick: async () => {
                              if (!btcAddress) return;
                              await Clipboard.setStringAsync(btcAddress);
                            },
                            children: (
                              <View style={styles.menuItemContentColumn}>
                                <View style={styles.menuItemContent}>
                                  <Ionicons name="copy-outline" size={20} color="rgba(255, 255, 255, 0.9)" />
                                  <ThemedText style={styles.menuItemText}>Copy Bitcoin Address</ThemedText>
                                </View>
                                {btcAddress ? <ThemedText style={styles.menuItemSubtitle}>{btcAddress}</ThemedText> : null}
                              </View>
                            ),
                          },
                        ]}
                      >
                        <Pressable style={[styles.stopButton, styles.autofillMenuButton]} testID="BrowserAutofillMenuButton">
                          <Ionicons name="ellipsis-vertical" size={18} color="rgba(255, 255, 255, 0.8)" />
                        </Pressable>
                      </ActionPopupButton>
                    )}
                  </View>
                  <Animated.View style={[styles.progressBar, progressBarAnimatedStyle]} />
                </View>
                {!isAddressInputFocused && (
                  <Pressable
                    style={styles.topRightButton}
                    onPress={() => {
                      toggleTabsOverview();
                    }}
                    onLongPress={() => {
                      handleCloseAllTabs();
                    }}
                    testID="BrowserTabsOverviewButton"
                  >
                    <View style={styles.tabsOverviewIcon}>
                      <ThemedText style={styles.tabsCount}>{tabs.length}</ThemedText>
                    </View>
                  </Pressable>
                )}
              </View>
              {viewMode === 'browser' && !isAddressInputFocused && showAddressSuggestions && addressSuggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  {addressSuggestions.map((suggestion, index) => (
                    <Pressable
                      key={suggestion}
                      style={[styles.suggestionItem, index === addressSuggestions.length - 1 ? styles.suggestionItemLast : null]}
                      onPress={() => handleSuggestionSelect(suggestion)}
                    >
                      <ThemedText style={styles.suggestionText}>{suggestion}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              )}
            </Animated.View>
          </GestureDetector>

          {isAddressInputFocused && (
            <Pressable
              style={styles.dismissKeyboardOverlay}
              onPress={() => {
                setIsAddressInputFocused(false);
                setShowAddressSuggestions(false);
                addressInputRef.current?.blur();
              }}
            />
          )}

          <View style={styles.contentContainer}>
            <Animated.View style={[styles.webviewContainer, webviewContainerAnimatedStyle, styles.flex1]} {...(viewMode === 'browser' ? panResponder.panHandlers : {})}>
              {viewMode === 'browser' ? (
                <>
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
                              isActive
                                ? handleActiveTabLoadEnd
                                : () => {
                                    handleInactiveTabLoad(tab.id);
                                  }
                            }
                            injectedJavaScriptBeforeContentLoaded={js ?? undefined}
                            style={styles.webviewVisible}
                            incognito={false}
                            scrollEnabled={!isAddressInputFocused}
                          />
                        </View>
                      );
                    })}
                  </Animated.View>
                </>
              ) : (
                <ExplorerContent
                  category={explorerCategory}
                  query={addressInput}
                  onChangeCategory={setExplorerCategory}
                  onOpenWebApp={(url) => {
                    void openWebAppInNewTab(url);
                  }}
                />
              )}
            </Animated.View>
          </View>

          <DAppBrowserTabs
            tabs={tabs}
            activeTabId={activeTabId}
            animatedStyle={tabsOverviewAnimatedStyle}
            pointerEvents={showTabsOverview ? 'auto' : 'none'}
            isVisible={showTabsOverview}
            onSwitchTab={switchTab}
            onCloseTab={closeTab}
            getTabTitle={getTabTitle}
            onEnsurePreview={ensureTabPreview}
            onInvalidatePreview={invalidateTabPreview}
            onCloseOverview={hideTabsOverview}
          />

          {showTabsOverview && (
            <PlatformBlurView intensity={30} tint="dark" style={styles.bottomBlur}>
              <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.bottomSafeArea}>
                <View style={styles.bottomNavigation}>
                  <View style={styles.navigationLeft}>
                    <Pressable style={styles.addTabButton} onPress={createNewTab} testID="BrowserAddTabButton">
                      <Ionicons name="add" size={18} color="white" style={styles.addTabButtonIcon} />
                      <ThemedText style={styles.addTabButtonText}>Add new</ThemedText>
                    </Pressable>
                  </View>

                  <View style={styles.navigationCenter} />

                  <View style={styles.navigationRight}>
                    <Pressable style={styles.closeOverviewButton} onPress={handleCloseAllTabs} testID="BrowserTabsOverflowButton">
                      <Ionicons name="ellipsis-horizontal" size={24} color="rgba(255, 255, 255, 0.9)" />
                    </Pressable>
                  </View>
                </View>
              </SafeAreaView>
            </PlatformBlurView>
          )}
        </SafeAreaView>
      </Animated.View>
    </GestureHandlerRootView>
  );
};

export default DAppBrowser;

const styles = StyleSheet.create({
  gestureRootView: {
    flex: 1,
  },
  blackScreen: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
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
  addressBarContainer: {
    position: 'relative',
    zIndex: 2,
  },
  dismissKeyboardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  addressBarWrapper: {
    flex: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  suggestionsContainer: {
    marginHorizontal: 16,
    marginTop: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  suggestionText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
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
  addressBackButton: {
    padding: 4,
    marginRight: 8,
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
  topRightButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent',
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
  homeIcon: {
    width: 16,
    height: 16,
  },
  contentContainer: {
    flex: 1,
    position: 'relative',
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: 'black',
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
  },
  bottomSafeArea: {
    backgroundColor: 'transparent',
  },
  bottomBlur: {
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  addTabButtonIcon: {
    marginRight: 6,
  },
  addTabButtonText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.95)',
    fontWeight: '600',
  },
  closeOverviewButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.16)',
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
  menuItemText: {
    color: 'white',
    fontSize: 16,
  },
  menuItemSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginLeft: 28,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuItemContentColumn: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
  },
  menuSectionText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  autofillMenuButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
