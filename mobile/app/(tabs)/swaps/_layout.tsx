import { Stack } from 'expo-router';
import React from 'react';

export default function SwapsTabLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 350,
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
