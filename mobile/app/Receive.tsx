import { Ionicons } from '@expo/vector-icons';
import BigNumber from 'bignumber.js';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, Share, StyleSheet, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import GradientScreen from '@/components/GradientScreen';
import { buildScreenHeaderOptions } from '@/components/navigation/ScreenHeader';
import { ThemedText } from '@/components/ThemedText';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useBalance } from '@shared/hooks/useBalance';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { capitalizeFirstLetter, formatBalance } from '@shared/modules/string-utils';
import { StringNumber } from '@shared/types/string-number';
import { NETWORK_SPARK, NETWORK_STACKS, Networks } from '@shared/types/networks';
import { getGradientPrimaryColor } from '@/utils/gradientUtils';
import { walletCanHaveTokens } from '@shared/class/wallets/interface-can-have-tokens';

export type ReceiveTokenProps = {
  network: Networks;
};

export default function ReceiveScreen() {
  const { network: networkFromContext } = useContext(NetworkContext);
  const params = useLocalSearchParams<ReceiveTokenProps>();
  const network = (params.network ?? networkFromContext) as Networks;
  const headerTitle = `Receive on ${capitalizeFirstLetter(network)}`;
  const { accountNumber } = useContext(AccountNumberContext);
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [oldBalance, setOldBalance] = useState<StringNumber>('');
  const [isCopied, setIsCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const pressScaleAnim = useRef(new Animated.Value(1)).current;
  const { balance } = useBalance(network, accountNumber, BackgroundExecutor);
  const [stacksTokenReceiveInfo, setStacksTokenReceiveInfo] = useState<{
    symbol: string;
    name: string;
    decimals: number;
    amountDelta: StringNumber;
  } | null>(null);
  const tokenInitialRef = React.useRef<Map<string, string> | null>(null);
  const tokenPollRef = React.useRef<NodeJS.Timeout | number | null>(null);

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

  // tokens polling: cache initial holdings and detect increases
  useEffect(() => {
    if (network !== NETWORK_STACKS && network !== NETWORK_SPARK) {
      return;
    }

    let cancelled = false;

    const start = async () => {
      const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
      if (cancelled) return;
      if (!walletCanHaveTokens(wallet)) return;

      await wallet.fetchTokenBalances();
      const initialMap = new Map<string, string>();
      for (const token of wallet.getTokenBalances()) {
        initialMap.set(token.id, String(token.balance ?? '0'));
      }
      tokenInitialRef.current = initialMap;

      const poll = async () => {
        const w = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
        if (!walletCanHaveTokens(w)) return;
        await w.fetchTokenBalances();
        const currentTokens = w.getTokenBalances();
        for (const token of currentTokens) {
          const key = token.id;
          const current = new BigNumber(String(token.balance ?? '0'));
          const initial = new BigNumber(tokenInitialRef.current?.get(key) ?? '0');
          if (current.gt(initial)) {
            const delta = current.minus(initial).toString(10);
            setStacksTokenReceiveInfo({
              symbol: token.symbol,
              name: token.name,
              decimals: token.decimals,
              amountDelta: delta,
            });
            if (tokenPollRef.current) {
              clearInterval(tokenPollRef.current as number);
            }
            return;
          }
        }
      };

      tokenPollRef.current = setInterval(poll, 4_000);
    };

    start();

    return () => {
      cancelled = true;
      if (tokenPollRef.current) {
        clearInterval(tokenPollRef.current as number);
      }
    };
  }, [accountNumber, network]);

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
    setIsSharing(true);
    try {
      await Share.share({
        message: `My ${capitalizeFirstLetter(network)} address: ${address}`,
      });
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyAddress = async () => {
    if (address) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setIsCopied(true);

        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start();
      });

      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();

      await Clipboard.setStringAsync(address);
      setTimeout(() => {
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start(() => {
          setIsCopied(false);

          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }).start();
        });
      }, 2000);
    }
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

  const formatAddressWithOpacity = (addr: string) => {
    if (!addr) return null;
    const groups = addr.match(/.{1,4}/g) || [];

    return (
      <>
        {groups.map((group, index) => {
          const isFirstOrLast = index === 0 || index === groups.length - 1;
          const opacity = isFirstOrLast ? 1 : 0.6;

          return (
            <ThemedText key={index} style={[styles.addressDisplay, { opacity }]}>
              {group}
              {index < groups.length - 1 && '  '}
            </ThemedText>
          );
        })}
      </>
    );
  };

  if ((network === NETWORK_STACKS || network === NETWORK_SPARK) && stacksTokenReceiveInfo) {
    return (
      <GradientScreen variant={network}>
        <Stack.Screen options={buildScreenHeaderOptions({ title: headerTitle })} />

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.contentContainer}>
            <View style={styles.tokenSuccessContainer}>
              <Ionicons name="checkmark-circle" size={64} color="#4CAF50" style={styles.tokenSuccessIcon} />
              <ThemedText style={styles.tokenSuccessTitle}>
                Received: +{formatBalance(String(stacksTokenReceiveInfo.amountDelta), stacksTokenReceiveInfo.decimals, 8)} {stacksTokenReceiveInfo.symbol}
              </ThemedText>
              <ThemedText style={styles.tokenSuccessSubtitle}>{stacksTokenReceiveInfo.name}</ThemedText>
            </View>
          </View>
        </ScrollView>
      </GradientScreen>
    );
  }

  if (isNewBalanceGT()) {
    return (
      <GradientScreen variant={network}>
        <Stack.Screen options={buildScreenHeaderOptions({ title: headerTitle })} />

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
    <GradientScreen variant={network}>
      <Stack.Screen options={buildScreenHeaderOptions({ title: headerTitle })} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentContainer}>
          <View style={styles.qrSection}>
            {!isLoading && address ? (
              <Pressable onPress={handleCopyAddress} onPressIn={handlePressIn} onPressOut={handlePressOut} testID="CopyAddressButton" disabled={!address || isCopied || isSharing}>
                <Animated.View style={[styles.qrAndAddressContainer, { transform: [{ scale: pressScaleAnim }] }]}>
                  <View style={styles.qrContainer} testID="QrContainer">
                    <QRCode
                      testID="AddressQrCode"
                      value={address}
                      size={320}
                      backgroundColor={'#ffffff'}
                      color="black"
                      logo={require('@/assets/images/logo-qr.png')}
                      logoSize={70}
                      logoMargin={6}
                      logoBackgroundColor={'#000000'}
                      logoBorderRadius={12}
                    />
                  </View>

                  <View style={styles.addressContainer}>
                    {isCopied ? (
                      <Animated.View
                        style={{
                          transform: [{ scale: scaleAnim }],
                          opacity: opacityAnim,
                        }}
                      >
                        <ThemedText style={styles.addressDisplay} testID="AddressText">
                          Copied ✓
                        </ThemedText>
                      </Animated.View>
                    ) : (
                      <Animated.View
                        style={[
                          styles.addressTextContainer,
                          {
                            transform: [{ scale: scaleAnim }],
                            opacity: opacityAnim,
                          },
                        ]}
                        testID="AddressText"
                      >
                        {formatAddressWithOpacity(address)}
                      </Animated.View>
                    )}
                  </View>
                </Animated.View>
              </Pressable>
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
            <TouchableOpacity testID="ShareButton" onPress={handleShare} style={styles.shareButton} disabled={!address}>
              <ThemedText style={styles.shareButtonText}>Share...</ThemedText>
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
    justifyContent: 'space-between', // This will push share button to bottom
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
  addressTextContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtons: {
    width: '100%',
    gap: 8,
    marginBottom: 20, // Add some margin from the bottom edge
  },
  shareButton: {
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
  successMessage: {
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginTop: 100,
  },
  tokenSuccessContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  tokenSuccessIcon: {
    marginBottom: 16,
  },
  tokenSuccessTitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  tokenSuccessSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    textAlign: 'center',
  },
});
