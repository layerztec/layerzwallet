import React from 'react';
import { StyleSheet, ViewStyle, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getNetworkPrimaryColor } from '@shared/constants/Colors';
import { RadialGradient } from './RadialGradient';

interface GradientFormSheetProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: string;
  scroll?: boolean;
}

const GradientFormSheet: React.FC<GradientFormSheetProps> = ({ children, style, variant = 'base', scroll = false }) => {
  const primaryColor = getNetworkPrimaryColor(variant);
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
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
          <SafeAreaView style={[styles.safeArea, style]} edges={['top', 'left', 'right', 'bottom']}>
            {children}
          </SafeAreaView>
        </ScrollView>
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
    ...StyleSheet.absoluteFill,
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

export default GradientFormSheet;
