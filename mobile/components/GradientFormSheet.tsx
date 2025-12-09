import React from 'react';
import { StyleSheet, ViewStyle, ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { gradients } from '@shared/constants/Colors';

interface GradientFormSheetProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: string;
  scroll?: boolean;
}

const GradientFormSheet: React.FC<GradientFormSheetProps> = ({ children, style, variant = 'base', scroll = false }) => {
  let id: keyof typeof gradients = 'base';

  for (const key of Object.keys(gradients)) {
    if (key.startsWith(variant)) {
      // this will work for liquid-testnet, for example.
      id = key as keyof typeof gradients;
      break;
    }
  }

  const gradientColors = gradients[id];

  return (
    <>
      <LinearGradient colors={gradientColors} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.gradient} />
      <View style={styles.blurView} />
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
    </>
  );
};

const styles = StyleSheet.create({
  gradient: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    height: '120%',
  },
  blurView: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    height: '120%',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
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

export default GradientFormSheet;
