import { useRouter } from 'expo-router';
import React, { useContext, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { sanitizeAndValidateMnemonic } from '@shared/modules/wallet-utils';

export default function ImportWalletScreen() {
  const { scanQr } = useContext(ScanQrContext);
  const router = useRouter();
  const [mnemonic, setMnemonic] = useState('');
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

      try {
        sanitizeAndValidateMnemonic(mnemonic);
      } catch (validationError) {
        setError('Invalid mnemonic seed');
        return;
      }

      const response = await BackgroundExecutor.saveMnemonic(mnemonic);

      if (!response) {
        setError('Invalid mnemonic seed');
      } else {
        router.dismissAll();
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
          <ThemedText type="title">Import wallet</ThemedText>
          <ThemedText type="subtitle">Enter your 12 or 24-word recovery phrase</ThemedText>

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
              testID="ImportWalletMnemonicInput"
            />
          </View>

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.scanButton, isLoading && styles.disabledButton]}
            onPress={async () => {
              const scanned = await scanQr();
              if (scanned) {
                setMnemonic(scanned);
              }
            }}
          >
            <MaterialCommunityIcons name="qrcode-scan" size={24} color="#000" />
          </TouchableOpacity>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={[styles.button, styles.secondaryButton, isLoading && styles.disabledButton]} onPress={handleImportWallet} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <ThemedText style={styles.buttonText} testID="ImportWalletImportButton">
                Import
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scanButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
  },
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
