import React, { useContext, useEffect, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { BrowserBridge } from '@/src/class/browser-bridge';
import { Colors } from '@shared/constants/Colors';

interface EthRequestAccountsArgs {
  params: any[];
  id: number;
  from: string;
}

export function EthRequestAccounts(args: EthRequestAccountsArgs) {
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const [address, setAddress] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const getAddress = async () => {
      try {
        const addressResponse = await BackgroundExecutor.getAddress(network, accountNumber);
        setAddress(addressResponse);
      } catch (error) {
        console.error('Failed to get address:', error);
      }
    };
    getAddress();
  }, [network, accountNumber]);

  const onAllowClick = async () => {
    setIsLoading(true);
    try {
      if (args.from) {
        await BackgroundExecutor.whitelistDapp(args.from);
      }
      BrowserBridge.instance?.sendMessage({ for: 'webpage', id: args.id, response: [address] });
      Alert.alert('Success', 'Account access granted');
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to grant access');
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

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.contentContainer}>
        <ThemedText style={styles.title}>Account Access Request</ThemedText>
        <ThemedText style={styles.subtitle}>
          Dapp <ThemedText style={styles.highlight}>{args.from}</ThemedText> wants your permission to access your account
        </ThemedText>
        {address && (
          <ThemedView style={styles.addressContainer}>
            <ThemedText style={styles.addressLabel}>Your Address:</ThemedText>
            <ThemedText style={styles.addressText}>{address}</ThemedText>
          </ThemedView>
        )}
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
  addressContainer: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  addressText: {
    fontSize: 14,
    fontFamily: 'SpaceMono',
    color: '#1F2937',
    lineHeight: 20,
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
