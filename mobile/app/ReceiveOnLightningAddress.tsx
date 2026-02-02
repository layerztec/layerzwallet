import { Ionicons } from '@expo/vector-icons';
import Pressable from '../components/Pressable';
import BigNumber from 'bignumber.js';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, ScrollView, Share, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useFocusEffect } from '@react-navigation/native';

import { ActionPopupButton } from '@/components/ActionPopupButton';
import RadialGradientScreen from '@/components/RadialGradientScreen';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import { ThemedText } from '@/components/ThemedText';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { getNetworkImageAsset } from '@/utils/networkAssets';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useBalance } from '@shared/hooks/useBalance';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { capitalizeFirstLetter, formatBalance } from '@shared/modules/string-utils';
import { NETWORK_ARK, NETWORK_LIGHTNING_TESTNET, NETWORK_LIQUID, NETWORK_LIQUID_TESTNET, NETWORK_SPARK, Networks } from '@shared/types/networks';
import { StringNumber } from '@shared/types/string-number';
import { getApiUsersBySparkAddressBySparkAddress } from '@shared/openapi/generated/layerzme';

import { createClient } from '@shared/openapi/generated/layerzme/client';
import { ClaimUsernameModalParams } from './ClaimUsernameModal';

const layerzClient = createClient({
  baseUrl: 'https://layerz.me',
  responseStyle: 'data',
});

const Action = ({ network, text, testID }: { network?: Networks; text: string; testID?: string }) => {
  const networkImage = network ? getNetworkImageAsset(network) : null;
  const networkIconContent = networkImage ? <Image source={networkImage} style={styles.actionIconImage} contentFit="contain" /> : null;
  return (
    <View style={styles.action} testID={testID}>
      {networkIconContent && <View style={styles.actionIcon}>{networkIconContent}</View>}
      <ThemedText style={styles.actionText}>{text}</ThemedText>
    </View>
  );
};

