import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { useEffect } from 'react';
import { AppState, AppStateStatus, LogBox, Platform } from 'react-native';
import 'react-native-reanimated';
import { SWRConfig } from 'swr';

import '../src/modules/breeze-adapter'; // needed to be imported before we can use BreezWallet
import '../src/modules/spark-adapter'; // needed to be imported before we can use SparkWallet

import { useColorScheme } from '@/hooks/useColorScheme';
import { LayerzStorage } from '@/src/class/layerz-storage';
import { SwrCacheProvider } from '@/src/class/swr-cache-provider';
import { AskMnemonicContextProvider } from '@/src/hooks/AskMnemonicContext';
import { AskPasswordContextProvider } from '@/src/hooks/AskPasswordContext';
import { AuthStateContextProvider } from '@/src/hooks/AuthStateContext';
import { ScanQrContextProvider } from '@/src/hooks/ScanQrContext';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { Messenger } from '@/src/modules/messenger';
import { AccountNumberContextProvider } from '@shared/hooks/AccountNumberContext';
import { InitializationContextProvider } from '@shared/hooks/InitializationContext';
import { NetworkContextProvider } from '@shared/hooks/NetworkContext';
import { SettingsContextProvider } from '@shared/hooks/SettingsContext';
import { ProtectedRouteStack } from '@/components/ProtectedRouteStack';
import { BiometricModalHandler } from '@/app/BiometricLogin';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();
LogBox.ignoreLogs(['Open debugger to view warnings.']);

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (Platform.OS === 'android') {
      const style = colorScheme === 'dark' ? 'light' : 'dark';
      NavigationBar.setStyle(style);
    }
  }, [colorScheme]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <SWRConfig
      value={{
        provider: () => new SwrCacheProvider(),
        isVisible: () => {
          return true;
        },
        // @see https://swr.vercel.app/docs/advanced/react-native.en-US
        initFocus(callback) {
          let appState: AppStateStatus = AppState.currentState;

          const onAppStateChange = (nextAppState: AppStateStatus) => {
            /* If it's resuming from background or inactive mode to active one */
            if (appState.match(/inactive|background/) && nextAppState === 'active') {
              callback();
            }
            appState = nextAppState;
          };

          // Subscribe to the app state change events
          const subscription = AppState.addEventListener('change', onAppStateChange);

          return () => {
            subscription.remove();
          };
        },
        // TODO: do we even need this? we would need to use `NetInfo` package. need to make sure if implementing this
        // really makes a difference (e.g. users return from airplane mode)
        // initReconnect(callback) {}
      }}
    >
      <ScanQrContextProvider>
        <AskPasswordContextProvider>
          <AskMnemonicContextProvider>
            <InitializationContextProvider storage={LayerzStorage} backgroundCaller={BackgroundExecutor}>
              <SettingsContextProvider storage={LayerzStorage}>
                <AuthStateContextProvider>
                  <AccountNumberContextProvider storage={LayerzStorage} backgroundCaller={BackgroundExecutor} messenger={Messenger}>
                    <NetworkContextProvider storage={LayerzStorage} backgroundCaller={BackgroundExecutor} messenger={Messenger}>
                      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                        <ProtectedRouteStack />
                        <BiometricModalHandler />
                        <StatusBar style="light" />
                      </ThemeProvider>
                    </NetworkContextProvider>
                  </AccountNumberContextProvider>
                </AuthStateContextProvider>
              </SettingsContextProvider>
            </InitializationContextProvider>
          </AskMnemonicContextProvider>
        </AskPasswordContextProvider>
      </ScanQrContextProvider>
    </SWRConfig>
  );
}
