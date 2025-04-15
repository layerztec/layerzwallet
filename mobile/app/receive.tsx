import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Stack } from 'expo-router';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Share, StyleSheet, TouchableOpacity } from 'react-native';
import RNQRGenerator from 'rn-qr-generator';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { DEFAULT_NETWORK } from '@shared/config';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { capitalizeFirstLetter } from '@shared/modules/string-utils';

export default function ReceiveScreen() {
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [qrCodeUri, setQrCodeUri] = useState<string | null>(null);
  const [qrCodeRenderError, setQrCodeRenderError] = useState<Error | null>(null);

  useEffect(() => {
    setIsLoading(true);
    BackgroundExecutor.getAddress(network || DEFAULT_NETWORK, accountNumber)
      .then((addressResponse) => {
        setAddress(addressResponse);
        RNQRGenerator.generate({
          value: addressResponse,
          height: 200,
          width: 200,
          backgroundColor: 'white',
          color: 'black',
        })
          .then((response) => {
            setQrCodeUri(response.uri);
            setIsLoading(false);
          })
          .catch((error) => {
            console.error('QR Code Generation Error:', error);
            setQrCodeRenderError(error);
            setIsLoading(false);
          });
      })
      .catch((error) => {
        console.error('Error fetching address:', error);
        setIsLoading(false);
      });
  }, [accountNumber, network]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `My ${capitalizeFirstLetter(network)} address: ${address}`,
      });
    } catch {
      Alert.alert('Error', 'Failed to share address');
    }
  };

  const handleCopyAddress = async () => {
    if (address) {
      await Clipboard.setStringAsync(address);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen
        options={{
          title: 'Receive',
          headerShown: true,
        }}
      />

      <ThemedView style={styles.contentContainer}>
        <ThemedText style={styles.subtitle}>Your {capitalizeFirstLetter(network)} Address</ThemedText>

        <ThemedView style={styles.qrContainerWrapper}>
          <ThemedText style={styles.qrTitle}>Scan QR Code</ThemedText>
          <ThemedView style={styles.qrContainer}>
            {isLoading ? (
              <ThemedView style={styles.qrPlaceholder}>
                <ActivityIndicator size="large" color="#007AFF" />
                <ThemedText style={styles.loadingText}>Loading address...</ThemedText>
              </ThemedView>
            ) : qrCodeUri && !qrCodeRenderError ? (
              <Image source={{ uri: qrCodeUri }} style={{ width: 200, height: 200 }} />
            ) : qrCodeRenderError ? (
              <ThemedView style={styles.qrPlaceholder}>
                <Ionicons name="alert-circle-outline" size={40} color="#ff3b30" />
                <ThemedText style={styles.errorText}>QR Code Error: {qrCodeRenderError.message}</ThemedText>
              </ThemedView>
            ) : (
              <ThemedView style={styles.qrPlaceholder}>
                <Ionicons name="information-circle-outline" size={40} color="#007AFF" />
                <ThemedText style={styles.infoText}>No address available</ThemedText>
              </ThemedView>
            )}
          </ThemedView>
        </ThemedView>

        <ThemedView style={styles.addressContainer}>
          <ThemedText style={styles.addressLabel}>Address:</ThemedText>
          <TouchableOpacity onPress={handleCopyAddress} style={styles.addressTextContainer} disabled={!address}>
            {isLoading ? <ThemedText style={styles.addressText}>Loading...</ThemedText> : <ThemedText style={styles.addressText}>{address ? address : 'No address available'}</ThemedText>}
            {address && <Ionicons name="copy-outline" size={20} color="#007AFF" style={styles.copyIcon} />}
          </TouchableOpacity>
        </ThemedView>

        <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
          <Ionicons name="share-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </ThemedView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },

  shareButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
  },
  qrContainerWrapper: {
    marginVertical: 20,
    alignItems: 'center',
    width: '100%',
  },
  qrTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  qrContainer: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f7',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 16,
  },
  errorText: {
    marginTop: 10,
    color: '#ff3b30',
    textAlign: 'center',
    fontSize: 14,
  },
  infoText: {
    marginTop: 10,
    color: '#007AFF',
    textAlign: 'center',
    fontSize: 14,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
  },
  addressContainer: {
    width: '100%',
    marginTop: 20,
  },
  addressLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  addressTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 12,
  },
  addressText: {
    fontSize: 12,
    flex: 1,
  },
  copyIcon: {
    marginLeft: 8,
  },
});
