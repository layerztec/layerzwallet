import React from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useAuthState } from '@/src/hooks/AuthStateContext';
import { useBiometricModal } from '@/src/hooks/useBiometricModal';
import { isInMainApp } from '@/src/utils/navigationUtils';

const DefaultNavigatorOptions: NativeStackNavigationOptions = {
  headerTitle: '',
  headerTintColor: '#fff',
  headerBackButtonDisplayMode: 'minimal',
  headerTransparent: true,
  headerBackImageSource: require('@/assets/images/ui/headerBackImage.png'),
  gestureEnabled: true,
  gestureDirection: 'horizontal',
  animationDuration: 350,
};

export function ProtectedRouteStack() {
  const { isAuthenticated, isInitialized, isBiometricEnabled } = useAuthState();
  const segments = useSegments();

  useBiometricModal();

  // Determine if user has ever been to main app screens (indicates they've authenticated before)
  const userInMainApp = isInMainApp(segments);

  // User has completed initial auth if they're currently in main app or have been there before
  const hasCompletedInitialAuth = userInMainApp;

  // Debug: Log the current auth state (only in development)
  if (__DEV__) {
    console.debug('ProtectedRouteStack state:', {
      isAuthenticated,
      isInitialized,
      isBiometricEnabled,
      segments,
      userInMainApp,
      hasCompletedInitialAuth,
      shouldShowBiometricLogin: isBiometricEnabled && isInitialized && !isAuthenticated && !hasCompletedInitialAuth,
      shouldShowMainApp: !isBiometricEnabled || isAuthenticated || hasCompletedInitialAuth,
    });
  }

  // Extract guard conditions for clarity
  // Show fullscreen biometric login only on first authentication attempt (never been to main app)
  const shouldShowBiometricLogin = isBiometricEnabled && isInitialized && !isAuthenticated && !hasCompletedInitialAuth;
  // Show main app if biometrics are disabled, user is authenticated, or user has been to main app before
  const shouldShowMainApp = !isBiometricEnabled || isAuthenticated || hasCompletedInitialAuth;

  return (
    <Stack
      screenOptions={{
        ...DefaultNavigatorOptions,
        fullScreenGestureEnabled: true,
      }}
    >
      {/* Onboarding and setup screens - shown when app is not initialized */}
      <Stack.Protected guard={!isInitialized}>
        <Stack.Screen name="index" options={{ headerShown: false, title: 'Index' }} />
        <Stack.Screen
          name="onboarding/intro"
          options={{
            headerTitle: '',
            headerTransparent: true,
            animation: 'fade',
            animationDuration: 300,
          }}
        />
        <Stack.Screen
          name="onboarding/create-wallet-intro"
          options={{
            ...DefaultNavigatorOptions,
          }}
        />
        <Stack.Screen
          name="onboarding/tos"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
            animationDuration: 350,
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="onboarding/import-wallet"
          options={{
            headerTitle: 'Enter seed phrase',
            headerTitleStyle: {
              fontFamily: 'Inter',
              fontWeight: '400',
              fontSize: 24,
              color: '#fff',
            },
            headerTitleAlign: 'center',
            animation: 'slide_from_right',
            animationDuration: 350,
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="onboarding/create-wallet"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
            animationDuration: 350,
            gestureEnabled: true,
          }}
        />
      </Stack.Protected>

      {/* Protected app screens - shown when app is initialized and either:
          1. User is authenticated, OR
          2. User has been authenticated at least once (subsequent modal auth), OR
          3. Biometrics are disabled, OR
          4. User needs biometric authentication (first time or re-auth) */}
      <Stack.Protected guard={shouldShowMainApp || shouldShowBiometricLogin}>
        <Stack.Screen
          name="BiometricLogin"
          options={{
            presentation: 'fullScreenModal',
            headerShown: false,
            gestureEnabled: false,
            animation: 'none',
          }}
        />
        <Stack.Screen name="Home" options={{ headerShown: false, title: 'Home', animation: 'fade' }} />
        <Stack.Screen name="Receive" />
        <Stack.Screen name="Settings" options={{ headerShown: false }} />
        <Stack.Screen
          name="onboarding/create-password"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
            animationDuration: 350,
            gestureEnabled: true,
          }}
        />
        <Stack.Screen name="BackdoorNetworkSwitcher" options={{ headerShown: false }} />
        <Stack.Screen name="Changelog" options={{ headerShown: false }} />
        <Stack.Screen name="SeedBackup" options={{ headerShown: false }} />
        <Stack.Screen name="selftest" options={{ title: 'Self Test' }} />
        <Stack.Screen name="SendAccountBased" options={{ headerShown: false }} />
        <Stack.Screen name="SendBtc" options={{ title: 'Send BTC' }} />
        <Stack.Screen name="SendEvm" options={{ title: 'Send' }} />
        <Stack.Screen
          name="FeeSelector"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.7],
            sheetGrabberVisible: true,
            headerTransparent: false,
            gestureEnabled: true,
            headerShown: false,
            contentStyle: {
              height: '100%',
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.2)',
            },
          }}
        />
        <Stack.Screen name="send" options={{ headerShown: false }} />
        <Stack.Screen name="Swap" options={{ headerShown: false }} />
        <Stack.Screen
          name="SwapTarget"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.6, 1.0],
            sheetGrabberVisible: true,
            headerTransparent: false,
            gestureEnabled: true,
            headerShown: false,
            contentStyle: {
              height: '100%',
              backgroundColor: 'rgb(24, 32, 82)',
            },
          }}
        />
        <Stack.Screen
          name="SwapDetails"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.8],
            sheetGrabberVisible: true,
            headerTransparent: false,
            gestureEnabled: true,
            headerShown: false,
            contentStyle: {
              height: '100%',
            },
          }}
        />
        <Stack.Screen name="Onramp" options={{ headerShown: true }} />
        <Stack.Screen name="AskPassword" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="AskMnemonic" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="DAppBrowser" options={{ headerShown: true, title: 'Browser' }} />
        <Stack.Screen
          name="Action"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.95],
            sheetGrabberVisible: true,
            headerTransparent: false,
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="PocketSwitch"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.7],
            sheetGrabberVisible: true,
            headerTransparent: false,
            gestureEnabled: true,
            headerShown: false,
            contentStyle: {
              height: '100%',
            },
          }}
        />
        <Stack.Screen
          name="Transactions"
          options={{
            ...DefaultNavigatorOptions,
          }}
        />
        <Stack.Screen
          name="ScanQr"
          options={{
            presentation: 'fullScreenModal',
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
            animation: 'slide_from_bottom',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="TransactionDetails"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.7, 1.0],
            sheetGrabberVisible: true,
            headerTransparent: false,
            gestureEnabled: true,
            headerShown: false,
            contentStyle: {
              height: '100%',
            },
          }}
        />
      </Stack.Protected>

      <Stack.Screen name="+not-found" options={{ title: 'Not Found' }} />
    </Stack>
  );
}
