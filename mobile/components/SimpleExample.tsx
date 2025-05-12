import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from './ThemedText';

export function SimpleExample() {
  return (
    <View style={styles.container}>
      <ThemedText type="headline">Simple Headline</ThemedText>
      <ThemedText type="paragraph">This is a simple paragraph text without Tamagui's complexity.</ThemedText>
      <ThemedText type="link">This is a link text</ThemedText>
      <ThemedText type="defaultSemiBold">This text is bold</ThemedText>
      <ThemedText lightColor="#FD5D2B" darkColor="#9DF9EC">
        This text has custom colors
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginVertical: 10,
  },
});
