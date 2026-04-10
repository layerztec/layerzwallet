import { Ionicons } from '@expo/vector-icons';
import assert from 'assert';
import BigNumber from 'bignumber.js';
import { Stack, useRouter } from 'expo-router';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Rive, { RiveRef } from 'rive-react-native';
import Pressable from '../../components/Pressable';

import RadialGradientScreen from '@/components/RadialGradientScreen';
import ScreenSendHeader from '@/components/navigation/ScreenSendHeader';
import { ThemedText } from '@/components/ThemedText';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { ArkWallet } from '@shared/class/wallets/ark-wallet';
import { BreezWallet } from '@shared/class/wallets/breez-wallet';
import { SparkWallet } from '@shared/class/wallets/spark-wallet';
import { TLightningWallet } from '@shared/types/TWallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { useCachedExchangeRate } from '@shared/hooks/useCachedExchangeRate';
import { useSelectedFiat } from '@shared/hooks/useSelectedFiat';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { formatFiatDisplay } from '@shared/modules/fiat-utils';
import { formatBalance } from '@shared/modules/string-utils';
import { NETWORK_BITCOIN } from '@shared/types/networks';
import { useSendFlow } from './_layout';
import { sleep } from '@shared/modules/sleep';

const maxFeePercent = 5; // hardcoded at the moment

