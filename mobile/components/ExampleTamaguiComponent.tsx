import React from 'react';
import { View } from 'tamagui';
import { ThemedText } from '../../components/ThemedText';

/**
 * An example component demonstrating the use of the Tamagui-based ThemedText component
 */
export const ExampleTamaguiComponent = () => {
  return (
    <View padding="$3">
      <ThemedText type="headline">This is a headline with Tamagui</ThemedText>
      <ThemedText type="subHeadline">This is a sub-headline with Tamagui</ThemedText>
      <ThemedText type="paragraph">This is a paragraph with Tamagui</ThemedText>
      <ThemedText type="defaultSemiBold">This is bold text with Tamagui</ThemedText>
      <ThemedText type="link">This is a link with Tamagui</ThemedText>
    </View>
  );
};
