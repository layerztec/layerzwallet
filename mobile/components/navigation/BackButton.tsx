import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface BackButtonProps {
  onPress?: () => void;
  style?: ViewStyle;
}

const BackButton: React.FC<BackButtonProps> = ({ onPress, style }) => {
  const router = useRouter();
  return (
    <TouchableOpacity style={[styles.backButton, style]} onPress={onPress ? onPress : () => router.back()} accessibilityLabel="Go back">
      <Ionicons name="chevron-back" size={24} color="#fff" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  backButton: {
    // backgroundColor: 'red',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default BackButton;
