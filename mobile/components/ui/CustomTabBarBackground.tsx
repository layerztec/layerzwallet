import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View } from 'react-native';
import { isIOS26OrNewer } from '@/src/utils/platform';

/**
 * Custom tab bar background for use with React Navigation bottom tabs (tabBarBackground).
 * Gives full control: solid background on Android and iOS 18–25, BlurView on iOS 26+.
 */
export default function CustomTabBarBackground() {
  if (Platform.OS === 'android') {
    return <View style={[StyleSheet.absoluteFill, styles.androidBackground]} pointerEvents="none" />;
  }

  if (!isIOS26OrNewer) {
    return <View style={[StyleSheet.absoluteFill, styles.iosFallbackBackground]} pointerEvents="none" />;
  }

  return <BlurView tint="default" intensity={100} style={StyleSheet.absoluteFill} />;
}

const styles = StyleSheet.create({
  androidBackground: {
    backgroundColor: '#111111',
  },
  iosFallbackBackground: {
    backgroundColor: '#1C1C1E',
  },
});
