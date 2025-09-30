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
    // iOS has native blur support
    return (
      <BlurView intensity={intensity} tint={tint} style={style}>
        {children}
      </BlurView>
    );
  }

  // Android: Use experimental blur method
  return (
    <BlurView intensity={intensity} tint={tint} style={style} experimentalBlurMethod="dimezisBlurView">
      {children}
    </BlurView>
  );
};

export default PlatformBlurView;
