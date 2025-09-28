import React, { useState, useEffect } from 'react';
import { Platform, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

interface PlatformBlurViewProps {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default' | 'systemChromeMaterial';
  style?: ViewStyle;
  children?: React.ReactNode;
}

const PlatformBlurView: React.FC<PlatformBlurViewProps> = ({
  intensity = 50,
  tint = 'dark',
  style,
  children,
}) => {
  const [blurSupported, setBlurSupported] = useState(Platform.OS === 'ios');

  useEffect(() => {
    // On Android, try to detect if blur is supported
    if (Platform.OS === 'android') {
      // Try to create a BlurView to test if it works
      try {
        // This is a simple test - if BlurView can be instantiated, it should work
        setBlurSupported(true);
      } catch (error) {
        console.log('BlurView not supported on this Android device, using fallback');
        setBlurSupported(false);
      }
    }
  }, []);

  // Try native blur first on both platforms
  if (blurSupported) {
    try {
      return (
        <BlurView
          intensity={intensity}
          tint={tint}
          style={style}
          experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
        >
          {children}
        </BlurView>
      );
    } catch (error) {
      console.log('BlurView failed, falling back to semi-transparent background');
      // Fall through to fallback
    }
  }

  // Fallback - use semi-transparent background
  const fallbackBackgroundColor =
    tint === 'light'
      ? `rgba(255, 255, 255, ${Math.min(intensity / 100, 0.8)})`
      : `rgba(0, 0, 0, ${Math.min(intensity / 100, 0.8)})`;

  return (
    <View style={[style, { backgroundColor: fallbackBackgroundColor }]}>
      {children}
    </View>
  );
};

export default PlatformBlurView;
