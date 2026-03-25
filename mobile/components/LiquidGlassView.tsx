import React from 'react';
import { Platform, View, ViewStyle, StyleSheet, StyleProp } from 'react-native';
import { LiquidGlassView as NativeLiquidGlassView } from '@sbaiahmed1/react-native-blur';
import { isIOS26OrNewer } from '@/src/utils/platform';

interface LiquidGlassViewProps {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default' | 'systemChromeMaterial';
  glassStyle?: 'clear' | 'regular'; // @sbaiahmed1/react-native-blur supports 'clear' | 'regular'
  borderIntensity?: number; // 0-1, controls border dimming (0 = no dimming, 1 = fully dimmed)
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * LiquidGlassView - Platform-specific wrapper for liquid glass effects
 *
 * iOS 26+: Uses native LiquidGlassView from @sbaiahmed1/react-native-blur
 * iOS 18–25: Frosted-glass style fallback (semi-transparent + border) for reliable look
 * Android: Simple transparency (no blur)
 */
const LiquidGlassView: React.FC<LiquidGlassViewProps> = ({ intensity = 8, tint = 'light', glassStyle = 'clear', borderIntensity = 0.3, style, children }) => {
  const styleObj: ViewStyle = StyleSheet.flatten(style) || {};
  const { borderRadius, overflow, ...restStyle } = styleObj;
  const containerStyle: ViewStyle = {
    ...restStyle,
    backgroundColor: 'transparent',
  };

  const glassOpacity = Math.max(0, Math.min(1, intensity / 20));

  let glassTintColor: string | undefined;
  if (tint === 'light') {
    glassTintColor = '#FFFFFF';
  } else if (tint === 'dark') {
    glassTintColor = '#000000';
  } else {
    glassTintColor = undefined;
  }

  // Frosted-glass fallback for iOS 18–25 and Android (no native LiquidGlass on older iOS; avoids blur issues)
  const useFallback = Platform.OS !== 'ios' || !isIOS26OrNewer;
  const fallbackBg = tint === 'light' ? `rgba(255, 255, 255, ${0.12 + glassOpacity * 0.1})` : `rgba(0, 0, 0, ${0.12 + glassOpacity * 0.1})`;
  const fallbackBorder = tint === 'light' ? `rgba(255, 255, 255, ${borderIntensity * 0.25})` : `rgba(0, 0, 0, ${borderIntensity * 0.35})`;

  if (useFallback) {
    return (
      <View style={containerStyle}>
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: fallbackBg,
              borderRadius,
              overflow: overflow || 'hidden',
            },
          ]}
        />
        {borderIntensity > 0 && borderRadius && <View style={[StyleSheet.absoluteFill, { borderWidth: 1, borderColor: fallbackBorder, borderRadius }]} pointerEvents="none" />}
        {children}
      </View>
    );
  }

  // iOS 26+: native LiquidGlassView
  return (
    <View style={containerStyle}>
      <NativeLiquidGlassView glassType={glassStyle} glassTintColor={glassTintColor} glassOpacity={glassOpacity} style={[StyleSheet.absoluteFill, { borderRadius, overflow: overflow || 'hidden' }]} />
      {borderIntensity > 0 && borderRadius && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderWidth: 1,
              borderColor: tint === 'light' ? `rgba(255, 255, 255, ${borderIntensity * 0.2})` : `rgba(0, 0, 0, ${borderIntensity * 0.3})`,
              borderRadius,
            },
          ]}
          pointerEvents="none"
        />
      )}
      {children}
    </View>
  );
};

export default LiquidGlassView;
