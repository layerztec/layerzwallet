import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { gradients } from '@shared/constants/Colors';

interface GradientScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

const GradientScreen: React.FC<GradientScreenProps> = ({ children, style }) => {
  return (
    <LinearGradient colors={gradients.blueGradient} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.gradient}>
      <SafeAreaView style={[styles.safeArea, style]} edges={['top', 'left', 'right', 'bottom']}>
        {children}
      </SafeAreaView>
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
});

export default GradientScreen;
