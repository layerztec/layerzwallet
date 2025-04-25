import { BackgroundExecutor } from '@/src/modules/background-executor';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ImportWalletScreen() {
  const router = useRouter();
  const [mnemonic, setMnemonic] = useState('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleImportWallet = async () => {
    if (!mnemonic.trim()) {
      setError('Please enter your seed phrase');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await new Promise((resolve) => setTimeout(resolve, 200)); // propagate ui
      const response = await BackgroundExecutor.saveMnemonic(mnemonic.trim());

      if (!response) {
        setError('Invalid mnemonic seed');
      } else {
        router.replace('/onboarding/create-password');
      }
    } catch (err) {
      setError('An error occurred while importing the wallet');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Import wallet</Text>
          <Text style={styles.subtitle}>Enter your 12 or 24-word recovery phrase</Text>

          <View style={styles.mnemonicContainer}>
            <TextInput
              style={styles.mnemonicInput}
              placeholder="Enter your seed phrase (separate words with spaces)"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              value={mnemonic}
              onChangeText={setMnemonic}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={[styles.button, styles.secondaryButton, isLoading && styles.disabledButton]} onPress={handleImportWallet} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.buttonText}>Import</Text>}
          </TouchableOpacity>
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
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  mnemonicContainer: {
    width: '100%',
    marginBottom: 30,
  },
  mnemonicInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 15,
    minHeight: 120,
    textAlignVertical: 'top',
    fontSize: 16,
  },
  error: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: 5,
    marginBottom: 15,
    textAlign: 'center',
  },
  buttonContainer: {
    marginBottom: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#4CAF50',
  },
  disabledButton: {
    backgroundColor: '#a0d8a3',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
