import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Stack, useRouter } from 'expo-router';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, TouchableOpacity } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { getBreezNetwork } from '@/src/modules/breeze-adapter';
import { PrepareReceiveRequest } from '@breeztech/breez-sdk-liquid';
import { BreezWallet } from '@shared/class/wallets/breez-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getTickerByNetwork } from '@shared/models/network-getters';
import { NETWORK_BREEZ, NETWORK_BREEZTESTNET } from '@shared/types/networks';

const ReceiveLiquid = () => {
  const router = useRouter();
  const network = useContext(NetworkContext).network as typeof NETWORK_BREEZ | typeof NETWORK_BREEZTESTNET;
  const { accountNumber } = useContext(AccountNumberContext);
  const [address, setAddress] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isWalletInitialized, setIsWalletInitialized] = useState<boolean>(false);
  const breezWalletRef = useRef<BreezWallet | null>(null);

  // Initialize the BreezWallet
  useEffect(() => {
    (async () => {
      try {
        const breezMnemonic = await BackgroundExecutor.getSubMnemonic(accountNumber);
        const breezNetwork = getBreezNetwork(network);
        breezWalletRef.current = new BreezWallet(breezMnemonic, breezNetwork);
        setIsWalletInitialized(true);
        setIsGenerating(true);
        setError('');
        try {
          const wallet = breezWalletRef.current;
          const address = await wallet.getAddressLiquid();
          setAddress(address);
        } catch (err) {
          console.error('Failed to generate Liquid address:', err);
          setError('Failed to generate address. Please try again.');
        } finally {
          setIsGenerating(false);
        }
      } catch (err) {
        console.error('Failed to initialize Breez wallet:', err);
        setError('Failed to initialize wallet. Please try again.');
      }
    })();

    return () => {
      breezWalletRef.current = null;
      setIsWalletInitialized(false);
    };
  }, [network, accountNumber]);

  const handleCopyAddress = async () => {
    if (!address) {
      return;
    }
    await Clipboard.setStringAsync(address);
    Alert.alert('Success', 'Address copied to clipboard');
  };

  const handleShare = async () => {
    if (!address) {
      return;
    }
    try {
      await Share.share({
        message: `Liquid address for ${getTickerByNetwork(network)}: ${address}`,
      });
    } catch {
      Alert.alert('Error', 'Failed to share address');
    }
  };

  const handleNewAddress = () => {
    if (!breezWalletRef.current || !isWalletInitialized) {
      return;
    }
    setIsGenerating(true);
    setError('');
    (async () => {
      try {
        const wallet = breezWalletRef.current!;
        const address = await wallet.getAddressLiquid();
        setAddress(address);
      } catch (err) {
        console.error('Failed to generate Liquid address:', err);
        setError('Failed to generate address. Please try again.');
      } finally {
        setIsGenerating(false);
      }
    })();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'Receive Liquid', headerShown: true }} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.contentContainer}>
          <ThemedView testID="NetworkAddressHeader" style={[styles.networkBar, { backgroundColor: '#3498db' }]}>
            <ThemedText style={styles.networkText}>{network?.toUpperCase()} LIQUID</ThemedText>
          </ThemedView>

          {isGenerating ? (
            <ThemedView style={styles.loadingContainer}>
              <ThemedText style={styles.subtitle}>Generating Liquid address...</ThemedText>
            </ThemedView>
          ) : error ? (
            <ThemedView style={styles.errorContainer}>
              <ThemedText style={styles.errorText}>{error}</ThemedText>
              <TouchableOpacity style={styles.button} onPress={handleNewAddress}>
                <ThemedText style={styles.buttonText}>Try Again</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          ) : address ? (
            <>
              <ThemedText style={styles.subtitle}>Scan the QR code or copy the address</ThemedText>

              <ThemedView style={styles.qrContainer} testID="QrContainer">
                <QRCode testID="AddressQrCode" value={address} size={200} backgroundColor="white" color="black" />
              </ThemedView>

              <ThemedView style={styles.addressContainer}>
                <ThemedText testID="AddressLabel" style={styles.addressLabel}>
                  Address:
                </ThemedText>
                <TouchableOpacity testID="CopyAddressButton" onPress={handleCopyAddress} style={styles.addressTextContainer}>
                  <ThemedText testID="AddressText" style={styles.addressText} numberOfLines={2} ellipsizeMode="middle">
                    {address}
                  </ThemedText>
                  <Ionicons testID="CopyIcon" name="copy-outline" size={20} color="#007AFF" style={styles.copyIcon} />
                </TouchableOpacity>
              </ThemedView>

              <ThemedView style={styles.buttonContainer}>
                <TouchableOpacity style={styles.button} onPress={handleNewAddress} testID="NewAddressButton">
                  <ThemedText style={styles.buttonText}>Generate New Address</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity testID="ShareButton" onPress={handleShare} style={styles.shareButton}>
                  <Ionicons name="share-outline" size={24} color="#007AFF" />
                </TouchableOpacity>
              </ThemedView>
            </>
          ) : (
            <ThemedView style={styles.initialLoadingContainer}>
              <ThemedText style={styles.subtitle}>Initializing wallet...</ThemedText>
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ReceiveLiquid;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  contentContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  networkBar: {
    marginBottom: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  networkText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrContainer: {
    marginVertical: 20,
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  addressContainer: {
    width: '100%',
    marginTop: 10,
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
  button: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    width: '80%',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    marginTop: 20,
  },
  shareButton: {
    marginTop: 15,
    padding: 10,
  },
  errorText: {
    color: 'red',
    marginBottom: 15,
    textAlign: 'center',
  },
});
