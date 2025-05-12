import React from 'react';
import { Text as TamaguiText, YStack } from 'tamagui';
import { Text as RNText, View } from 'react-native';

/**
 * A minimal Tamagui component with fallback for any Tamagui errors
 */
export const ExampleTamaguiComponent = () => {
  return (
    <YStack padding="$3" backgroundColor="$background">
      <TamaguiText fontSize={16} fontWeight={600} color="$color">
        Tamagui Text Component
      </TamaguiText>
    </YStack>
  );
};
