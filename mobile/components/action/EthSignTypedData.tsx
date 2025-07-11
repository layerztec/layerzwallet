import { useRouter } from 'expo-router';
import React, { useContext, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { BrowserBridge } from '@/src/class/browser-bridge';
import { AskPasswordContext } from '@/src/hooks/AskPasswordContext';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { Colors } from '@shared/constants/Colors';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';

interface EthSignTypedDataArgs {
  params: any[];
  id: number;
  from: string;
}

export function EthSignTypedData(args: EthSignTypedDataArgs) {
  const router = useRouter();
  const { accountNumber } = useContext(AccountNumberContext);
  const { askPassword } = useContext(AskPasswordContext);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const onAllowClick = async () => {
    setIsLoading(true);
    try {
      const params = args.params;
      let typedData = '';
      if (Array.isArray(params) && params.length > 1) {
        typedData = params[1];
      }

      const password = await askPassword();
      const signedResponse = await BackgroundExecutor.signTypedData(typedData, accountNumber, password);

      if (!signedResponse.success) {
        throw new Error(signedResponse?.message ?? 'Signature error');
      }

      BrowserBridge.instance?.sendMessage({ for: 'webpage', id: args.id, response: signedResponse.bytes });
      Alert.alert('Success', 'Typed data signed');
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sign typed data');
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
      Alert.alert('Rejected', 'User rejected the request');
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to reject request');
      router.back();
    }
  };

  const renderTypedData = () => {
    try {
      const params = args.params;
      let typedData = '';

      if (Array.isArray(params) && params.length > 1) {
        typedData = JSON.stringify(params[1], null, 2);
      }

      return (
        <ThemedView style={styles.messageContainer}>
          <ThemedText style={styles.messageText}>{typedData}</ThemedText>
        </ThemedView>
      );
    } catch (error: any) {
      return <ThemedText style={styles.errorText}>Error: {error.message}</ThemedText>;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.contentContainer}>
        <ThemedText style={styles.title}>Sign Typed Data</ThemedText>
        <ThemedText style={styles.subtitle}>
          Dapp <ThemedText style={styles.highlight}>{args.from}</ThemedText> wants you to sign typed data
        </ThemedText>
        {renderTypedData()}
      </ThemedView>

      <ThemedView style={styles.buttonContainer}>
        <TouchableOpacity style={[styles.button, styles.secondaryButton, isLoading && styles.disabledButton]} onPress={onDenyClick} disabled={isLoading} activeOpacity={0.8}>
          <ThemedText style={[styles.buttonText, styles.secondaryButtonText, isLoading && styles.disabledButtonText]}>{isLoading ? 'Processing...' : 'Deny'}</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.primaryButton, isLoading && styles.disabledButton]} onPress={onAllowClick} disabled={isLoading} activeOpacity={0.8}>
          <ThemedText style={[styles.buttonText, styles.primaryButtonText, isLoading && styles.disabledButtonText]}>{isLoading ? 'Processing...' : 'Allow'}</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  highlight: {
    fontWeight: '600',
    color: Colors.light.text,
  },
  messageContainer: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  messageText: {
    fontSize: 14,
    fontFamily: 'SpaceMono',
    color: '#1F2937',
    lineHeight: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    textAlign: 'center',
    marginTop: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    padding: 24,
    paddingBottom: 40,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  button: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.light.tint,
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
  secondaryButtonText: {
    color: Colors.light.text,
  },
  disabledButtonText: {
    color: '#9CA3AF',
  },
});
