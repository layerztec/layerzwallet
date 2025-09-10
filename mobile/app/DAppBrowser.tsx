import { Asset } from 'expo-asset';
import { readAsStringAsync } from 'expo-file-system';
import * as Linking from 'expo-linking';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Alert, TextInput, Platform } from 'react-native';
import WebView, { WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedText } from '@/components/ThemedText';
import { BrowserBridge } from '@/src/class/browser-bridge';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { NetworkContext } from '@shared/hooks/NetworkContext';

export type DappBrowserProps = {
  url?: string;
};

const DAppBrowser: React.FC = () => {
  const { network } = useContext(NetworkContext);
  const webviewRef = useRef<WebView>(null);
  const browserBridgeRef = useRef<BrowserBridge>(null);
  const [js, setJs] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const params = useLocalSearchParams<DappBrowserProps>();
  const uri = params.url || 'https://layerztec.github.io/website/explore/?network=' + network; // to test: https://metamask.github.io/test-dapp/ & https://eip6963.org/
  const [currentUrl, setCurrentUrl] = useState<string>(uri);
  const [addressInput, setAddressInput] = useState<string>(uri);
  const [canGoBack, setCanGoBack] = useState<boolean>(false);
  const [canGoForward, setCanGoForward] = useState<boolean>(false);
  const [cookiesLoaded, setCookiesLoaded] = useState<boolean>(false);

  // Cookie persistence functions
  const saveCookies = useCallback(async () => {
    if (Platform.OS === 'ios') {
      try {
        // Inject JavaScript to extract all cookies from the current page
        webviewRef.current?.injectJavaScript(`
          try {
            const cookies = document.cookie.split(';').map(c => c.trim()).filter(c => c.length > 0);
            const cookieData = {};

            cookies.forEach(cookie => {
              const parts = cookie.split(';').map(p => p.trim());
              const [name, value] = parts[0].split('=');
              if (name && value) {
                cookieData[name] = {
                  name: name,
                  value: decodeURIComponent(value),
                  domain: window.location.hostname,
                  path: '/',
                  secure: window.location.protocol === 'https:',
                  httpOnly: false,
                  samesite: 'Lax'
                };

                // Parse additional attributes
                for (let i = 1; i < parts.length; i++) {
                  const [key, val] = parts[i].split('=');
                  if (key && val) {
                    const lowerKey = key.toLowerCase();
                    if (lowerKey === 'path') {
                      cookieData[name].path = val;
                    } else if (lowerKey === 'domain') {
                      cookieData[name].domain = val;
                    } else if (lowerKey === 'expires') {
                      cookieData[name].expires = val;
                    } else if (lowerKey === 'max-age') {
                      cookieData[name].expires = new Date(Date.now() + parseInt(val) * 1000).toISOString();
                    } else if (lowerKey === 'samesite') {
                      cookieData[name].samesite = val;
                    }
                  } else if (key) {
                    const lowerKey = key.toLowerCase();
                    if (lowerKey === 'secure') {
                      cookieData[name].secure = true;
                    } else if (lowerKey === 'httponly') {
                      cookieData[name].httpOnly = true;
                    }
                  }
                }
              }
            });

            console.log('Extracted cookies from page:', Object.keys(cookieData).length);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'COOKIE_DATA',
              cookies: cookieData
            }));
          } catch (e) {
            console.error('Failed to extract cookies:', e);
          }
          true;
        `);
      } catch (error) {
        console.error('Failed to save cookies:', error);
      }
    }
  }, []);

  const restoreCookies = useCallback(async () => {
    if (Platform.OS === 'ios') {
      try {
        const savedCookies = await AsyncStorage.getItem('dapp_browser_cookies');
        if (savedCookies) {
          const cookieData = JSON.parse(savedCookies);
          console.log('Cookies restored from storage:', Object.keys(cookieData).length);

          // Try to inject cookies using a more reliable method
          // We'll inject them after the page loads instead of before
          setTimeout(() => {
            if (webviewRef.current && cookieData) {
              const cookieInjectionJS = Object.values(cookieData)
                .map((cookie: any) => {
                  const expiration = cookie.expires ? `; expires=${new Date(cookie.expires).toUTCString()}` : '';
                  const secure = cookie.secure ? '; secure' : '';
                  const httpOnly = cookie.httpOnly ? '; HttpOnly' : '';
                  const sameSite = cookie.samesite ? `; SameSite=${cookie.samesite}` : '; SameSite=Lax';
                  const cookieValue = encodeURIComponent(cookie.value);
                  return `document.cookie = "${cookie.name}=${cookieValue}; path=${cookie.path || '/'}; domain=${cookie.domain}${expiration}${secure}${httpOnly}${sameSite}";`;
                })
                .join('\n');

              webviewRef.current.injectJavaScript(`
                try {
                  ${cookieInjectionJS}
                  console.log('Cookies injected successfully');
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'COOKIES_INJECTED',
                    count: Object.keys(${JSON.stringify(cookieData)}).length
                  }));
                } catch (e) {
                  console.error('Failed to inject cookies:', e);
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'COOKIE_INJECTION_FAILED',
                    error: e.message
                  }));
                }
                true;
              `);
            }
          }, 2000); // Wait 2 seconds after component mount
        }
        setCookiesLoaded(true);
      } catch (error: any) {
        console.error('Failed to restore cookies:', error);
        setCookiesLoaded(true);
      }
    } else {
      setCookiesLoaded(true);
    }
  }, []);

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

  // Restore cookies on component mount
  useEffect(() => {
    restoreCookies();
  }, [restoreCookies]);

  // Save cookies on component unmount
  useEffect(() => {
    return () => {
      if (Platform.OS === 'ios') {
        // Force save cookies before unmounting
        saveCookies();
      }
    };
  }, [saveCookies]);

  // Add a periodic cookie save while component is active
  useEffect(() => {
    if (Platform.OS === 'ios' && cookiesLoaded) {
      const interval = setInterval(() => {
        saveCookies();
      }, 30000); // Save every 30 seconds

      return () => clearInterval(interval);
    }
  }, [cookiesLoaded, saveCookies]);

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

  const clearCookies = async () => {
    if (Platform.OS === 'ios') {
      try {
        await AsyncStorage.removeItem('dapp_browser_cookies');
        // Cookie injection script is no longer used
        webviewRef.current?.injectJavaScript(`
          document.cookie.split(";").forEach(c => {
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
          });
          true;
        `);
        Alert.alert('Cookies Cleared', 'All cookies have been cleared. Refresh the page.');
      } catch (error: any) {
        console.error('Failed to clear cookies:', error);
      }
    }
  };

  const openInExternalBrowser = () => {
    Linking.openURL(currentUrl);
  };

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'COOKIE_DATA' && Platform.OS === 'ios') {
        // Save cookies to AsyncStorage
        AsyncStorage.setItem('dapp_browser_cookies', JSON.stringify(message.cookies))
          .then(() => console.log('Cookies saved to storage:', Object.keys(message.cookies).length))
          .catch((error) => console.error('Failed to save cookies to storage:', error));
      } else if (message.type === 'COOKIES_INJECTED' && Platform.OS === 'ios') {
        console.log('Cookies successfully injected:', message.count);
      } else if (message.type === 'COOKIE_INJECTION_FAILED' && Platform.OS === 'ios') {
        console.error('Cookie injection failed:', message.error);
      } else if (message.type === 'DEBUG_COOKIES' && Platform.OS === 'ios') {
        console.log('Debug: Current WebView cookies:', message.cookies);
        Alert.alert('Current Cookies', message.cookies || 'No cookies found');
      } else {
        // Handle other messages through browser bridge
        browserBridgeRef.current?.handleMessage(event);
      }
    } catch (error: any) {
      // If it's not JSON, handle as regular browser bridge message
      browserBridgeRef.current?.handleMessage(event);
    }
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

  const loadingText = Platform.OS === 'ios' && !cookiesLoaded ? 'Restoring session...' : 'Loading DApp browser...';

  if (!js || (Platform.OS === 'ios' && !cookiesLoaded)) {
    return (
      <View style={styles.loadingContainer}>
        <ThemedText style={styles.loadingText}>{loadingText}</ThemedText>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />

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
        {Platform.OS === 'ios' && (
          <TouchableOpacity style={styles.iconButton} onPress={() => saveCookies()}>
            <Ionicons name="save" size={16} color="white" />
          </TouchableOpacity>
        )}
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={async () => {
              // Manual cookie injection
              try {
                const savedCookies = await AsyncStorage.getItem('dapp_browser_cookies');
                if (savedCookies && webviewRef.current) {
                  const cookieData = JSON.parse(savedCookies);
                  const cookieInjectionJS = Object.values(cookieData)
                    .map((cookie: any) => {
                      const expiration = cookie.expires ? `; expires=${new Date(cookie.expires).toUTCString()}` : '';
                      const secure = cookie.secure ? '; secure' : '';
                      const httpOnly = cookie.httpOnly ? '; HttpOnly' : '';
                      const sameSite = cookie.samesite ? `; SameSite=${cookie.samesite}` : '; SameSite=Lax';
                      const cookieValue = encodeURIComponent(cookie.value);
                      return `document.cookie = "${cookie.name}=${cookieValue}; path=${cookie.path || '/'}; domain=${cookie.domain}${expiration}${secure}${httpOnly}${sameSite}";`;
                    })
                    .join('\n');

                  webviewRef.current.injectJavaScript(`
                    try {
                      ${cookieInjectionJS}
                      console.log('Manual cookie injection attempted');
                      alert('Cookies injected manually. Refresh the page.');
                    } catch (e) {
                      console.error('Manual injection failed:', e);
                      alert('Manual injection failed: ' + e.message);
                    }
                    true;
                  `);
                } else {
                  Alert.alert('No Cookies', 'No saved cookies found to inject');
                }
              } catch (error: any) {
                Alert.alert('Error', 'Failed to inject cookies: ' + error.message);
              }
            }}
          >
            <Ionicons name="download" size={16} color="white" />
          </TouchableOpacity>
        )}
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={[styles.button, styles.externalButton]}
            onPress={() => {
              // Debug: Check current cookies
              webviewRef.current?.injectJavaScript(`
                try {
                  const cookies = document.cookie;
                  console.log('Current document cookies:', cookies);
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'DEBUG_COOKIES',
                    cookies: cookies
                  }));
                } catch (e) {
                  console.error('Failed to get current cookies:', e);
                }
                true;
              `);
            }}
          >
            <ThemedText style={styles.buttonText}>debug</ThemedText>
          </TouchableOpacity>
        )}
        {Platform.OS === 'ios' && (
          <TouchableOpacity style={[styles.button, styles.unwhitelistButton]} onPress={clearCookies}>
            <ThemedText style={styles.buttonText}>clear</ThemedText>
          </TouchableOpacity>
        )}
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
          testID="DappBrowserAddressBar"
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
        sharedCookiesEnabled={Platform.OS === 'android'}
        thirdPartyCookiesEnabled={true}
        onLoadStart={() => {
          // Save cookies when navigation starts
          if (Platform.OS === 'ios') {
            setTimeout(() => saveCookies(), 500);
          }
        }}
        onLoadEnd={async () => {
          // Try to inject saved cookies on iOS after page loads
          if (Platform.OS === 'ios') {
            try {
              const savedCookies = await AsyncStorage.getItem('dapp_browser_cookies');
              if (savedCookies && webviewRef.current) {
                const cookieData = JSON.parse(savedCookies);
                console.log('Injecting cookies after page load:', Object.keys(cookieData).length);

                // Inject cookies with a delay to ensure DOM is ready
                setTimeout(() => {
                  if (webviewRef.current) {
                    const cookieInjectionJS = Object.values(cookieData)
                      .map((cookie: any) => {
                        const expiration = cookie.expires ? `; expires=${new Date(cookie.expires).toUTCString()}` : '';
                        const secure = cookie.secure ? '; secure' : '';
                        const httpOnly = cookie.httpOnly ? '; HttpOnly' : '';
                        const sameSite = cookie.samesite ? `; SameSite=${cookie.samesite}` : '; SameSite=Lax';
                        const cookieValue = encodeURIComponent(cookie.value);
                        return `document.cookie = "${cookie.name}=${cookieValue}; path=${cookie.path || '/'}; domain=${cookie.domain}${expiration}${secure}${httpOnly}${sameSite}";`;
                      })
                      .join('\n');

                    webviewRef.current.injectJavaScript(`
                      try {
                        // Method 1: Try document.cookie approach
                        ${cookieInjectionJS}

                        // Method 2: Also try to set cookies using a different approach
                        // This might work better on iOS WebView
                        setTimeout(() => {
                          try {
                            // Check if cookies were set
                            const currentCookies = document.cookie;
                            if (currentCookies && currentCookies.length > 0) {
                              console.log('Cookies appear to be set via document.cookie');
                            } else {
                              console.log('No cookies found after injection, trying alternative method');

                              // Alternative: Try setting cookies via fetch with credentials
                              // This is a fallback that might work better on iOS
                              const cookieData = ${JSON.stringify(cookieData)};
                              Object.values(cookieData).forEach(cookie => {
                                try {
                                  // Create a small fetch request to set the cookie
                                  fetch(window.location.origin + '/set-cookie-' + Date.now(), {
                                    method: 'GET',
                                    credentials: 'include',
                                    headers: {
                                      'Cookie': \`\${cookie.name}=\${encodeURIComponent(cookie.value)}; path=\${cookie.path || '/'}; domain=\${cookie.domain}\`
                                    }
                                  }).catch(() => {
                                    // Ignore fetch errors, this is just to set cookies
                                  });
                                } catch (e) {
                                  console.error('Alternative cookie setting failed:', e);
                                }
                              });
                            }
                          } catch (e) {
                            console.error('Cookie verification failed:', e);
                          }
                        }, 500);

                        console.log('Cookies injected after page load');
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'COOKIES_INJECTED',
                          count: Object.keys(${JSON.stringify(cookieData)}).length
                        }));
                      } catch (e) {
                        console.error('Failed to inject cookies after load:', e);
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'COOKIE_INJECTION_FAILED',
                          error: e.message
                        }));
                      }
                      true;
                    `);
                  }
                }, 1000); // Wait 1 second for DOM to be ready
              }
            } catch (error: any) {
              console.error('Failed to inject cookies on load end:', error);
            }

            // Also save cookies after page loads
            setTimeout(() => saveCookies(), 2000);
          }
        }}
        onLoadProgress={({ nativeEvent }) => {
          // Save cookies during loading progress
          if (Platform.OS === 'ios' && nativeEvent.progress > 0.8) {
            setTimeout(() => saveCookies(), 500);
          }
        }}
      />
    </SafeAreaView>
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
