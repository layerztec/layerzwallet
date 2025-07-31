import { useRouter } from 'expo-router';
import React, { useContext, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, TouchableOpacity, View, Animated, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { sanitizeAndValidateMnemonic } from '@shared/modules/wallet-utils';
import { Colors, gradients } from '@shared/constants/Colors';
import { useSequentialSpringAnimation, useHorizontalSpringTransition } from '@/hooks/useCustomTransitions';

export default function ImportWalletScreen() {
  const { scanQr } = useContext(ScanQrContext);
  const router = useRouter();
  const [mnemonic, setMnemonic] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const titleTransition = useSequentialSpringAnimation(200);
  const subtitleTransition = useSequentialSpringAnimation(400);
  const inputTransition = useSequentialSpringAnimation(600);
  const buttonTransition = useSequentialSpringAnimation(800);
  const scanButtonTransition = useSequentialSpringAnimation(900);

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
    <View style={styles.container}>
      <LinearGradient colors={gradients.blueGradient} style={styles.container}>
        <SafeAreaView style={styles.safeAreaView}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.content}>
              <Animated.View style={[titleTransition]}>
                <ThemedText type="title" darkColor={Colors.dark.buttonText} textAlign="center">
                  Import wallet
                </ThemedText>
              </Animated.View>

              <View style={{ marginVertical: 10 }} />

              <Animated.View style={[subtitleTransition]}>
                <ThemedText type="paragraph" darkColor={Colors.dark.text} textAlign="center">
                  Enter your 12 or 24-word recovery phrase
                </ThemedText>
              </Animated.View>

              <Animated.View style={[styles.inputContainer, inputTransition]}>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.mnemonicInput}
                    placeholder="Enter your seed phrase (separate words with spaces)"
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
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

                {error ? (
                  <View style={styles.errorContainer}>
                    <ThemedText style={styles.errorText} darkColor="#FF6B6B">
                      {error}
                    </ThemedText>
                  </View>
                ) : null}
              </Animated.View>
            </View>
            <Animated.View style={[styles.buttonSection, buttonTransition]}>
              <TouchableOpacity
                style={[styles.scanButton, isLoading && styles.disabledButton]}
                onPress={async () => {
                  const scanned = await scanQr();
                  if (scanned) {
                    setMnemonic(scanned);
                  }
                }}
                disabled={isLoading}
              >
                <Ionicons name="qr-code-outline" size={24} color="rgba(255, 255, 255, 0.9)" />
              </TouchableOpacity>

              <TouchableOpacity style={[styles.button, isLoading ? styles.buttonDisabled : null]} onPress={handleImportWallet} disabled={isLoading}>
                {isLoading ? (
                  <ActivityIndicator color={Colors.dark.buttonText} size="small" />
                ) : (
                  <ThemedText style={styles.buttonText} darkColor={Colors.dark.buttonText} testID="ImportWalletImportButton">
                    Import
                  </ThemedText>
                )}
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeAreaView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  inputContainer: {
    width: '100%',
    marginTop: 40,
  },
  inputWrapper: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16,
  },
  mnemonicInput: {
    minHeight: 120,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlignVertical: 'top',
  },
  errorContainer: {
    marginTop: -8,
    marginBottom: 16,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  scanButtonContainer: {
    width: '100%',
    marginTop: 20,
  },
  scanButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  buttonSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    backgroundColor: Colors.dark.buttonPrimary,
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
