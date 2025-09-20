import React from 'react';
import { Stack } from 'expo-router';
import { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useAuthState } from '@/src/hooks/AuthStateContext';

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
          name="onboarding/create-password"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
            animationDuration: 350,
            gestureEnabled: true,
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
            headerTitle: 'Enter private key or seed phrase',
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

      {/* Biometric authentication screen - shown when initialized, not authenticated, and biometrics are enabled */}
      <Stack.Protected guard={isInitialized && !isAuthenticated && isBiometricEnabled}>
        <Stack.Screen name="BiometricLogin" options={{ headerShown: false }} />
      </Stack.Protected>

      {/* Protected app screens - shown when authenticated OR when biometrics are disabled */}
      <Stack.Protected guard={isAuthenticated || (isInitialized && !isBiometricEnabled)}>
        <Stack.Screen name="Home" options={{ headerShown: false, title: 'Home', animation: 'none' }} />
        <Stack.Screen name="Receive" />
        <Stack.Screen name="Settings" options={{ headerShown: false }} />
        <Stack.Screen name="BackdoorNetworkSwitcher" options={{ headerShown: false }} />
        <Stack.Screen name="Changelog" options={{ headerShown: false }} />
        <Stack.Screen name="SeedBackup" options={{ headerShown: false }} />
        <Stack.Screen name="selftest" options={{ title: 'Self Test' }} />
        <Stack.Screen name="SendArk" options={{ title: 'Send ARK' }} />
        <Stack.Screen name="Swap" options={{ headerShown: false }} />
        <Stack.Screen
          name="SwapTarget"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.6],
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
        <Stack.Screen name="SwapSparkDeposit" options={{ headerShown: false }} />
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
          name="TransactionDetails"
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
      </Stack.Protected>

      <Stack.Screen name="+not-found" options={{ title: 'Not Found' }} />
    </Stack>
  );
}
