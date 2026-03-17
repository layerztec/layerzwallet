import React from 'react';
import { Platform, View, ViewStyle, StyleSheet } from 'react-native';
import { BlurView } from '@sbaiahmed1/react-native-blur';

interface PlatformBlurViewProps {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default' | 'systemChromeMaterial';
  style?: ViewStyle;
  children?: React.ReactNode;
}

const PlatformBlurView: React.FC<PlatformBlurViewProps> = ({ intensity = 50, tint = 'dark', style, children }) => {
  // Map tint to blurType according to library documentation
  // Valid types: 'xlight' | 'light' | 'dark' | 'extraDark' | 'regular' | 'prominent' |
  // 'systemUltraThinMaterial' | 'systemThinMaterial' | 'systemMaterial' | 'systemThickMaterial' |
  // 'systemChromeMaterial' | etc.
  let blurType:
    | 'xlight'
    | 'light'
    | 'dark'
    | 'extraDark'
    | 'regular'
    | 'prominent'
    | 'systemUltraThinMaterial'
    | 'systemThinMaterial'
    | 'systemMaterial'
    | 'systemThickMaterial'
    | 'systemChromeMaterial' = 'systemMaterial';
  if (tint === 'light') {
    blurType = 'light';
  } else if (tint === 'dark') {
    blurType = 'dark';
  } else if (tint === 'systemChromeMaterial') {
    blurType = 'systemChromeMaterial';
  } else if (tint === 'default') {
    blurType = 'systemMaterial';
  }

  // Map intensity (0-100) to blurAmount (0-100)
  // Library default is 10, but we allow 0-100 range
  const blurAmount = Math.max(0, Math.min(100, intensity));

  // Extract style properties that need special handling
  const { overflow, borderRadius, ...restStyle } = style || {};

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
