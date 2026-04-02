import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { useEffect } from 'react';
import { AppState, AppStateStatus, LogBox, Platform } from 'react-native';
import 'react-native-reanimated';
import { SWRConfig } from 'swr';
import BigNumber from 'bignumber.js';

import '../src/modules/breeze-adapter'; // needed to be imported before we can use BreezWallet
import '../src/modules/spark-adapter'; // needed to be imported before we can use SparkWallet

import AutoClaimMonitor from '@/components/AutoClaimMonitor';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useColorScheme } from '@/hooks/useColorScheme';
import { LayerzStorage } from '@/src/class/layerz-storage';
import { SwrCacheProvider } from '@/src/class/swr-cache-provider';
import { AskPasswordContextProvider } from '@/src/hooks/AskPasswordContext';
import { AuthStateContextProvider } from '@/src/hooks/AuthStateContext';
import { ScanQrContextProvider } from '@/src/hooks/ScanQrContext';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { Messenger } from '@/src/modules/messenger';
import { AnalyticsEvents, trackAnalyticsEvent } from '@/src/modules/analytics';
import { AccountNumberContextProvider } from '@shared/hooks/AccountNumberContext';
import { InitializationContextProvider } from '@shared/hooks/InitializationContext';
import { NetworkContextProvider } from '@shared/hooks/NetworkContext';
import { SettingsContextProvider } from '@shared/hooks/SettingsContext';
import { useTransferService } from '@shared/hooks/useTransferService';
import { ProtectedRouteStack } from '@/components/ProtectedRouteStack';
import { ActionPopupProvider } from '@/contexts/ActionPopupContext';
import { appendLog, applogFilePath, handleError } from '@/src/modules/error-handler';
import { TransferFlowProvider } from '@/src/transfer/TransferFlowContext';
import { TransferExecution } from '@shared/types/transfer';
import { AllNetworkInfos } from '@shared/models/all-network-infos';
import { Networks } from '@shared/types/networks';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();
LogBox.ignoreLogs(['Require cycle:', 'Open debugger to view warnings.']);

const onJSError = (error: unknown) => handleError(error, 'JAVASCRIPT_ERROR');

const consoleLogOrig = console.log;
if (!__DEV__) {
  console.log('applogFilePath:', applogFilePath);
  const _log = (...args: unknown[]) => {
    appendLog(args, 'log');
    consoleLogOrig(...args);
  };
  console.log = console.warn = console.error = console.debug = console.info = _log;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const transferService = useTransferService(LayerzStorage);
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    'SF-Pro-Rounded-Semibold': require('../assets/fonts/SF-Pro-Rounded-Semibold.ttf'),
  });

  useEffect(() => {
    transferService.onTransferCompleted = (execution: TransferExecution) => {
      let sat = 0;

      // trying to decypher satoshi amount of the swap:
      // if one of the assets in pair is pegged to btc we use that, with SEND being a priority, so
      // its later in code
      switch (execution.receiveAsset) {
        case 'native:arkade':
        case 'native:bitcoin':
        case 'native:citrea':
        case 'native:lightning':
        case 'native:botanix':
        case 'native:liquid':
        case 'native:spark':
          const networkName = execution.receiveAsset.split(':')[1];
          const decimals = AllNetworkInfos[networkName as Networks]?.decimals;
          sat = new BigNumber(execution.receiveAmount).multipliedBy(Math.pow(10, decimals)).toNumber();
          break;
      }

      switch (execution.sendAsset) {
        case 'native:arkade':
        case 'native:bitcoin':
        case 'native:citrea':
        case 'native:lightning':
        case 'native:botanix':
        case 'native:liquid':
        case 'native:spark':
          const networkName = execution.sendAsset.split(':')[1];
          const decimals = AllNetworkInfos[networkName as Networks]?.decimals;
          sat = new BigNumber(execution.sendAmount).multipliedBy(Math.pow(10, decimals)).toNumber();
          break;
      }

      // if we ever have token-to-token swaps we will have to decide how to resolve sat equivalent here

      trackAnalyticsEvent(AnalyticsEvents.SwapCompleted, {
        provider: execution.serviceName,
        sendAsset: execution.sendAsset,
        receiveAsset: execution.receiveAsset,
        id: execution.id,
        sat,
      });
    };

    return () => {
      transferService.onTransferCompleted = undefined;
    };
  }, [transferService]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      const style = colorScheme === 'dark' ? 'light' : 'dark';
      NavigationBar.setStyle(style);
    }
  }, [colorScheme]);

  useEffect(() => {
    if (loaded) {
      // Small delay to ensure the app is fully rendered before hiding splash
      setTimeout(() => {
        SplashScreen.hideAsync();
      }, 100);
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <SWRConfig
      value={{
        dedupingInterval: 5000,
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
      <ErrorBoundary onError={onJSError}>
        <ScanQrContextProvider>
          <AskPasswordContextProvider>
            <InitializationContextProvider storage={LayerzStorage} backgroundCaller={BackgroundExecutor} platform={'MOBILE'}>
              <SettingsContextProvider storage={LayerzStorage}>
                <AuthStateContextProvider>
                  <AccountNumberContextProvider storage={LayerzStorage} backgroundCaller={BackgroundExecutor} messenger={Messenger}>
                    <NetworkContextProvider storage={LayerzStorage} backgroundCaller={BackgroundExecutor} messenger={Messenger}>
                      <ActionPopupProvider>
                        <AutoClaimMonitor />
                        <ThemeProvider value={DarkTheme}>
                          <TransferFlowProvider>
                            <ProtectedRouteStack />
                          </TransferFlowProvider>
                          <StatusBar style="light" />
                        </ThemeProvider>
                      </ActionPopupProvider>
                    </NetworkContextProvider>
                  </AccountNumberContextProvider>
                </AuthStateContextProvider>
              </SettingsContextProvider>
            </InitializationContextProvider>
          </AskPasswordContextProvider>
        </ScanQrContextProvider>
      </ErrorBoundary>
    </SWRConfig>
  );
}
