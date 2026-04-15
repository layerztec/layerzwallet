import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { homeBlurTargetRef } from '@/src/hooks/homeBlurTargetRef';

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
  const { overflow, borderRadius, ...restStyle } = flattenedStyle;

  /** SDK 31+ uses GPU blur; falls back to no blur on <31 to avoid jank from the legacy implementation. */
  const androidBlurProps =
    Platform.OS === 'android'
      ? {
          blurTarget: homeBlurTargetRef,
          blurMethod: 'dimezisBlurViewSdk31Plus' as const,
          blurReductionFactor: 2,
        }
      : {};

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
      <BlurView intensity={blurIntensity} tint={expoTint} style={StyleSheet.absoluteFill} {...androidBlurProps} />
      {children != null ? (
        <View style={styles.foreground} pointerEvents="box-none">
          {children}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  /** Keeps content above the blur layer on Android (stacking + elevation). */
  foreground: {
    zIndex: 1,
    elevation: 1,
  },
});

export default PlatformBlurView;
