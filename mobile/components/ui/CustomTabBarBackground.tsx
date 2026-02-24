import { BlurView } from '@sbaiahmed1/react-native-blur';
import { Platform, StyleSheet, View } from 'react-native';

// iOS 26+ uses native blur; iOS 18–25 uses solid fallback so the tab bar renders correctly.
const isIOS26OrNewer = Platform.OS === 'ios' && (typeof Platform.Version === 'string' ? parseInt(String(Platform.Version), 10) : Number(Platform.Version)) >= 26;

/**
 * Custom tab bar background for use with React Navigation bottom tabs (tabBarBackground).
 * Gives full control: solid background on Android and iOS 18–25, BlurView on iOS 26+.
 */
export default function CustomTabBarBackground() {
  if (Platform.OS === 'android') {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: '#111111' }]} pointerEvents="none" />;
  }

  if (!isIOS26OrNewer) {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1C1C1E' }]} pointerEvents="none" />;
  }

  return <BlurView blurType="systemChromeMaterial" blurAmount={100} style={StyleSheet.absoluteFill} />;
}
