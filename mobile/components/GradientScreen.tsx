import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, RefreshControl, StyleSheet, View, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getGradientColors } from '@/utils/gradientUtils';

interface GradientScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: string;
  scroll?: boolean;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  refreshControl?: React.ReactElement<React.ComponentProps<typeof RefreshControl>>;
}

const GradientScreen: React.FC<GradientScreenProps> = ({ children, style, variant = 'base', scroll = false, onScroll, refreshControl }) => {
  const gradientColors = getGradientColors(variant);
  const insets = useSafeAreaInsets();
  const safeAreaStyle = {
    paddingTop: insets.top + 16,
    paddingBottom: insets.bottom + 16,
  } as const;
  return (
    <LinearGradient colors={gradientColors} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.gradient}>
      {scroll ? (
        <Animated.ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, safeAreaStyle, style]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={refreshControl}
        >
          {children}
        </Animated.ScrollView>
      ) : (
        <View style={[styles.safeArea, safeAreaStyle, style]}>{children}</View>
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
