import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import type { BlurType } from '@sbaiahmed1/react-native-blur';
import { BlurView } from '@sbaiahmed1/react-native-blur';

const tintToBlurType: Record<string, BlurType> = {
  light: 'light',
  dark: 'dark',
  systemChromeMaterial: 'systemChromeMaterial',
  default: 'systemMaterial',
};

interface PlatformBlurViewProps {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default' | 'systemChromeMaterial';
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

const PlatformBlurView: React.FC<PlatformBlurViewProps> = ({ intensity = 50, tint = 'dark', style, children }) => {
  const blurType = tintToBlurType[tint] ?? 'systemMaterial';

  // Map intensity (0-100) to blurAmount (0-100)
  // Library default is 10, but we allow 0-100 range
  const blurAmount = Math.max(0, Math.min(100, intensity));

  const flattenedStyle = StyleSheet.flatten(style) || {};
  // Extract style properties that need special handling
  const { overflow, borderRadius, ...restStyle } = flattenedStyle;

  // Android: Use simple transparency fallback to avoid hardware bitmap crashes
  // The library may work on Android with hardware acceleration, but we use fallback for safety
  if (Platform.OS === 'android') {
    const backgroundColor = tint === 'light' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.3)';

    return (
      <View
        style={[
          restStyle,
          {
            backgroundColor,
            borderRadius,
            overflow: overflow || 'hidden',
          },
        ]}
      >
        {children}
      </View>
    );
  }

  // iOS: Use native BlurView
  // Ensure proper layout constraints to prevent blur from extending beyond bounds
  return (
    <View
      style={[
        {
          overflow: overflow || 'hidden',
          borderRadius,
        },
        restStyle,
      ]}
    >
      <BlurView blurType={blurType} blurAmount={blurAmount} style={StyleSheet.absoluteFill} ignoreSafeArea={false} />
      {children}
    </View>
  );
};

export default PlatformBlurView;
