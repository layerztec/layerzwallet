import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import FailsafeRoot from '../components/FailsafeRoot';

// Prevent auto-hide, we'll control it explicitly
SplashScreen.preventAutoHideAsync().catch((e) => console.log('Error preventing splash screen auto-hide:', e));

/**
 * Failsafe layout that strips out all potentially problematic components
 * and focuses only on getting past the splash screen
 */
export default function FailsafeLayout() {
  // Force hide splash screen immediately on mount
  useEffect(() => {
    const hideImmediately = async () => {
      try {
        console.log('FailsafeLayout: Attempting to hide splash screen immediately');
        await SplashScreen.hideAsync();
        console.log('FailsafeLayout: Successfully hid splash screen');
      } catch (e) {
        console.error('FailsafeLayout: Failed to hide splash screen:', e);
        // Try again after delay
        setTimeout(() => {
          SplashScreen.hideAsync().catch((e) => console.error('FailsafeLayout: Second attempt also failed:', e));
        }, 1000);
      }
    };

    // Try to hide immediately
    hideImmediately();

    // Also set a backup timeout
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <FailsafeRoot>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="testpage" />
        <Stack.Screen name="minimal" />
        <Stack.Screen name="index" />
      </Stack>
    </FailsafeRoot>
  );
}
