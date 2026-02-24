import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { BlurView } from '@sbaiahmed1/react-native-blur';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Native BlurView can render poorly on iOS 18. Use a frosted fallback for iOS 18–25.
const isIOS26OrNewer = typeof Platform.Version === 'string' ? parseInt(String(Platform.Version), 10) >= 26 : Number(Platform.Version) >= 26;

export default function BlurTabBarBackground() {
  if (!isIOS26OrNewer) {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(28, 28, 30, 0.72)' }]} pointerEvents="none" />;
  }

  return <BlurView blurType="systemChromeMaterial" blurAmount={100} style={StyleSheet.absoluteFill} />;
}

export function useBottomTabOverflow() {
  const tabHeight = useBottomTabBarHeight();
  const { bottom } = useSafeAreaInsets();
  return tabHeight - bottom;
}
