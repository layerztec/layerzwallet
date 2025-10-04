import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, StyleSheet, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getGradientColors } from '@/utils/gradientUtils';

interface GradientScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: string;
  scroll?: boolean;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const GradientScreen: React.FC<GradientScreenProps> = ({ children, style, variant = 'base', scroll = false, onScroll }) => {
  const gradientColors = getGradientColors(variant);
  return (
    <LinearGradient colors={gradientColors} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.gradient}>
      {scroll ? (
        <Animated.ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}
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
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});

export default GradientScreen;