export default function ReceiveOnLightningAddressScreen() {
  const { accountNumber } = useContext(AccountNumberContext);
  const { network: networkFromContext } = useContext(NetworkContext);
  const router = useRouter();
  const network = NETWORK_SPARK;
  const [lightningAddress, setLightningAddress] = useState('');
  const [sparkAddress, setSparkAddress] = useState('');
  const [resolvedUsername, setResolvedUsername] = useState('');
  const [lightningAddressParts, setLightningAddressParts] = useState<{ local: string; domain: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [oldBalance, setOldBalance] = useState<StringNumber>('');
  const [isSharing, setIsSharing] = useState(false);
  const pressScaleAnim = useRef(new Animated.Value(1)).current;
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
      setOldBalance(balance);
      return;
    }
  }, [balance, oldBalance]);

  const fetchAddress = useCallback(async () => {
    setIsLoading(true);
    try {
      const addressResponse = await BackgroundExecutor.getAddress(network, accountNumber);
      setSparkAddress(addressResponse);
      setResolvedUsername('');
      // Format as Lightning address: address@layerz.me
      const lightningAddr = `${addressResponse}@layerz.me`;
      setLightningAddress(lightningAddr);
      const [local, domain] = lightningAddr.split('@');
      setLightningAddressParts({ local, domain });
    } catch (error) {
      console.error('Error fetching address:', error);
    } finally {
      setIsLoading(false);
    }
  }, [network, accountNumber]);

  useEffect(() => {
    fetchAddress();
  }, [accountNumber, fetchAddress]);

  const refreshResolvedUsername = useCallback(async () => {
    if (!sparkAddress) return;
    try {
      const { data } = await getApiUsersBySparkAddressBySparkAddress({
        client: layerzClient,
        path: { sparkAddress },
        responseStyle: 'fields',
        throwOnError: false,
      });

      if (data?.username) {
        setResolvedUsername(data.username);
        setLightningAddress(`${data.username}@layerz.me`);
      }
    } catch (error) {
      console.error('Error fetching username for spark address', error);
    }
  }, [sparkAddress]);

  // When this screen becomes active again (e.g. after dismissing ClaimUsernameModal),
  // refresh the username.
  useFocusEffect(
    useCallback(() => {
      if (resolvedUsername) return;
      refreshResolvedUsername();
    }, [refreshResolvedUsername, resolvedUsername])
  );

  const handleShare = async () => {
    if (!lightningAddress) return;
    setIsSharing(true);
    try {
      await Share.share({
        message: `My Lightning address: ${lightningAddress}`,
      });
    } finally {
      setIsSharing(false);
    }
  };

  // Lightning Network specific handlers
  const handleReceiveOnSpark = () => {
    if (networkFromContext === NETWORK_LIGHTNING_TESTNET) {
      Alert.alert('Spark does not have a testnet');
    } else {
      router.push({ pathname: '/ReceiveLightning', params: { network: NETWORK_SPARK } });
    }
  };

  const handleReceiveOnLiquid = () => {
    const n = networkFromContext === NETWORK_LIGHTNING_TESTNET ? NETWORK_LIQUID_TESTNET : NETWORK_LIQUID;
    router.push({ pathname: '/ReceiveLightning', params: { network: n } });
  };

  const handleReceiveOnArk = () => {
    if (networkFromContext === NETWORK_LIGHTNING_TESTNET) {
      Alert.alert('Ark lightning does not have a testnet');
    } else {
      router.push({ pathname: '/ReceiveLightning', params: { network: NETWORK_ARK } });
    }
  };

  const lightningReceiveActions = [
    { children: <Action testID="ReceiveOnSparkButton" network={NETWORK_SPARK} text="Receive on Spark" />, onClick: handleReceiveOnSpark },
    { children: <Action network={NETWORK_LIQUID} text="Receive on Liquid" />, onClick: handleReceiveOnLiquid },
    { children: <Action network={NETWORK_ARK} text="Receive on Ark" />, onClick: handleReceiveOnArk },
    { children: <Action text="Cancel" />, onClick: () => {} },
  ];

  const handleAddressPress = () => {
    if (!lightningAddress || resolvedUsername || !sparkAddress) return;
    const params: ClaimUsernameModalParams = { sparkAddress };
    router.push({ pathname: '/ClaimUsernameModal', params });
  };

  const handlePressIn = () => {
    Animated.timing(pressScaleAnim, {
      toValue: 0.98,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(pressScaleAnim, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  // Show success screen when balance increases
  if (isNewBalanceGT()) {
    return (
      <RadialGradientScreen network={networkFromContext}>
        <Stack.Screen options={{ headerShown: false }} />

        <ScreenHeader title={`Receive on ${capitalizeFirstLetter(network)}`} />

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.contentContainer}>
            <View style={styles.successContainer}>
              <Ionicons name="checkmark-circle" size={80} color="#4CAF50" style={styles.successIcon} />
              <ThemedText testID="NetworkAddressHeader" style={styles.successMessage}>
                Received: +{isNewBalanceGT() ? formatBalance(String(isNewBalanceGT()), getDecimalsByNetwork(network), getDecimalsByNetwork(network)) : ''} {getTickerByNetwork(network)}
              </ThemedText>
            </View>
          </View>
        </ScrollView>
      </RadialGradientScreen>
    );
  }

  return (
    <RadialGradientScreen network={networkFromContext}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScreenHeader title={`Receive on ${capitalizeFirstLetter(network)}`} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentContainer}>
          <View style={styles.qrSection}>
            {!isLoading && lightningAddress ? (
              <View style={styles.qrAndAddressContainer}>
                <View style={styles.qrContainer} testID="LightningAddressQrContainer">
                  <QRCode
                    testID="LightningAddressQrCode"
                    value={lightningAddress}
                    size={320}
                    backgroundColor={'#ffffff'}
                    color="black"
                    logo={require('@/assets/images/logo-qr.png')}
                    logoSize={70}
                    logoMargin={6}
                    logoBackgroundColor={'#000000'}
                    ecl="H"
                    logoBorderRadius={12}
                  />
                </View>

                <Pressable onPress={handleAddressPress} onPressIn={handlePressIn} onPressOut={handlePressOut} testID="LightningAddressButton" disabled={!lightningAddress || isSharing}>
                  <Animated.View style={[styles.addressContainer, { transform: [{ scale: pressScaleAnim }] }]}>
                    <ThemedText style={styles.addressDisplay}>
                      {(resolvedUsername || lightningAddressParts?.local) ?? ''}
                      {(resolvedUsername || lightningAddressParts?.domain) && <ThemedText style={styles.domainDisplay}>@{resolvedUsername ? 'layerz.me' : lightningAddressParts?.domain}</ThemedText>}
                    </ThemedText>
                  </Animated.View>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.qrContainer} testID="QrContainer">
                  {isLoading ? (
                    <View style={styles.qrPlaceholder} testID="LoadingPlaceholder">
                      <ActivityIndicator size="large" color="#ffffff" />
                      <ThemedText style={styles.loadingText}>Loading address...</ThemedText>
                    </View>
                  ) : (
                    <View style={styles.qrPlaceholder}>
                      <ThemedText style={styles.errorText}>No address available</ThemedText>
                    </View>
                  )}
                </View>
              </>
            )}
          </View>

          <View style={styles.actionButtons}>
            <Pressable testID="ShareButton" onPress={handleShare} style={styles.shareButton} disabled={!lightningAddress}>
              <ThemedText style={styles.shareButtonText}>Share...</ThemedText>
            </Pressable>
            <ActionPopupButton actions={lightningReceiveActions} title="Layer to receive on">
              <Pressable style={styles.receiveWithAmountButton} testID="ReceiveOnLightningAddressWithAmountButton" activeOpacity={0.8}>
                <ThemedText style={styles.receiveWithAmountButtonText}>Receive with amount</ThemedText>
              </Pressable>
            </ActionPopupButton>
          </View>
        </View>
      </ScrollView>
    </RadialGradientScreen>
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
    justifyContent: 'space-between',
  },
  qrSection: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 40,
  },
  qrAndAddressContainer: {
    alignItems: 'center',
  },
  qrContainer: {
    padding: 24,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrPlaceholder: {
    width: 320,
    height: 320,
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
  addressContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 16,
    padding: 16,
    width: 368,
    minHeight: 100,
    justifyContent: 'center',
  },
  addressDisplay: {
    textAlign: 'center',
    lineHeight: 24,
    color: 'white',
    fontSize: 14,
  },
  domainDisplay: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  actionButtons: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 12,
  },
  shareButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  receiveWithAmountButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 12,
  },
  receiveWithAmountButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    fontSize: 16,
    color: 'white',
  },
  actionIcon: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconImage: {
    width: 24,
    height: 24,
    color: 'white',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  successIcon: {
    marginBottom: 20,
  },
  successMessage: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});
