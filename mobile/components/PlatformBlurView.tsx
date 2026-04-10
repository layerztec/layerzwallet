import React from 'react';
import { View, ViewStyle, StyleProp, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useBlurTargetRef } from '@/src/hooks/BlurTargetContext';
import { homeBlurTargetRef } from '@/src/hooks/homeBlurTargetRef';

interface PlatformBlurViewProps {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default' | 'systemChromeMaterial';
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

const PlatformBlurView: React.FC<PlatformBlurViewProps> = ({ intensity = 50, tint = 'dark', style, children }) => {
  const expoTint: React.ComponentProps<typeof BlurView>['tint'] = tint === 'light' ? 'light' : tint === 'dark' ? 'dark' : 'default';
  /** Context when inside Home; otherwise fall back so transparent modals (e.g. DetachedSheet) can blur on Android. */
  const blurTargetRef = useBlurTargetRef() ?? homeBlurTargetRef;

  const blurIntensity = Math.max(0, Math.min(100, intensity));

  const flattenedStyle = StyleSheet.flatten(style) || {};
  // Extract style properties that need special handling
  const { overflow, borderRadius, ...restStyle } = flattenedStyle;

  const androidBlurMethod = Platform.OS === 'android' && typeof Platform.Version === 'number' && Platform.Version >= 31 ? 'dimezisBlurViewSdk31Plus' : 'dimezisBlurView';

  const androidBlurProps =
    Platform.OS === 'android' && blurTargetRef
      ? {
          blurTarget: blurTargetRef,
          blurMethod: androidBlurMethod as 'dimezisBlurView' | 'dimezisBlurViewSdk31Plus',
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
  /** Keeps content above the blur layer (stacking on Android + consistent ordering). */
  foreground: {
    zIndex: 1,
    elevation: 1,
  },
});

export default PlatformBlurView;
