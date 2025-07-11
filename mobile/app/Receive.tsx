import { Ionicons } from '@expo/vector-icons';
import BigNumber from 'bignumber.js';
import * as Clipboard from 'expo-clipboard';
import { Stack } from 'expo-router';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import GradientScreen from '@/components/GradientScreen';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import { ThemedText } from '@/components/ThemedText';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useBalance } from '@shared/hooks/useBalance';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { capitalizeFirstLetter, formatBalance } from '@shared/modules/string-utils';
import { StringNumber } from '@shared/types/string-number';

export default function ReceiveScreen() {
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [oldBalance, setOldBalance] = useState<StringNumber>('');
  const { balance } = useBalance(network, accountNumber, BackgroundExecutor);

  /**
   * returns false if new balance is NOT greater than old one, otherwise it returns the precise difference between
   * balances
   */
  const isNewBalanceGT = useCallback((): false | StringNumber => {
    if (Boolean(balance && oldBalance && new BigNumber(balance).gt(oldBalance))) {
      return new BigNumber(balance ?? '0').minus(oldBalance).toString(10);
    }

    return false;
  }, [balance, oldBalance]);

  useEffect(() => {
    if (!oldBalance && balance) {
      // initial update
      setOldBalance(balance);
      return;
    }
  }, [balance, oldBalance]);

  const fetchAddress = useCallback(async () => {
    setIsLoading(true);
    try {
      const addressResponse = await BackgroundExecutor.getAddress(network, accountNumber);
      setAddress(addressResponse);
    } catch (error) {
      console.error('Error fetching address:', error);
    } finally {
      setIsLoading(false);
    }
  }, [network, accountNumber]);

  useEffect(() => {
    fetchAddress();
  }, [accountNumber, network, fetchAddress]);

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
      Alert.alert('Copied', 'Address copied to clipboard');
    }
  };

  const handleRefresh = () => {
    fetchAddress();
  };

  // Split into groups of 4 characters with spaces
  const formatAddressDisplay = (addr: string): string => {
    if (!addr) return '';
    return addr.match(/.{1,4}/g)?.join('  ') || addr;
  };

  if (isNewBalanceGT()) {
    return (
      <GradientScreen>
        <Stack.Screen options={{ headerShown: false }} />

        <ScreenHeader title="Receive" />

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.contentContainer}>
            <ThemedText testID="NetworkAddressHeader" style={styles.successMessage}>
              Received: +{isNewBalanceGT() ? formatBalance(String(isNewBalanceGT()), getDecimalsByNetwork(network), 8) : ''} {getTickerByNetwork(network)}
            </ThemedText>
          </View>
        </ScrollView>
      </GradientScreen>
    );
  }

  return (
    <GradientScreen>
      <Stack.Screen options={{ headerShown: false }} />

      <ScreenHeader title="Receive" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentContainer}>
          <View style={styles.qrSection}>
            <View style={styles.qrContainer} testID="QrContainer">
              {isLoading ? (
                <View style={styles.qrPlaceholder} testID="LoadingPlaceholder">
                  <ActivityIndicator size="large" color="#ffffff" />
                  <ThemedText style={styles.loadingText}>Loading address...</ThemedText>
                </View>
              ) : address ? (
                <QRCode testID="AddressQrCode" value={address} size={280} backgroundColor="white" color="black" />
              ) : (
                <View style={styles.qrPlaceholder}>
                  <ThemedText style={styles.errorText}>No address available</ThemedText>
                </View>
              )}
            </View>

            {!isLoading && address && (
              <ThemedText style={styles.addressDisplay} testID="AddressText">
                {formatAddressDisplay(address)}
              </ThemedText>
            )}
          </View>

          <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
            <Ionicons name="refresh" size={24} color="rgba(255, 255, 255, 0.8)" />
            <ThemedText>Refresh</ThemedText>
          </TouchableOpacity>

          <View style={styles.actionButtons}>
            <TouchableOpacity testID="ShareButton" onPress={handleShare} style={styles.shareButton} disabled={!address}>
              <Ionicons name="share-outline" size={28} color="rgba(255, 255, 255, 0.8)" />
              <ThemedText style={styles.shareButtonText}>Share address</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity testID="CopyAddressButton" onPress={handleCopyAddress} style={styles.copyButton} disabled={!address}>
              <Ionicons testID="CopyIcon" name="copy-outline" size={22} color="rgba(255, 255, 255, 0.8)" />
              <ThemedText style={styles.copyButtonText}>Copy address</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
  },
  qrSection: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 30,
  },
  qrContainer: {
    marginBottom: 30,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrPlaceholder: {
    width: 280,
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  loadingText: {
    marginTop: 10,
  },
  errorText: {
    color: '#666',
  },
  addressDisplay: {
    textAlign: 'left',
    lineHeight: 25,
    paddingHorizontal: 20,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    width: '100%',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 30,
    minWidth: 120,
    gap: 12,
  },
  actionButtons: {
    width: '100%',
    gap: 8,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 12,
  },
  shareButtonText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 12,
  },
  copyButtonText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  successMessage: {
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginTop: 100,
  },
});
