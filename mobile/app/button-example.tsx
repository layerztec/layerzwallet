import React from 'react';
import { Stack, XStack, YStack, Text } from 'tamagui';
import Button from '../src/components/Button';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Example screen demonstrating the usage of the Tamagui Button component
 * in the Expo mobile app environment.
 */
export default function ButtonExampleScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView>
        <YStack space={20} padding={20} backgroundColor="$background" flex={1}>
          <Text fontWeight="bold" fontSize={20} textAlign="center">
            Button Component Examples
          </Text>

          {/* Primary Button */}
          <Button onPress={() => console.log('Primary button pressed')}>Primary Button</Button>

          {/* Secondary Button */}
          <Button variant="secondary" onPress={() => console.log('Secondary button pressed')}>
            Secondary Button
          </Button>

          {/* Danger Button */}
          <Button variant="danger" onPress={() => console.log('Danger button pressed')}>
            Danger Button
          </Button>

          {/* Outline Button */}
          <Button variant="outline" onPress={() => console.log('Outline button pressed')}>
            Outline Button
          </Button>

          {/* Size Variants */}
          <Text fontWeight="bold">Size Variants</Text>
          <Button size="small" onPress={() => console.log('Small button pressed')}>
            Small
          </Button>

          <Button size="medium" onPress={() => console.log('Medium button pressed')}>
            Medium
          </Button>

          <Button size="large" onPress={() => console.log('Large button pressed')}>
            Large
          </Button>

          {/* Loading and Disabled States */}
          <Text fontWeight="bold">States</Text>
          <Button isLoading onPress={() => console.log('Loading button pressed')}>
            Loading
          </Button>

          <Button disabled onPress={() => console.log('Disabled button pressed')}>
            Disabled
          </Button>

          {/* Full Width Button */}
          <Button fullWidth onPress={() => console.log('Full width button pressed')}>
            Full Width Button
          </Button>
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}
