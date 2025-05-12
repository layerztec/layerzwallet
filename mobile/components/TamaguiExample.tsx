import React from 'react';
import { View, Text, Button, YStack } from 'tamagui';

export function TamaguiExample() {
  return (
    <YStack padding={10} space="$2" backgroundColor="$background">
      <Text color="$text" fontFamily="$body" fontSize={16}>
        Simple Tamagui Text Component
      </Text>
      <Button>Simple Tamagui Button</Button>
    </YStack>
  );
}