const SendConfirmLightning: React.FC = () => {
  const router = useRouter();
  const { lightning, network } = useSendFlow();
  const { accountNumber } = useContext(AccountNumberContext);
  const fiat = useSelectedFiat();
  const { exchangeRate } = useCachedExchangeRate(NETWORK_BITCOIN);

  assert(lightning && lightning.layer && lightning.invoice, 'No lightning data available');
  const decoded = lightning.decodedInvoice;
  assert(decoded, 'No decoded invoice');
  const invoiceAmountSats = decoded.satoshis;
  assert(invoiceAmountSats, 'No satoshis in decoded invoice');

  const [error, setError] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showRiveAnimation, setShowRiveAnimation] = useState(false);
  const [hideHeader, setHideHeader] = useState(false);
  const walletRef = useRef<TLightningWallet | null>(null);

  // Animation values
  const detailsOpacity = useSharedValue(1);
  const sendToOpacity = useSharedValue(1);
  const totalTop = useSharedValue(32);
  const riveRef = useRef<RiveRef>(null);

  // Animated styles
  const detailsAnimatedStyle = useAnimatedStyle(() => ({ opacity: detailsOpacity.value }));
  const sendToAnimatedStyle = useAnimatedStyle(() => ({ opacity: sendToOpacity.value }));
  const totalAnimatedStyle = useAnimatedStyle(() => ({ top: totalTop.value }));

  // Extract memo from invoice tags
  const memoTag = decoded.tags?.find((tag: any) => tag.tagName === 'description');
  const invoiceMemo = memoTag ? String(memoTag.data) : undefined;

  // Initialize wallet
  useEffect(() => {
    const initializeWallet = async () => {
      try {
        const w = await BackgroundExecutor.lazyInitWallet(lightning.layer!, accountNumber);
        assert(w instanceof BreezWallet || w instanceof SparkWallet || w instanceof ArkWallet);
        walletRef.current = w;
      } catch (err) {
        console.error('Failed to initialize wallet:', err);
        setError('Failed to initialize wallet. Please try again.');
      }
    };

    initializeWallet();

    return () => {
      walletRef.current = null;
    };
  }, [lightning.layer, accountNumber]);

  // Animate sections when success
  useEffect(() => {
    let timeout1: ReturnType<typeof setTimeout>;
    let timeout2: ReturnType<typeof setTimeout>;

    if (isSuccess) {
      detailsOpacity.value = withTiming(0, { duration: 600 });
      sendToOpacity.value = withTiming(0, { duration: 600 });

      timeout1 = setTimeout(() => {
        setHideHeader(true);
        totalTop.value = withTiming(480, {
          duration: 800,
          easing: Easing.out(Easing.ease),
        });
      }, 600);

      timeout2 = setTimeout(() => {
        setShowRiveAnimation(true);
      }, 1400);
    } else {
      detailsOpacity.value = 1;
      sendToOpacity.value = 1;
      totalTop.value = 32;
      setShowRiveAnimation(false);
      setHideHeader(false);
    }

    return () => {
      if (timeout1) clearTimeout(timeout1);
      if (timeout2) clearTimeout(timeout2);
    };
  }, [isSuccess, detailsOpacity, sendToOpacity, totalTop]);

  const sendPayment = async () => {
    if (!walletRef.current) {
      setError('Internal error: wallet not initialized');
      return;
    }

    setIsSending(true);
    setError('');

    try {
      await sleep(200); // propagate state
      const paymentResponse = await walletRef.current.payLightningInvoice(lightning.invoice, maxFeePercent);
      if (paymentResponse) {
        setIsSuccess(true);
      } else {
        setError('Payment failed');
      }
    } catch (error: any) {
      console.error('Send payment error:', error);
      setError(error.message || 'Failed to send payment');
    } finally {
      setIsSending(false);
    }
  };

  const handleHome = () => {
    router.replace('/(tabs)/home');
  };

  // Calculate fee from invoice amount
  const feeBN = new BigNumber(invoiceAmountSats).dividedBy(100).multipliedBy(maxFeePercent);
  const feeSats = Math.max(Math.round(feeBN.toNumber()), 2);
  const totalSats = invoiceAmountSats + feeSats;

  const networkDecimals = getDecimalsByNetwork(NETWORK_BITCOIN);
  const ticker = getTickerByNetwork(NETWORK_BITCOIN);

  const amountDisplay = formatBalance(String(invoiceAmountSats), networkDecimals);
  const feeDisplay = formatBalance(String(feeSats), networkDecimals);
  const totalDisplay = formatBalance(String(totalSats), networkDecimals);

  // USD conversions
  const amountUsdValue = exchangeRate ? formatFiatDisplay(new BigNumber(invoiceAmountSats).dividedBy(new BigNumber(10).pow(networkDecimals)).multipliedBy(Number(exchangeRate)).toFixed(2), fiat) : '';
  const feeUsd = exchangeRate ? formatFiatDisplay(new BigNumber(feeSats).dividedBy(new BigNumber(10).pow(networkDecimals)).multipliedBy(Number(exchangeRate)).toFixed(2), fiat) : '';
  const totalUsd = exchangeRate ? formatFiatDisplay(new BigNumber(totalSats).dividedBy(new BigNumber(10).pow(networkDecimals)).multipliedBy(Number(exchangeRate)).toFixed(2), fiat) : '';

  // Format invoice display
  let invoiceDisplay = lightning.invoice;
  if (lightning.invoice.length > 20) {
    invoiceDisplay = lightning.invoice.substring(0, 10) + '...' + lightning.invoice.substring(lightning.invoice.length - 10);
  }

  return (
    <RadialGradientScreen network={network} scroll={false}>
      <Stack.Screen options={{ headerShown: false }} />
      {!hideHeader && <ScreenSendHeader network={network} title={`Send ${ticker}`} />}

      <View style={styles.fixedContainer}>
        <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.container}>
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
                  <Pressable style={styles.backButton} onPress={() => router.back()}>
                    <ThemedText style={styles.backButtonText}>Go Back</ThemedText>
                  </Pressable>
                </View>
              ) : (
                <>
                  {/* Total Section */}
                  <Animated.View style={[styles.totalSection, totalAnimatedStyle]}>
                    <View style={styles.sectionHeader}>
                      <ThemedText style={styles.sectionHeaderText}>Total</ThemedText>
                    </View>
                    <View style={styles.totalCard}>
                      <ThemedText style={styles.totalAmount}>
                        {totalDisplay} {ticker}
                      </ThemedText>
                      {totalUsd && <ThemedText style={styles.totalUsd}>{totalUsd}</ThemedText>}
                    </View>
                  </Animated.View>

                  {/* Details Section */}
                  <Animated.View style={[styles.detailsSection, detailsAnimatedStyle]}>
                    <View style={styles.sectionHeader}>
                      <ThemedText style={styles.sectionHeaderText}>Details</ThemedText>
                    </View>
                    <View style={styles.detailsCard}>
                      <View style={styles.detailRow}>
                        <ThemedText style={styles.detailLabel}>Amount</ThemedText>
                        <View style={styles.detailValueContainer}>
                          <ThemedText style={styles.detailValue}>
                            {amountDisplay} {ticker}
                          </ThemedText>
                          {amountUsdValue && <ThemedText style={styles.detailUsd}>{amountUsdValue}</ThemedText>}
                        </View>
                      </View>

                      <View style={styles.divider} />

                      <View style={styles.detailRow}>
                        <ThemedText style={styles.detailLabel}>Network Fee</ThemedText>
                        <View style={styles.detailValueContainer}>
                          <ThemedText style={styles.detailValue}>
                            {feeDisplay} {ticker}
                          </ThemedText>
                          {feeUsd && <ThemedText style={styles.detailUsd}>{feeUsd}</ThemedText>}
                        </View>
                      </View>

                      {invoiceMemo && (
                        <>
                          <View style={styles.divider} />
                          <View style={styles.detailRow}>
                            <ThemedText style={styles.detailLabel}>Memo</ThemedText>
                            <ThemedText style={styles.detailValue}>{invoiceMemo}</ThemedText>
                          </View>
                        </>
                      )}
                    </View>
                  </Animated.View>

                  {/* Send to Section */}
                  <Animated.View style={[styles.sendToSection, sendToAnimatedStyle]}>
                    <View style={styles.sectionHeader}>
                      <ThemedText style={styles.sectionHeaderText}>Invoice</ThemedText>
                    </View>
                    <View style={styles.addressCard}>
                      <ThemedText style={styles.invoiceDisplay}>{invoiceDisplay}</ThemedText>
                    </View>
                  </Animated.View>
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        {!error && (
          <Pressable style={[styles.sendButton, isSending && styles.disabledButton]} onPress={isSuccess ? handleHome : sendPayment} disabled={isSending} testID="send-lightning-confirm-button">
            <ThemedText style={styles.sendButtonText} testID={isSuccess ? 'send-lightning-success-text' : undefined}>
              {isSuccess ? 'Back to Wallet' : isSending ? 'Sending...' : 'Confirm Send'}
            </ThemedText>
          </Pressable>
        )}
      </View>
    </RadialGradientScreen>
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
  invoiceDisplay: {
    fontFamily: 'monospace',
    lineHeight: 24,
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    textAlign: 'center',
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
  disabledButton: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: '600',
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

export default SendConfirmLightning;
