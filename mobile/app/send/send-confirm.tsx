import { Ionicons } from '@expo/vector-icons';
import BigNumber from 'bignumber.js';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Rive, { RiveRef } from 'rive-react-native';

import GradientScreen from '@/components/GradientScreen';
import ScreenSendHeader from '@/components/navigation/ScreenSendHeader';
import { ThemedText } from '@/components/ThemedText';
import * as BlueElectrum from '@shared/blue_modules/BlueElectrum';
import { getNetworkGradient } from '@shared/constants/Colors';
import { useCachedExchangeRate } from '@shared/hooks/useCachedExchangeRate';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { formatBalance } from '@shared/modules/string-utils';
import { useSendFlow } from './_layout';

const SendConfirm: React.FC = () => {
  const router = useRouter();
  const { network, address, amount, bitcoin } = useSendFlow();
  const { exchangeRate } = useCachedExchangeRate(network, 'USD');

  const [error, setError] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [showRiveAnimation, setShowRiveAnimation] = useState(false);
  const [hideHeader, setHideHeader] = useState(false);

  // Animation values
  const detailsOpacity = useSharedValue(1);
  const sendToOpacity = useSharedValue(1);
  const totalTop = useSharedValue(32); // Initial top position for total section
  const riveRef = useRef<RiveRef>(null);

  const createdTransaction = bitcoin?.createdTransaction;
  const txhex = createdTransaction?.txhex || '';
  const actualFee = createdTransaction?.actualFee || 0;
  const feeInNative = formatBalance(String(actualFee), getDecimalsByNetwork(network), 8);
  const decimals = getDecimalsByNetwork(network);

  // Get network-specific background color
  const networkGradient = getNetworkGradient(network);
  const networkBackgroundColor = networkGradient[0];

  // USD conversions
  const usdValue = exchangeRate
    ? `$${BigNumber(amount || '0')
        .multipliedBy(Number(exchangeRate))
        .toFixed(2)}`
    : '';
  const feeInNativeUnits = BigNumber(actualFee).dividedBy(new BigNumber(10).pow(decimals));
  const usdFee = exchangeRate ? `$${feeInNativeUnits.multipliedBy(Number(exchangeRate)).toFixed(2)}` : '';

  // Calculate total (amount + fee)
  const totalAmount = BigNumber(amount || '0').plus(feeInNativeUnits);

  // Calculate total USD
  const totalUsd = exchangeRate ? `$${totalAmount.multipliedBy(Number(exchangeRate)).toFixed(2)}` : '';

  const broadcast = async () => {
    setIsBroadcasting(true);
    setError('');

    try {
      if (!BlueElectrum.mainConnected) {
        await BlueElectrum.connectMain();
      }

      const result = await BlueElectrum.broadcastV2(txhex);
      if (!result) {
        throw new Error('Transaction broadcast failed');
      }

      setIsSuccess(true);
    } catch (error: any) {
      console.error('Failed to broadcast transaction:', error);
      setError(error.message || 'Failed to broadcast transaction');
    } finally {
      setIsBroadcasting(false);
    }
  };

  // Animate sections when success - sequential animations
  useEffect(() => {
    let timeout1: ReturnType<typeof setTimeout>;
    let timeout2: ReturnType<typeof setTimeout>;

    if (isSuccess) {
      // Step 1: Animate details and send to sections out using only opacity (600ms)
      detailsOpacity.value = withTiming(0, { duration: 600 });
      sendToOpacity.value = withTiming(0, { duration: 600 });

      // Step 2: After sections fade out, move total section down smoothly
      timeout1 = setTimeout(() => {
        setHideHeader(true);
        totalTop.value = withTiming(480, {
          duration: 800,
          easing: Easing.out(Easing.ease),
        });
      }, 600);

      // Step 3: After total section finishes moving, show Rive animation
      timeout2 = setTimeout(() => {
        setShowRiveAnimation(true);
      }, 1400);
    } else {
      // Reset animations if not success
      detailsOpacity.value = 1;
      sendToOpacity.value = 1;
      totalTop.value = 32;
      setShowRiveAnimation(false);
      setHideHeader(false);
    }

    // Cleanup timeouts on unmount or when isSuccess changes
    return () => {
      if (timeout1) clearTimeout(timeout1);
      if (timeout2) clearTimeout(timeout2);
    };
  }, [isSuccess, detailsOpacity, sendToOpacity, totalTop]);

  const handleBack = () => {
    router.replace('/Home');
  };

  const formatAddressWithOpacity = (addr: string) => {
    if (!addr) return null;
    if (addr.length < 8) return <ThemedText style={styles.addressDisplay}>{addr}</ThemedText>;

    // Split address in half
    const midpoint = Math.floor(addr.length / 2);
    const firstHalf = addr.substring(0, midpoint);
    const secondHalf = addr.substring(midpoint);

    // Highlight first 4 and last 4 characters
    const first4 = addr.substring(0, 4);
    const last4 = addr.substring(addr.length - 4);

    const nonBreakingSpace = '\u00A0';

    return (
      <View style={styles.addressContainer}>
        {/* First line - contains first 4 chars */}
        <ThemedText style={styles.addressDisplay} allowFontScaling={false}>
          <ThemedText style={[styles.addressHighlight, styles.addressLetterSpacing]} allowFontScaling={false}>
            {first4}
          </ThemedText>
          <ThemedText style={[styles.addressDisplay, styles.addressLetterSpacing]} allowFontScaling={false}>
            {nonBreakingSpace}
            {firstHalf.substring(4)}
          </ThemedText>
        </ThemedText>
        {/* Second line - contains last 4 chars */}
        <ThemedText style={styles.addressDisplay} allowFontScaling={false}>
          <ThemedText style={[styles.addressDisplay, styles.addressLetterSpacing]} allowFontScaling={false}>
            {secondHalf.substring(0, secondHalf.length - 4)}
            {nonBreakingSpace}
          </ThemedText>
          <ThemedText style={[styles.addressHighlight, styles.addressLetterSpacing]} allowFontScaling={false}>
            {last4}
          </ThemedText>
        </ThemedText>
      </View>
    );
  };

  // Animated styles
  const detailsAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: detailsOpacity.value,
    };
  });

  const sendToAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: sendToOpacity.value,
    };
  });

  const totalAnimatedStyle = useAnimatedStyle(() => {
    return {
      top: totalTop.value,
    };
  });

  // Redirect back if no transaction is available
  if (!createdTransaction) {
    router.replace('/send/send-amount');
    return null;
  }

  return (
    <GradientScreen variant={network} scroll={false}>
      <Stack.Screen options={{ headerShown: false }} />
      {!hideHeader && <ScreenSendHeader network={network} title={`Send ${getTickerByNetwork(network)}`} />}

      <View style={styles.fixedContainer}>
        <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.container}>
              {/* Rive Success Animation */}
              {showRiveAnimation && (
                <View style={styles.riveContainer}>
                  <Rive
                    ref={riveRef}
                    autoplay={true}
                    style={styles.riveAnimation}
                    resourceName="success"
                    onError={(error) => {
                      console.log('Rive animation error:', error);
                    }}
                  />
                </View>
              )}

              {error ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={40} color="#FF3B30" />
                  <ThemedText style={styles.errorTitle}>Error</ThemedText>
                  <ThemedText style={styles.errorText}>{error}</ThemedText>
                  <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <ThemedText style={styles.backButtonText}>Go Back</ThemedText>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {/* Total Section */}
                  <Animated.View style={[styles.totalSection, totalAnimatedStyle]}>
                    <View style={styles.sectionHeader}>
                      <ThemedText style={styles.sectionHeaderText}>Total</ThemedText>
                    </View>
                    <View style={[styles.totalCard, { backgroundColor: networkBackgroundColor }]}>
                      <ThemedText style={styles.totalAmount}>
                        {totalAmount.toString()} {getTickerByNetwork(network)}
                      </ThemedText>
                      {totalUsd && <ThemedText style={styles.totalUsd}>{totalUsd}</ThemedText>}
                    </View>
                  </Animated.View>

                  {/* Details Section */}
                  <Animated.View style={[styles.detailsSection, detailsAnimatedStyle]}>
                    <View style={styles.sectionHeader}>
                      <ThemedText style={styles.sectionHeaderText}>Details</ThemedText>
                    </View>
                    <View style={[styles.detailsCard, { backgroundColor: networkBackgroundColor }]}>
                      <View style={styles.detailRow}>
                        <ThemedText style={styles.detailLabel}>Amount</ThemedText>
                        <View style={styles.detailValueContainer}>
                          <ThemedText style={styles.detailValue}>
                            {amount} {getTickerByNetwork(network)}
                          </ThemedText>
                          {usdValue && <ThemedText style={styles.detailUsd}>{usdValue}</ThemedText>}
                        </View>
                      </View>

                      <View style={styles.divider} />

                      <View style={styles.detailRow}>
                        <ThemedText style={styles.detailLabel}>Network Fee</ThemedText>
                        <View style={styles.detailValueContainer}>
                          <ThemedText style={styles.detailValue}>
                            {feeInNative} {getTickerByNetwork(network)}
                          </ThemedText>
                          {usdFee && <ThemedText style={styles.detailUsd}>{usdFee}</ThemedText>}
                        </View>
                      </View>
                    </View>
                  </Animated.View>

                  {/* Send to Section */}
                  <Animated.View style={[styles.sendToSection, sendToAnimatedStyle]}>
                    <View style={styles.sectionHeader}>
                      <ThemedText style={styles.sectionHeaderText}>Send to</ThemedText>
                    </View>
                    <View style={[styles.addressCard, { backgroundColor: networkBackgroundColor }]}>{formatAddressWithOpacity(address)}</View>
                  </Animated.View>
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        {!error && (
          <TouchableOpacity style={[styles.sendButton, isBroadcasting && styles.disabledButton]} onPress={isSuccess ? handleBack : broadcast} disabled={isBroadcasting}>
            <ThemedText style={styles.sendButtonText}>{isSuccess ? 'Back to Wallet' : isBroadcasting ? 'Sending...' : 'Confirm Send'}</ThemedText>
          </TouchableOpacity>
        )}
      </View>
    </GradientScreen>
  );
};

