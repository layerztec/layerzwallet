import assert from 'assert';
import React, { useState } from 'react';
import { TextInput, View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useThemeColor } from '../hooks/useThemeColor';
import { useAskMnemonic } from '../src/hooks/AskMnemonicContext';

import { getDeviceID } from '@shared/modules/device-id';
import { ENCRYPTED_PREFIX, STORAGE_KEY_MNEMONIC } from '@shared/types/IStorage';
import { SecureStorage } from '../src/class/secure-storage';
import { Csprng } from '../src/class/rng';
import { decrypt } from '../src/modules/encryption';

export default function AskMnemonicScreen() {
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const router = useRouter();
  const { handleMnemonicSubmit } = useAskMnemonic();

  const backgroundColor = useThemeColor({ light: '#fff', dark: '#000' }, 'background');
  const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
  const tintColor = useThemeColor({ light: '#2f95dc', dark: '#fff' }, 'tint');

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (error) setError('');
  };

  const onOkPress = async () => {
    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Get encrypted mnemonic from storage
      const encryptedMnemonic = await SecureStorage.getItem(STORAGE_KEY_MNEMONIC);
      assert(encryptedMnemonic, 'No encrypted mnemonic found');
      assert(encryptedMnemonic.startsWith(ENCRYPTED_PREFIX), 'Mnemonic not encrypted, reinstall the app');

      // Decrypt the mnemonic
      const decrypted = await decrypt(encryptedMnemonic.replace(ENCRYPTED_PREFIX, ''), password, await getDeviceID(SecureStorage, Csprng));

      // Success - call context function with decrypted mnemonic
      handleMnemonicSubmit(decrypted);
      router.back();
    } catch (decryptError: any) {
      console.error('Decryption failed:', decryptError);
      setError('Incorrect password. Please try again.');
      setIsLoading(false);
      // Don't go back - allow user to retry
    }
  };

  const onCancelPress = () => {
    // Call the context function with error to indicate cancellation
    handleMnemonicSubmit(new Error('User cancelled password entry'));
    router.back();
  };

  return (
    <View style={[styles.centeredView, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
      <View style={[styles.modalView, { backgroundColor }]}>
        <Text style={[styles.modalTitle, { color: textColor }]}>Unlock your wallet</Text>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: '#dc3545' }]}>{error}</Text>
          </View>
        ) : null}

        <TextInput
          style={[styles.input, { color: textColor, borderColor: tintColor }]}
          secureTextEntry
          placeholder="Enter your password"
          placeholderTextColor="#888"
          value={password}
          onChangeText={handlePasswordChange}
          autoFocus
          editable={!isLoading}
        />

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={tintColor} />
            <Text style={[styles.loadingText, { color: '#666' }]}>Decrypting wallet...</Text>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <Pressable style={[styles.button, styles.buttonCancel, isLoading && styles.buttonDisabled]} onPress={onCancelPress} disabled={isLoading}>
            <Text style={styles.buttonText}>Cancel</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.buttonConfirm, { backgroundColor: tintColor }, isLoading && styles.buttonDisabled]} onPress={onOkPress} disabled={isLoading}>
            <Text style={styles.buttonText}>{isLoading ? 'Unlocking...' : 'Unlock'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    width: '80%',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    marginBottom: 15,
    fontSize: 18,
    fontWeight: '700',
  },
  errorContainer: {
    marginBottom: 15,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    padding: 10,
    borderWidth: 1,
    borderRadius: 5,
    marginBottom: 20,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  button: {
    borderRadius: 5,
    padding: 10,
    elevation: 2,
    minWidth: '40%',
    alignItems: 'center',
  },
  buttonConfirm: {
    backgroundColor: '#2196F3',
  },
  buttonCancel: {
    backgroundColor: '#888',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontWeight: '700',
  },
});
