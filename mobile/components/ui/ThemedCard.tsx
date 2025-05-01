import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';
import { ThemedText } from '../ThemedText';

type ThemedCardProps = {
  children: ReactNode;
  title?: string;
  style?: ViewStyle;
  variant?: 'default' | 'outlined' | 'elevated';
};

export function ThemedCard({ children, title, style, variant = 'default' }: ThemedCardProps) {
  const backgroundColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const shadowColor = useThemeColor({}, 'shadowColor');

  let cardStyle: ViewStyle[] = [styles.card, { backgroundColor }];

  // Apply different styling based on variant
  switch (variant) {
    case 'outlined':
      cardStyle.push({
        borderWidth: 1,
        borderColor,
      });
      break;
    case 'elevated':
      cardStyle.push({
        shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
      });
      break;
  }

  return (
    <View style={[...cardStyle, style]}>
      {title && (
        <ThemedText type="subtitle" style={styles.title}>
          {title}
        </ThemedText>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  title: {
    marginBottom: 12,
  },
});
