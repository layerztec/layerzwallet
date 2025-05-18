import React from 'react';
import { View, StyleSheet, Text as RNText, ScrollView } from 'react-native';
import { Button } from '../components/Button';
import CrossPlatformButton from '../../shared/components/CrossPlatformButton';
import SimpleButton from '../../shared/components/SimpleButton';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Separator } from 'tamagui';

/**
 * A screen to demonstrate various button styles and variants
 */
export default function ButtonDemoScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <RNText style={styles.heading}>Button Demo</RNText>
        <View style={styles.separator} />

        <View style={styles.sectionContainer}>
          <RNText style={styles.sectionHeading}>Standard Buttons</RNText>
          <View style={styles.row}>
            <Button variant="primary" onPress={() => console.log('Primary pressed')}>
              Primary
            </Button>
            <Button variant="secondary" onPress={() => console.log('Secondary pressed')}>
              Secondary
            </Button>
            <Button variant="danger" onPress={() => console.log('Danger pressed')}>
              Danger
            </Button>
            <Button variant="outline" onPress={() => console.log('Outline pressed')}>
              Outline
            </Button>
          </View>
        </View>

        <View style={styles.sectionContainer}>
          <RNText style={styles.sectionHeading}>Button Sizes</RNText>
          <View style={styles.column}>
            <Button variant="primary" size="small" onPress={() => console.log('Small pressed')}>
              Small
            </Button>
            <Button variant="primary" size="medium" onPress={() => console.log('Medium pressed')}>
              Medium
            </Button>
            <Button variant="primary" size="large" onPress={() => console.log('Large pressed')}>
              Large
            </Button>
          </View>
        </View>

        <View style={styles.sectionContainer}>
          <RNText style={styles.sectionHeading}>Button States</RNText>
          <View style={styles.column}>
            <Button variant="primary" disabled onPress={() => console.log('Disabled pressed')}>
              Disabled
            </Button>
            <Button variant="primary" isLoading onPress={() => console.log('Loading pressed')}>
              Loading
            </Button>
            <Button variant="primary" fullWidth onPress={() => console.log('Full width pressed')}>
              Full Width Button
            </Button>
          </View>
        </View>

        <View style={styles.sectionContainer}>
          <RNText style={styles.sectionHeading}>Cross-Platform Buttons</RNText>
          <View style={styles.row}>
            <CrossPlatformButton variant="primary" onPress={() => console.log('CP Primary pressed')}>
              Primary
            </CrossPlatformButton>
            <CrossPlatformButton variant="secondary" onPress={() => console.log('CP Secondary pressed')}>
              Secondary
            </CrossPlatformButton>
            <CrossPlatformButton variant="danger" onPress={() => console.log('CP Danger pressed')}>
              Danger
            </CrossPlatformButton>
            <CrossPlatformButton variant="outline" onPress={() => console.log('CP Outline pressed')}>
              Outline
            </CrossPlatformButton>
          </View>
        </View>

        <View style={styles.sectionContainer}>
          <RNText style={styles.sectionHeading}>SimpleButton Implementation</RNText>
          <View style={styles.panel}>
            <RNText style={styles.panelText}>SimpleButton is our recommended implementation as it avoids token resolution issues.</RNText>
            <View style={styles.column}>
              <SimpleButton variant="primary" onPress={() => console.log('SimpleButton pressed')}>
                SimpleButton Primary
              </SimpleButton>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  separator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginBottom: 20,
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  column: {
    gap: 10,
  },
  panel: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
  },
  panelText: {
    marginBottom: 10,
  },
});
