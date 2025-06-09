import assert from 'assert';
import React, { createContext, ReactNode, useState } from 'react';
import { Modal, TextInput, View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useThemeColor } from '../../hooks/useThemeColor';

import { getDeviceID } from '@shared/modules/device-id';
import { ENCRYPTED_PREFIX, STORAGE_KEY_MNEMONIC } from '@shared/types/IStorage';
import { SecureStorage } from '../class/secure-storage';
import { Csprng } from '../class/rng';
import { decrypt } from '../modules/encryption';

interface IAskMnemonicContext {
  askMnemonic: () => Promise<string>;
}

export const AskMnemonicContext = createContext<IAskMnemonicContext>({
  askMnemonic: (): Promise<string> => Promise.reject('askMnemonic: this should never happen'),
});

type ResolverFunction = (resolveValue: string) => void;
type RejecterFunction = (error: Error) => void;

/**
 * This provider provides an async function `askMnemonic()` that shows Modal asking for a user password,
 * handles mnemonic decryption internally, and resolves to the decrypted mnemonic string.
 */
export const AskMnemonicContextProvider: React.FC<{ children: ReactNode }> = (props) => {
  const [isAskingPassword, setIsAskingPassword] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [resolverFunc, setResolverFunc] = useState<ResolverFunction>(() => () => {});
  const [rejecterFunc, setRejecterFunc] = useState<RejecterFunction>(() => () => {});

  const backgroundColor = useThemeColor({ light: '#fff', dark: '#000' }, 'background');
  const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
  const tintColor = useThemeColor({ light: '#2f95dc', dark: '#fff' }, 'tint');

  const askMnemonic = (): Promise<string> => {
    setIsAskingPassword(true);
    setPassword('');
    setError('');
    setIsLoading(false);

    return new Promise((resolve, reject) => {
      setResolverFunc(() => resolve);
      setRejecterFunc(() => reject);
    });
  };

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

      // Success - resolve with decrypted mnemonic
      resolverFunc(decrypted);
      cleanup();
    } catch (decryptError: any) {
      console.error('Decryption failed:', decryptError);
      setError('Incorrect password. Please try again.');
      setIsLoading(false);
      // Don't cleanup - allow user to retry
    }
  };

  const onCancelPress = () => {
    rejecterFunc(new Error('User cancelled password entry'));
    cleanup();
  };

  const cleanup = () => {
    setPassword('');
    setError('');
    setIsLoading(false);
    setIsAskingPassword(false);
  };

  return (
    <AskMnemonicContext.Provider value={{ askMnemonic }}>
      {props.children}
      <Modal animationType="slide" transparent={true} visible={isAskingPassword} onRequestClose={onCancelPress}>
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
      </Modal>
    </AskMnemonicContext.Provider>
  );
};

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
