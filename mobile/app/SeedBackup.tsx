import { useRouter } from 'expo-router';
import React, { useContext, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { AskMnemonicContext } from '@/src/hooks/AskMnemonicContext';

export default function SeedBackupScreen() {
  const router = useRouter();
  const { askMnemonic } = useContext(AskMnemonicContext);
  const [mnemonic, setMnemonic] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleShowSeedPhrase = async () => {
    setIsLoading(true);
    try {
      const seedPhrase = await askMnemonic();
      if (seedPhrase) {
        setMnemonic(seedPhrase);
      }
    } catch (error) {
      console.error('Failed to get mnemonic:', error);
      Alert.alert('Error', 'Failed to retrieve seed phrase. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
          {!mnemonic ? (
            <ThemedView style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Backup Your Wallet</ThemedText>
              <ThemedText style={styles.description}>Your seed phrase is the key to your wallet. Write it down and keep it safe. Anyone with access to this phrase can control your funds.</ThemedText>

              <TouchableOpacity style={[styles.button, styles.primaryButton, isLoading && styles.buttonDisabled]} onPress={handleShowSeedPhrase} disabled={isLoading}>
                <ThemedText style={styles.primaryButtonText}>{isLoading ? 'Loading...' : 'Show Seed Phrase'}</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          ) : (
            <ThemedView style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Your Seed Phrase</ThemedText>
              <ThemedText style={styles.warningText}>⚠️ Write this down and keep it safe. Anyone with access to this phrase can control your funds.</ThemedText>

              <View style={styles.qrContainer}>
                <QRCode value={mnemonic} size={200} color="black" backgroundColor="white" />
              </View>

              <View style={styles.seedPhraseContainer}>
                <ThemedText style={styles.seedPhraseLabel}>Seed Phrase:</ThemedText>
                <ThemedText style={styles.seedPhraseText}>{mnemonic}</ThemedText>
              </View>
            </ThemedView>
          )}
        </ScrollView>
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
    padding: 16,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  section: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
    color: '#666',
  },
  warningText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
    color: '#FF3B30',
    fontWeight: '600',
  },
  button: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#34C759',
  },
  secondaryButtonText: {
    color: 'white',
    fontWeight: '700',
  },
  backButton: {
    backgroundColor: '#8E8E93',
    marginTop: 'auto',
  },
  backButtonText: {
    color: 'white',
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  qrContainer: {
    alignItems: 'center',
    marginVertical: 20,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  seedPhraseContainer: {
    marginVertical: 20,
  },
  seedPhraseLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  seedPhraseText: {
    fontSize: 14,
    lineHeight: 20,
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    fontFamily: 'SpaceMono',
  },
});
