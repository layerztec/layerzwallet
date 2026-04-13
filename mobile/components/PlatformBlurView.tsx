import React from 'react';
import { View, ViewStyle, StyleProp, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

interface PlatformBlurViewProps {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default' | 'systemChromeMaterial';
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

const PlatformBlurView: React.FC<PlatformBlurViewProps> = ({ intensity = 50, tint = 'dark', style, children }) => {
  const expoTint: React.ComponentProps<typeof BlurView>['tint'] = tint === 'light' ? 'light' : tint === 'dark' ? 'dark' : 'default';

  const blurIntensity = Math.max(0, Math.min(100, intensity));

  const flattenedStyle = StyleSheet.flatten(style) || {};
  // Extract style properties that need special handling
  const { overflow, borderRadius, ...restStyle } = flattenedStyle;

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
      <BlurView intensity={blurIntensity} tint={expoTint} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
};

export default PlatformBlurView;
