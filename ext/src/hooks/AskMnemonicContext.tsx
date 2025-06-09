import assert from 'assert';
import React, { createContext, ReactNode, useState } from 'react';

import { getDeviceID } from '@shared/modules/device-id';
import { ENCRYPTED_PREFIX, STORAGE_KEY_MNEMONIC } from '@shared/types/IStorage';
import { LayerzStorage } from '../class/layerz-storage';
import { Csprng } from '../class/rng';
import { SecureStorage } from '../class/secure-storage';
import { ThemedText } from '../components/ThemedText';
import { decrypt } from '../modules/encryption';
import { Button, Input, Modal } from '../pages/Popup/DesignSystem';

interface IAskMnemonicContext {
  askMnemonic: () => Promise<string>;
}

export const AskMnemonicContext = createContext<IAskMnemonicContext>({
  askMnemonic: (): Promise<string> => Promise.reject('askMnemonic: this should never happen'),
});

type ResolverFunction = (resolveValue: string) => void;
type RejecterFunction = (error: Error) => void;

/**
 * This provider provides an async function `askMnemonic()` that shows Dialog asking for a user password,
 * handles mnemonic decryption internally, and resolves to the decrypted mnemonic string.
 */
export const AskMnemonicContextProvider: React.FC<{ children: ReactNode }> = (props) => {
  const [isAskingPassword, setIsAskingPassword] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [resolverFunc, setResolverFunc] = useState<ResolverFunction>(() => () => {});
  const [rejecterFunc, setRejecterFunc] = useState<RejecterFunction>(() => () => {});

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

  const handlePasswordChange = (event: { target: { value: React.SetStateAction<string> } }) => {
    setPassword(event.target.value);
    if (error) setError('');
  };

  const onOkClick = async () => {
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
      assert(encryptedMnemonic.startsWith(ENCRYPTED_PREFIX), 'Mnemonic not encrypted, reinstall the extension');

      // Decrypt the mnemonic
      const decrypted = await decrypt(encryptedMnemonic.replace(ENCRYPTED_PREFIX, ''), password, await getDeviceID(LayerzStorage, Csprng));

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

  const onCancelClick = () => {
    rejecterFunc(new Error('User cancelled password entry'));
    cleanup();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) onOkClick();
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
      {isAskingPassword && (
        <Modal closable={false}>
          <div style={{ textAlign: 'center', minWidth: '300px' }}>
            <ThemedText type="subHeadline" style={{ marginBottom: '20px' }}>
              Unlock your wallet
            </ThemedText>

            {error && (
              <div style={{ marginBottom: '15px' }}>
                <ThemedText style={{ color: '#dc3545', fontSize: '14px' }}>{error}</ThemedText>
              </div>
            )}

            <div style={{ width: '90%', marginBottom: '20px' }}>
              <Input
                id="password-provider-input2"
                data-testid="password-provider-input2"
                autoFocus
                type="password"
                name="password"
                placeholder="Enter your password"
                onChange={handlePasswordChange}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                style={{ width: '100%' }}
              />
            </div>

            {isLoading && (
              <div style={{ marginBottom: '15px' }}>
                <ThemedText style={{ color: '#666', fontSize: '14px' }}>Decrypting wallet...</ThemedText>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <Button onClick={onCancelClick} disabled={isLoading} style={{ backgroundColor: '#6c757d' }}>
                Cancel
              </Button>
              <Button onClick={onOkClick} disabled={isLoading} id="unlock-wallet-button" data-testid="unlock-wallet-button">
                {isLoading ? 'Unlocking...' : 'Unlock'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </AskMnemonicContext.Provider>
  );
};
