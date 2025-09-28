import React from 'react';
import { Platform, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

interface PlatformBlurViewProps {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default' | 'systemChromeMaterial';
  style?: ViewStyle;
  children?: React.ReactNode;
}

const PlatformBlurView: React.FC<PlatformBlurViewProps> = ({ intensity = 50, tint = 'dark', style, children }) => {
  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={intensity} tint={tint} style={style}>
        {children}
      </BlurView>
    );
  }

  // Android fallback - use semi-transparent background
  const androidBackgroundColor = tint === 'light' ? `rgba(255, 255, 255, ${intensity / 100})` : `rgba(0, 0, 0, ${intensity / 100})`;

  return <View style={[style, { backgroundColor: androidBackgroundColor }]}>{children}</View>;
};

export default PlatformBlurView;
