import { Asset } from 'expo-asset';
import { readAsStringAsync } from 'expo-file-system';
import * as Linking from 'expo-linking';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Alert, TextInput } from 'react-native';
import WebView, { WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { BrowserBridge } from '@/src/class/browser-bridge';
import { BackgroundExecutor } from '@/src/modules/background-executor';

const DAppBrowser: React.FC = () => {
  const webviewRef = useRef<WebView>(null);
  const browserBridgeRef = useRef<BrowserBridge>(null);
  const [js, setJs] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const params = useLocalSearchParams<{ url?: string }>();
  const uri = params.url || 'https://metamask.github.io/test-dapp/'; // https://eip6963.org/ also useful for testing
  const [currentUrl, setCurrentUrl] = useState<string>(uri);
  const [addressInput, setAddressInput] = useState<string>(uri);
  const [canGoBack, setCanGoBack] = useState<boolean>(false);
  const [canGoForward, setCanGoForward] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const [{ localUri }] = await Asset.loadAsync(require('assets/js/inpage-bridge.jstxt'));
        const r = await readAsStringAsync(localUri || '');
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

  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    setCurrentUrl(navState.url);
    setAddressInput(navState.url);
    setCanGoBack(navState.canGoBack);
    setCanGoForward(navState.canGoForward);
  }, []);

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
      <View style={styles.errorContainer}>
        <ThemedText style={styles.errorText}>{error}</ThemedText>
      </View>
    );
  }

  if (!js) {
    return (
      <View style={styles.loadingContainer}>
        <ThemedText style={styles.loadingText}>Loading DApp browser...</ThemedText>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={[styles.iconButton, !canGoBack && styles.disabledButton]} onPress={goBack} disabled={!canGoBack}>
          <Ionicons name="arrow-back" size={16} color={canGoBack ? 'white' : '#999'} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.iconButton, !canGoForward && styles.disabledButton]} onPress={goForward} disabled={!canGoForward}>
          <Ionicons name="arrow-forward" size={16} color={canGoForward ? 'white' : '#999'} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={refresh}>
          <Ionicons name="refresh" size={16} color="white" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.unwhitelistButton]} onPress={unwhitelistCurrentDapp}>
          <ThemedText style={styles.buttonText}>unwhitelist</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.externalButton]} onPress={openInExternalBrowser}>
          <Ionicons name="open-outline" size={14} color="white" style={{ marginRight: 4 }} />
          <ThemedText style={styles.buttonText}>external</ThemedText>
        </TouchableOpacity>
      </View>

      <View style={styles.addressContainer}>
        <TextInput
          style={styles.addressInput}
          value={addressInput}
          onChangeText={setAddressInput}
          onSubmitEditing={handleAddressSubmit}
          placeholder="Enter URL..."
          placeholderTextColor="#999"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
        />
        <TouchableOpacity style={styles.goButton} onPress={navigateToAddress}>
          <ThemedText style={styles.goButtonText}>Go</ThemedText>
        </TouchableOpacity>
      </View>

      <WebView
        ref={callbackRef}
        originWhitelist={['https://*', 'http://*', 'about:blank', 'about:srcdoc']}
        allowsInlineMediaPlayback={true}
        source={{ uri }}
        onMessage={handleMessage}
        onNavigationStateChange={handleNavigationStateChange}
        injectedJavaScriptBeforeContentLoaded={js}
        webviewDebuggingEnabled={true}
      />
    </View>
  );
};

export default DAppBrowser;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 20,
  },
  header: {
    padding: 20,
    alignItems: 'center',
    flex: 1,
  },
  settingsButton: {
    padding: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
  },
  balanceContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    marginTop: 0,
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  balanceLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    opacity: 0.8,
  },
  balanceText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    width: '100%',
    marginBottom: 4,
  },
  contentContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
    padding: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
  },
  iconButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#E5E7EB',
  },
  unwhitelistButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  receiveButton: {
    backgroundColor: '#34C759',
  },
  sendButton: {
    backgroundColor: '#FF3B30',
  },
  networkContainer: {
    marginHorizontal: 20,
    marginVertical: 10,
  },
  networkCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  networkCardTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  networkIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  networkInfo: {
    flex: 1,
    gap: 4,
  },
  networkCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  networkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  networkCardSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  actionButton: {
    padding: 4,
  },
  currentNetworkText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
    flex: 1,
  },
  networkButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 4,
    marginVertical: 4,
  },
  selectedNetworkButton: {
    backgroundColor: '#007AFF',
  },
  networkButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  selectedNetworkButtonText: {
    color: 'white',
  },
  scrollContent: {
    flexGrow: 1,
  },
  testnetWarningContainer: {
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    padding: 10,
    borderRadius: 5,
    marginHorizontal: 20,
    marginVertical: 10,
  },
  testnetWarningText: {
    color: 'red',
    fontSize: 10,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  externalButton: {
    backgroundColor: '#34C759',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  addressContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 8,
  },
  addressInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
    color: '#1F2937',
  },
  goButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
