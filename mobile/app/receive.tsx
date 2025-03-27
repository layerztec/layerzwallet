import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Stack } from 'expo-router';
import React, { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Share, StyleSheet, TouchableOpacity } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
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

  useEffect(() => {
    setIsLoading(true);
    BackgroundExecutor.getAddress(network || DEFAULT_NETWORK, accountNumber)
      .then((addressResponse) => {
        setAddress(addressResponse);
        setIsLoading(false);
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

        <ThemedView style={styles.qrContainer}>
          {isLoading ? (
            <ThemedView style={styles.qrPlaceholder}>
              <ActivityIndicator size="large" color="#007AFF" />
              <ThemedText style={styles.loadingText}>Loading address...</ThemedText>
            </ThemedView>
          ) : address ? (
            <QRCode value={address} size={200} backgroundColor="white" color="black" />
          ) : (
            <ThemedView style={styles.qrPlaceholder}>
              <ThemedText>No address available</ThemedText>
            </ThemedView>
          )}
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
  qrContainer: {
    marginVertical: 20,
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
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
  loadingText: {
    marginTop: 10,
  },
});
