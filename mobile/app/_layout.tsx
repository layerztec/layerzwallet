import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { AppState, AppStateStatus, LogBox } from 'react-native';

import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemeProvider } from '@/hooks/ThemeContext';
import { NetworkContextProvider } from '@shared/hooks/NetworkContext';
import { AccountNumberContextProvider } from '@shared/hooks/AccountNumberContext';
import { AskPasswordContextProvider } from '@/src/hooks/AskPasswordContext';
import { SWRConfig } from 'swr';
import { SwrCacheProvider } from '@/src/class/swr-cache-provider';
import { ScanQrContextProvider } from '@/src/hooks/ScanQrContext';
import { LayerzStorage } from '@/src/class/layerz-storage';
import { BackgroundExecutor } from '@/src/modules/background-executor';

// Prevent the splash screen from automatically hiding
SplashScreen.preventAutoHideAsync();

// Ignore specific warnings
LogBox.ignoreLogs(['Warning: ...']); // Specific warning messages to ignore

// Create a static instance of the cache provider
const cacheProvider = new SwrCacheProvider();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [loaded, error] = useFonts({
    // Add any custom fonts here
  });

  // Subscribe to app state changes to refresh SWR cache when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  // Handle app state changes
  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      // Perform actions when app comes to foreground
    }
  };

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      // Hide the splash screen once the fonts are loaded and the UI is ready
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <SWRConfig
      value={{
        provider: () => cacheProvider,
        refreshInterval: 30000,
        revalidateOnFocus: false,
      }}
    >
      <ThemeProvider>
        <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AskPasswordContextProvider BackgroundExecutorRef={BackgroundExecutor}>
            <NetworkContextProvider storage={LayerzStorage} backgroundCaller={BackgroundExecutor}>
              <AccountNumberContextProvider storage={LayerzStorage} backgroundCaller={BackgroundExecutor}>
                <ScanQrContextProvider>
                  <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
                  <Stack />
                </ScanQrContextProvider>
              </AccountNumberContextProvider>
            </NetworkContextProvider>
          </AskPasswordContextProvider>
        </NavigationThemeProvider>
      </ThemeProvider>
    </SWRConfig>
  );
}
