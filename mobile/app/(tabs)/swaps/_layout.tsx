import { Stack } from 'expo-router';
import React from 'react';

import { TransferFlowProvider } from '@/src/transfer/TransferFlowContext';

export default function SwapsTabLayout() {
  return (
    <TransferFlowProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 350,
          gestureEnabled: true,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen
          name="select-asset"
          options={{
            presentation: 'transparentModal',
            headerShown: false,
            gestureEnabled: true,
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name="confirm"
          options={{
            presentation: 'transparentModal',
            headerShown: false,
            gestureEnabled: true,
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name="success"
          options={{
            presentation: 'transparentModal',
            headerShown: false,
            gestureEnabled: true,
            animation: 'fade',
          }}
        />
      </Stack>
    </TransferFlowProvider>
  );
}
