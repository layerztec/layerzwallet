import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import LiquidGlassView from '../LiquidGlassView';

interface LiquidGlassTabBarProps {
  style?: ViewStyle;
}

/**
 * LiquidGlassTabBar - Custom tab bar background with liquid glass effect
 * Uses LiquidGlassView for iOS 26+ native liquid glass, falls back to BlurView on older versions
 */
export default function LiquidGlassTabBar({ style }: LiquidGlassTabBarProps) {
  console.log('🟢 LiquidGlassTabBar: Component rendering');

  return (
    <LiquidGlassView
      tint="light"
      glassStyle="clear"
      intensity={12}
      borderIntensity={0.8}
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: 20,
          overflow: 'hidden',
        },
        style,
      ]}
    />
  );
}
