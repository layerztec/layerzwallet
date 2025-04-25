import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { BackgroundExecutor } from '@/src/modules/background-executor';

export default function CreatePasswordScreen() {
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const validatePasswords = () => {
    // Reset error message
    setErrorMessage('');

    // Check if passwords match
    if (password !== repeatPassword) {
      setErrorMessage('Passwords do not match');
      return false;
    }

    // Check password length (minimum 8 characters)
    if (password.length < 2) {
      setErrorMessage('Password must be at least 2 characters long');
      return false;
    }

    // Password is valid
    return true;
  };

  const handleCreatePassword = async () => {
    if (!validatePasswords()) {
      return;
    }

    setIsLoading(true);
    try {
      // Encrypt the mnemonic with the provided password
      const result = await BackgroundExecutor.encryptMnemonic(password);

      if (!result.success) {
        throw new Error(result.message || 'Failed to encrypt wallet');
      }

      // Navigate to the terms of service screen
      router.replace('/onboarding/tos');
    } catch (error) {
      console.error('Error encrypting wallet:', error);
      Alert.alert('Error', 'Failed to create password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedView style={styles.content}>
            <ThemedText style={styles.title}>Create Password</ThemedText>
            <ThemedText style={styles.subtitle}>Create a password to encrypt your wallet</ThemedText>

            <ThemedView style={styles.inputContainer}>
              <TextInput style={styles.input} placeholder="Enter password" placeholderTextColor="#999" secureTextEntry value={password} onChangeText={setPassword} testID="EnterPasswordInput" />

              <TextInput
                style={styles.input}
                placeholder="Repeat password"
                placeholderTextColor="#999"
                secureTextEntry
                value={repeatPassword}
                onChangeText={setRepeatPassword}
                testID="RepeatPasswordInput"
              />

              {errorMessage ? <ThemedText style={styles.errorText}>{errorMessage}</ThemedText> : null}
            </ThemedView>

            <TouchableOpacity style={[styles.button, isLoading ? styles.buttonDisabled : null]} onPress={handleCreatePassword} disabled={isLoading} testID="CreatePasswordButton">
              <ThemedText style={styles.buttonText}>{isLoading ? 'Creating...' : 'Create Password'}</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center',
    opacity: 0.7,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 30,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 15,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  errorText: {
    color: 'red',
    marginTop: -10,
    marginBottom: 15,
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
