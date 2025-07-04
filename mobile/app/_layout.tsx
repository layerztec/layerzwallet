import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, AppStateStatus, LogBox } from 'react-native';
import 'react-native-reanimated';
import { SWRConfig } from 'swr';

import '../src/modules/breeze-adapter'; // needed to be imported before we can use BreezWallet
import '../src/modules/spark-adapter'; // needed to be imported before we can use SparkWallet

import { useColorScheme } from '@/hooks/useColorScheme';
import { LayerzStorage } from '@/src/class/layerz-storage';
import { SwrCacheProvider } from '@/src/class/swr-cache-provider';
import { AskMnemonicContextProvider } from '@/src/hooks/AskMnemonicContext';
import { AskPasswordContextProvider } from '@/src/hooks/AskPasswordContext';
import { ScanQrContextProvider } from '@/src/hooks/ScanQrContext';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { Messenger } from '@/src/modules/messenger';
import { AccountNumberContextProvider } from '@shared/hooks/AccountNumberContext';
import { InitializationContextProvider } from '@shared/hooks/InitializationContext';
import { NetworkContextProvider } from '@shared/hooks/NetworkContext';
import { Header as ActionHeader } from './Action';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();
LogBox.ignoreLogs(['Open debugger to view warnings.']);

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

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
              <AccountNumberContextProvider storage={LayerzStorage} backgroundCaller={BackgroundExecutor} messenger={Messenger}>
                <NetworkContextProvider storage={LayerzStorage} backgroundCaller={BackgroundExecutor} messenger={Messenger}>
                  <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                    <Stack>
                      <Stack.Screen name="index" options={{ headerShown: false, title: 'Index' }} />
                      <Stack.Screen name="home" options={{ headerShown: false, title: 'Home', animation: 'none' }} />
                      <Stack.Screen name="receive" />
                      <Stack.Screen name="settings" options={{ headerShown: true, title: 'Settings' }} />
                      <Stack.Screen name="SeedBackup" options={{ headerShown: true, title: 'Seed Backup' }} />
                      <Stack.Screen name="onboarding/intro" options={{ headerShown: false }} />
                      <Stack.Screen name="onboarding/create-password" options={{ headerShown: false }} />
                      <Stack.Screen name="onboarding/tos" options={{ headerShown: false }} />
                      <Stack.Screen name="onboarding/import-wallet" options={{ headerShown: false }} />
                      <Stack.Screen name="onboarding/create-wallet" options={{ headerShown: false }} />
                      <Stack.Screen name="selftest" options={{ title: 'Self Test' }} />
                      <Stack.Screen name="SendArk" options={{ title: 'Send ARK' }} />
                      <Stack.Screen name="Onramp" options={{ headerShown: true }} />
                      <Stack.Screen name="AskPassword" options={{ presentation: 'modal', headerShown: false }} />
                      <Stack.Screen name="AskMnemonic" options={{ presentation: 'modal', headerShown: false }} />
                      <Stack.Screen name="DAppBrowser" options={{ headerShown: true, title: 'Browser' }} />
                      <Stack.Screen
                        name="NetworkSelector"
                        options={{
                          presentation: 'transparentModal',
                          sheetAllowedDetents: [0.66, 1.0],
                          headerShown: false,
                          animation: 'fade',
                        }}
                      />
                      <Stack.Screen
                        name="Action"
                        options={{
                          presentation: 'formSheet',
                          sheetAllowedDetents: [0.66, 1.0],
                          header: () => <ActionHeader />,
                          sheetGrabberVisible: true,
                        }}
                      />
                      <Stack.Screen name="+not-found" options={{ title: 'Not Found' }} />
                    </Stack>
                    <StatusBar style="auto" />
                  </ThemeProvider>
                </NetworkContextProvider>
              </AccountNumberContextProvider>
            </InitializationContextProvider>
          </AskMnemonicContextProvider>
        </AskPasswordContextProvider>
      </ScanQrContextProvider>
    </SWRConfig>
  );
}
