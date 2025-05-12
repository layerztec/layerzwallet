import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

/**
 * TestPage - An extremely simplified page to test if we can
 * hide the splash screen without any complex components
 */
export default function TestPage() {
  // Force hide splash screen immediately
  useEffect(() => {
    const hideSpashImmediately = async () => {
      console.log('TestPage: Attempting to hide splash screen immediately');
      try {
        await SplashScreen.hideAsync();
        console.log('TestPage: Splash screen hidden successfully');
      } catch (e) {
        console.error('TestPage: Failed to hide splash screen:', e);
      }
    };

    hideSpashImmediately();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Layerz Wallet Test Page</Text>
      <Text style={styles.subtitle}>If you can see this, the splash screen is hidden.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#011474',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
});