const styles = StyleSheet.create({
  fixedContainer: {
    flex: 1,
    position: 'relative',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 80,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 24,
  },
  totalSection: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 18,
    padding: 2,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 4,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'left',
  },
  totalCard: {
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 0,
    alignItems: 'center',
    gap: 4,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  totalUsd: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
  },
  detailsSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 18,
    padding: 2,
    marginTop: 198,
    marginBottom: 32,
  },
  detailsCard: {
    borderRadius: 20,
    paddingVertical: 16,
  },
  sendToSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 18,
    padding: 2,
    marginBottom: 32,
  },
  addressCard: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 79,
    justifyContent: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 0,
    paddingHorizontal: 16,
  },
  detailLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: '400',
  },
  detailValueContainer: {
    alignItems: 'flex-end',
    gap: 2,
  },
  detailValue: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
  },
  detailUsd: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 16,
    fontWeight: '400',
  },
  addressDisplay: {
    fontFamily: 'monospace',
    lineHeight: 24,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 18,
    textAlign: 'center',
    flexShrink: 0,
  },
  addressHighlight: {
    color: 'rgb(255, 255, 255)',
  },
  addressLetterSpacing: {
    letterSpacing: 1.6,
  },
  addressContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 8,
  },
  riveContainer: {
    width: '100%',
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 160,
    marginBottom: 20,
  },
  riveAnimation: {
    width: '180%',
    height: '180%',
  },
  sendButton: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    height: 56,
    zIndex: 1000,
  },
  sendButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  backButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '80%',
    alignItems: 'center',
  },
  backButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SendConfirm;
