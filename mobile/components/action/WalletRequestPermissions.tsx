import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { BrowserBridge } from '@/src/class/browser-bridge';
import { LayerzStorage } from '@/src/class/layerz-storage';
import { DappPermissions, PermissionRequest } from '@shared/class/dapp-permissions';
import { Colors } from '@shared/constants/Colors';

interface WalletRequestPermissionsArgs {
  params: any[];
  id: number;
  from: string;
}

export function WalletRequestPermissions(args: WalletRequestPermissionsArgs) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const onAllowClick = async () => {
    setIsLoading(true);
    try {
      const id = args.id;
      const from = args.from;

      const permissions: PermissionRequest[] = args.params;

      const dp = new DappPermissions(String(from), LayerzStorage);
      const response = await dp.addPermissions(permissions[0]);
      BrowserBridge.instance?.sendMessage({ for: 'webpage', id, response });
      Alert.alert('Success', 'Permissions granted');
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to grant permissions');
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

  const renderPermissions = () => {
    try {
      const params = args.params;
      if (Array.isArray(params) && params.length > 0) {
        return (
          <ThemedView style={styles.permissionsContainer}>
            <ThemedText style={styles.permissionsText}>{JSON.stringify(params[0], null, 2)}</ThemedText>
          </ThemedView>
        );
      }
      return null;
    } catch (error: any) {
      return <ThemedText style={styles.errorText}>Error: {error.message}</ThemedText>;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.contentContainer}>
        <ThemedText style={styles.title}>Request Permissions</ThemedText>
        <ThemedText style={styles.subtitle}>
          Dapp <ThemedText style={styles.highlight}>{args.from}</ThemedText> wants to request permissions
        </ThemedText>
        {renderPermissions()}
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
  permissionsContainer: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  permissionsText: {
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
