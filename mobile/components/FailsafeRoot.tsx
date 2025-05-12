import React from 'react';
import { View } from 'react-native';

/**
 * FailsafeRoot - A component that renders its children directly
 * bypassing all other potentially problematic components.
 * This is a last resort approach to get the app running.
 */
export default function FailsafeRoot({ children }: { children: React.ReactNode }) {
  console.log('Using FailsafeRoot');
  return <View style={{ flex: 1 }}>{children}</View>;
}
