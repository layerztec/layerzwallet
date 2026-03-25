import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { BlurView } from '@sbaiahmed1/react-native-blur';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isIOS26OrNewer } from '@/src/utils/platform';

export default function BlurTabBarBackground() {
  if (!isIOS26OrNewer) {
    return <View style={[StyleSheet.absoluteFill, styles.fallbackBackground]} pointerEvents="none" />;
  }

  return <BlurView blurType="systemChromeMaterial" blurAmount={100} style={StyleSheet.absoluteFill} />;
}

const styles = StyleSheet.create({
  fallbackBackground: {
    backgroundColor: 'rgba(28, 28, 30, 0.72)',
  },
});

export function useBottomTabOverflow() {
  const tabHeight = useBottomTabBarHeight();
  const { bottom } = useSafeAreaInsets();
  return tabHeight - bottom;
}
