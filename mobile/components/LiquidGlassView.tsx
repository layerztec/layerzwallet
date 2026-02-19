import React from 'react';
import { Platform, View, ViewStyle, StyleSheet, StyleProp } from 'react-native';
import { LiquidGlassView as NativeLiquidGlassView } from '@sbaiahmed1/react-native-blur';

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
 * iOS <26: Falls back to BlurView with enhanced styling
 * Android: Falls back to simple transparency (no blur)
 */
const LiquidGlassView: React.FC<LiquidGlassViewProps> = ({
  intensity = 8,
  tint = 'light',
  glassStyle = 'clear', // Use 'clear' for lighter effect, 'regular' for default
  borderIntensity = 0.3, // Default border dimming (0 = no dimming, 1 = fully dimmed)
  style,
  children,
}) => {
  // Extract borderRadius and other properties from style (flatten if array)
  const styleObj = StyleSheet.flatten(style) || {};
  const { borderRadius, overflow, ...restStyle } = styleObj as ViewStyle;
  const containerStyle: ViewStyle = {
    ...(restStyle as ViewStyle),
    backgroundColor: 'transparent',
  };

  // Map our intensity (0-20) to glassOpacity (0-1)
  // Lower intensity = lower opacity = more transparent glass
  const glassOpacity = Math.max(0, Math.min(1, intensity / 20));

  // Map tint to glassTintColor
  let glassTintColor: string | undefined;
  if (tint === 'light') {
    glassTintColor = '#FFFFFF'; // White for light effect
  } else if (tint === 'dark') {
    glassTintColor = '#000000'; // Black for dark effect
  } else {
    glassTintColor = undefined; // System default
  }

  // Try to use native LiquidGlassView (iOS 26+)
  // The library automatically falls back to BlurView on unsupported platforms
  if (Platform.OS === 'ios') {
    return (
      <View style={containerStyle}>
        <NativeLiquidGlassView
          glassType={glassStyle}
          glassTintColor={glassTintColor}
          glassOpacity={glassOpacity}
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius,
              overflow: overflow || 'hidden',
            },
          ]}
        />
        {/* Border overlay to dim the glass border effect */}
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
  }

  // Android: Use simple transparency fallback (no blur)
  // Use fixed 10% white transparency for light tint, or 10% black for dark tint
  const backgroundColor = tint === 'light' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

  return (
    <View style={containerStyle}>
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor,
            borderRadius,
            overflow: overflow || 'hidden',
          },
        ]}
      />
      {/* Border overlay - use 10% white on Android */}
      {borderIntensity > 0 && borderRadius && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderWidth: 1,
              borderColor: tint === 'light' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
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
