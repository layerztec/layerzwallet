import React, { useContext, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Pressable from '../Pressable';

import { ThemedText } from '@/components/ThemedText';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { BrowserBridge } from '@/src/class/browser-bridge';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import assert from 'assert';
import { EvmWallet } from '@shared/class/evm-wallet';

interface PersonalSignArgs {
  params: any[];
  id: number;
  from: string;
}

export function PersonalSign(args: PersonalSignArgs) {
  const router = useRouter();
  const { accountNumber } = useContext(AccountNumberContext);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const onAllowClick = async () => {
    setIsLoading(true);
    try {
      const params = args.params;
      let payload = '';
      if (Array.isArray(params)) {
        payload = params[0];
      }
      const mnemonic = await BackgroundExecutor.getMasterSeed();
      const evm = new EvmWallet();
      const bytes = await evm.signPersonalMessage(payload, mnemonic, accountNumber);

      BrowserBridge.instance?.sendMessage({ for: 'webpage', id: args.id, response: bytes });
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sign message');
    } finally {
      setIsLoading(false);
    }
  };

  const onDenyClick = async () => {
    try {
      BrowserBridge.instance?.sendMessage({
        for: 'webpage',
        id: args.id,
        error: { code: 4001, message: 'User rejected the request.' },
      });
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to reject request');
      router.back();
    }
  };

  const renderParams = () => {
    try {
      const params = args.params;
      let payload = '';

      if (Array.isArray(params)) {
        try {
          payload = params[0];
          // Try to decode hex to UTF-8
          if (payload.startsWith('0x')) {
            payload = Buffer.from(payload.replace('0x', ''), 'hex').toString('utf8');
          }
        } catch {
          payload = params.join('\n');
        }
      }

      return (
        <View style={styles.messageContainer}>
          <ThemedText style={styles.messageText}>{payload}</ThemedText>
        </View>
      );
    } catch (error: any) {
      return <ThemedText style={styles.errorText}>Error: {error.message}</ThemedText>;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        <ThemedText style={styles.title}>Sign Message</ThemedText>
        <ThemedText style={styles.subtitle}>
          Dapp <ThemedText style={styles.highlight}>{args.from}</ThemedText> wants you to sign a message
        </ThemedText>
        {renderParams()}
      </View>

      <View style={styles.buttonContainer}>
        <Pressable style={[styles.button, styles.secondaryButton, isLoading && styles.disabledButton]} onPress={onDenyClick} disabled={isLoading} activeOpacity={0.8}>
          <ThemedText style={[styles.buttonText, styles.secondaryButtonText, isLoading && styles.disabledButtonText]}>{isLoading ? 'Processing...' : 'Deny'}</ThemedText>
        </Pressable>
        <Pressable style={[styles.button, styles.primaryButton, isLoading && styles.disabledButton]} onPress={onAllowClick} disabled={isLoading} activeOpacity={0.8}>
          <ThemedText style={[styles.buttonText, styles.primaryButtonText, isLoading && styles.disabledButtonText]}>{isLoading ? 'Processing...' : 'Allow'}</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  contentContainer: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    paddingVertical: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  highlight: {
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 1)',
  },
  messageContainer: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  messageText: {
    fontSize: 14,
    fontFamily: 'SpaceMono',
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
  },
  errorText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginTop: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    padding: 24,
    paddingBottom: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  button: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  secondaryButtonText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  disabledButtonText: {
    color: 'rgba(255, 255, 255, 0.4)',
  },
});
