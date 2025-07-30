import React from 'react';
import { StyleSheet, ViewStyle, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { gradients } from '@shared/constants/Colors';

interface GradientScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: string;
  scroll?: boolean;
}

const GradientScreen: React.FC<GradientScreenProps> = ({ children, style, variant = 'base', scroll = false }) => {
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
    <LinearGradient colors={gradientColors} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.gradient}>
      {scroll ? (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <SafeAreaView style={[styles.safeArea, style]} edges={['top', 'left', 'right', 'bottom']}>
            {children}
          </SafeAreaView>
        </ScrollView>
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
