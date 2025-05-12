import React, { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';

// Keep splash screen visible
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function MinimalLayout() {
  const [appIsReady, setAppIsReady] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    async function prepare() {
      try {
        // Pre-load fonts, make API calls, etc.
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (e) {
        console.warn('Error preparing app:', e);
      } finally {
        // Tell the application to render
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady && fontsLoaded) {
      console.log('App is ready and fonts are loaded, hiding splash screen');
      // Hide the splash screen once all setup is complete
      try {
        await SplashScreen.hideAsync();
      } catch (e) {
        console.error('Failed to hide splash screen:', e);
      }
    }
  }, [appIsReady, fontsLoaded]);

  // Don't render anything until the app is ready
  if (!appIsReady || !fontsLoaded) {
    return null; // This will keep the splash screen visible
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="testpage" options={{ title: 'Test Page' }} />
        <Stack.Screen name="index" options={{ title: 'Home' }} />
      </Stack>
      <StatusBar style="auto" />
    </View>
  );
}
