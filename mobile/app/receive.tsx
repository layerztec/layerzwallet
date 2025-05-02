import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Stack } from 'expo-router';
import React, { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Share, StyleSheet, TouchableOpacity } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/ThemeContext';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { DEFAULT_NETWORK } from '@shared/config';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { capitalizeFirstLetter } from '@shared/modules/string-utils';

export default function ReceiveScreen() {
  const { getColor } = useTheme();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);

  const [address, setAddress] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAddress = async () => {
      setIsLoading(true);
      try {
        const address = await BackgroundExecutor.getAddress(network ?? DEFAULT_NETWORK, accountNumber);
        setAddress(address);
      } catch (error) {
        console.log('Error fetching address:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAddress();
  }, [network, accountNumber]);

  const handleCopyAddress = async () => {
    if (address) {
      await Clipboard.setStringAsync(address);
      Alert.alert('Address Copied', 'The address has been copied to your clipboard.');
    }
  };

  const handleShare = async () => {
    if (address) {
      try {
        await Share.share({
          message: address,
        });
      } catch (error) {
        console.log('Error sharing address:', error);
      }
    }
  };

  // Use our theme system for the network color
  const getNetworkColor = () => {
    return getColor('selectedNetworkBackground');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen
        options={{
          title: 'Receive',
          headerStyle: {
            backgroundColor: getColor('background'),
          },
          headerTintColor: getColor('text'),
        }}
      />

      <ThemedView style={styles.contentContainer}>
        {/* Network indicator bar - visually shows the selected network with color */}
        <ThemedView style={[styles.networkBar, { backgroundColor: getNetworkColor() }]}>
          <ThemedText style={[styles.networkText, { color: getColor('selectedNetworkText') }]}>{network?.toUpperCase()}</ThemedText>
        </ThemedView>

        <ThemedText testID="NetworkAddressHeader" style={styles.subtitle}>
          Your {capitalizeFirstLetter(network || '')} Address
        </ThemedText>

        <ThemedView style={styles.qrContainer} testID="QrContainer">
          {isLoading ? (
            <ThemedView style={styles.qrPlaceholder} testID="LoadingPlaceholder">
              <ActivityIndicator size="large" color={getColor('primary')} />
              <ThemedText style={styles.loadingText}>Loading address...</ThemedText>
            </ThemedView>
          ) : address ? (
            <QRCode testID="AddressQrCode" value={address} size={200} backgroundColor={getColor('white')} color={getColor('black')} />
          ) : (
            <ThemedView style={styles.qrPlaceholder}>
              <ThemedText>No address available</ThemedText>
            </ThemedView>
          )}
        </ThemedView>

        <ThemedView style={styles.addressContainer}>
          <ThemedText testID="AddressLabel" style={styles.addressLabel}>
            Address:
          </ThemedText>
          <TouchableOpacity testID="CopyAddressButton" onPress={handleCopyAddress} style={[styles.addressTextContainer, { backgroundColor: getColor('surfaceBackground') }]} disabled={!address}>
            {isLoading ? (
              <ThemedText style={styles.addressText}>Loading...</ThemedText>
            ) : (
              <ThemedText testID="AddressText" style={styles.addressText}>
                {address ? address : 'No address available'}
              </ThemedText>
            )}
            {address && <Ionicons testID="CopyIcon" name="copy-outline" size={20} color={getColor('primary')} style={styles.copyIcon} />}
          </TouchableOpacity>
        </ThemedView>

        <TouchableOpacity testID="ShareButton" onPress={handleShare} style={styles.shareButton} disabled={!address}>
          <Ionicons testID="ShareIcon" name="share-outline" size={24} color={getColor('primary')} />
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
    borderWidth: 1,
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
  },
});
