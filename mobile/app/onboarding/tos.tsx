import React, { useState } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { BackgroundExecutor } from '@/src/modules/background-executor';

export default function TermsOfServiceScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleAgree = async () => {
    setIsLoading(true);
    try {
      // Accept the terms of service
      await BackgroundExecutor.acceptTermsOfService();

      // Navigate to the main home screen
      router.replace('/home');
    } catch (error) {
      console.error('Error accepting terms:', error);
      Alert.alert('Error', 'Failed to accept terms. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedText style={styles.title}>Terms of Service</ThemedText>

        <ScrollView style={styles.termsContainer}>
          <ThemedText style={styles.termsText}>{TERMS_OF_SERVICE}</ThemedText>
        </ScrollView>

        <TouchableOpacity style={[styles.button, isLoading ? styles.buttonDisabled : null]} onPress={handleAgree} disabled={isLoading}>
          <ThemedText style={styles.buttonText}>{isLoading ? 'Processing...' : 'I Agree'}</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  termsContainer: {
    flex: 1,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 15,
  },
  termsText: {
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

// Example Terms of Service text - replace with your actual terms
const TERMS_OF_SERVICE = `
TERMS OF SERVICE

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

By clicking "I Agree," you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
`;
