import React from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, RefreshControl, StyleSheet, ViewStyle, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getNetworkPrimaryColor } from '@shared/constants/Colors';
import { RadialGradient } from './RadialGradient';

interface RadialGradientScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  network?: string;
  scroll?: boolean;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  refreshControl?: React.ReactElement<React.ComponentProps<typeof RefreshControl>>;
}

const RadialGradientScreen: React.FC<RadialGradientScreenProps> = ({ children, style, network = 'base', scroll = false, onScroll, refreshControl }) => {
  const primaryColor = getNetworkPrimaryColor(network);
  const colorList = [
    { offset: '0%', color: primaryColor, opacity: '1' },
    { offset: '100%', color: '#000000', opacity: '1' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.gradientWrapper}>
        <RadialGradient colorList={colorList} x="50%" y="-20.71%" rx="109.91%" ry="76.76%" />
      </View>
      {scroll ? (
        <Animated.ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={refreshControl}
        >
          <SafeAreaView style={[styles.safeArea, style]} edges={['top', 'left', 'right', 'bottom']}>
            {children}
          </SafeAreaView>
        </Animated.ScrollView>
      ) : (
        <SafeAreaView style={[styles.safeArea, style]} edges={['top', 'left', 'right', 'bottom']}>
          {children}
        </SafeAreaView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  gradientWrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});

export default RadialGradientScreen;
