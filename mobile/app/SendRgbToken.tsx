import { Ionicons } from '@expo/vector-icons';
import assert from 'assert';
import BigNumber from 'bignumber.js';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Rive, { RiveRef } from 'rive-react-native';

import RadialGradientScreen from '@/components/RadialGradientScreen';
import LongPressButton from '@/components/LongPressButton';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import { ThemedText } from '@/components/ThemedText';
import { overlayBackgroundDeeper } from '@shared/constants/Colors';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { TFeeEstimate } from '@shared/blue_modules/BlueElectrum';
import { walletCanHaveTokens } from '@shared/class/wallets/interface-can-have-tokens';
import { RGBWallet } from '@shared/class/wallets/rgb-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useTokenBalance } from '@shared/hooks/useTokenBalance';
import { capitalizeFirstLetter, formatBalance } from '@shared/modules/string-utils';
import { CachedTokenInfo } from '@shared/types/token-info';
import Pressable from '../components/Pressable';

export type SendRgbTokenParams = {
  tokenId: string;
  tokenSymbol: string;
  tokenName: string;
  tokenDecimals: string;
};

// Enum for the different steps in the send token flow
export enum SendRgbTokenStep {
  Init = 'init',
  Loading = 'loading',
  Signing = 'signing',
  Signed = 'signed',
  Broadcasting = 'broadcasting',
  Success = 'success',
}

export default function SendRgbTokenScreen() {
  const params = useLocalSearchParams<SendRgbTokenParams>();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { scanQr } = useContext(ScanQrContext);

  // State management
  const [step, setStep] = useState<SendRgbTokenStep>(SendRgbTokenStep.Init);
  const [invoice, setInvoice] = useState<string>('');
  const [amountToSend, setAmountToSend] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [token, setToken] = useState<CachedTokenInfo>();

  // Fee state
  const [feeEstimates, setFeeEstimates] = useState<TFeeEstimate | undefined>();
  const [selectedFeeRate, setSelectedFeeRate] = useState<number | undefined>();
  const [customFeeRate, setCustomFeeRate] = useState<number | undefined>();
  const [isFeeSelectorExpanded, setIsFeeSelectorExpanded] = useState(false);
  const [isLoadingFees, setIsLoadingFees] = useState(true);

  // Animation
  const riveRef = useRef<RiveRef>(null);
  const expandAnimation = useSharedValue(0);
  const chevronRotation = useSharedValue(0);

  const tokenPublicKey = params.tokenId || '';
  const { balance } = useTokenBalance(network, accountNumber, tokenPublicKey, BackgroundExecutor);

  // Computed fee rate
  const feeRate = selectedFeeRate ?? customFeeRate ?? feeEstimates?.medium ?? 1;

  const feeName = feeEstimates ? (feeRate === feeEstimates.fast ? 'Fast' : feeRate === feeEstimates.medium ? 'Medium' : feeRate === feeEstimates.slow ? 'Slow' : 'Custom') : 'Network Fee';

  // Colors for gradient background
  const textColor = 'rgba(255, 255, 255, 0.9)';
  const borderColor = 'rgba(255, 255, 255, 0.3)';
  const primaryColor = 'rgba(255, 255, 255, 0.8)';
  const errorColor = 'rgba(255, 100, 100, 0.9)';
  const successColor = 'rgba(75, 181, 67, 1)';

  // Load token info
  useEffect(() => {
    const loadToken = async () => {
      try {
        const wallet = await BackgroundExecutor.lazyInitWallet(network as any, accountNumber);
        assert(walletCanHaveTokens(wallet), 'Not a wallet that can have tokens');

        const tokenBalances = wallet.getTokenBalances();
        for (const t of tokenBalances) {
          if (t.id === tokenPublicKey) {
            setToken(t);
            return;
          }
        }
        setError('Token not found');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    loadToken();
  }, [accountNumber, network, tokenPublicKey]);

  // Load fee estimates
  useEffect(() => {
    const loadFees = async () => {
      setIsLoadingFees(true);
      try {
        const wallet = (await BackgroundExecutor.lazyInitWallet(network as any, accountNumber)) as RGBWallet;
        const fees = await wallet.getFeeEstimates();
        setFeeEstimates(fees);
      } catch (err) {
        console.error('Failed to load fee estimates:', err);
      } finally {
        setIsLoadingFees(false);
      }
    };

    loadFees();
  }, [network, accountNumber]);

  // Fee selector animation
  useEffect(() => {
    const duration = 100;
    if (isFeeSelectorExpanded) {
      expandAnimation.value = withTiming(1, { duration });
      chevronRotation.value = withTiming(1, { duration });
    } else {
      expandAnimation.value = withTiming(0, { duration });
      chevronRotation.value = withTiming(0, { duration });
    }
  }, [isFeeSelectorExpanded, expandAnimation, chevronRotation]);

  const animatedFeeOptionsStyle = useAnimatedStyle(() => {
    const height = interpolate(expandAnimation.value, [0, 1], [0, feeEstimates ? 192 : 0], Extrapolation.CLAMP);
    const opacity = interpolate(expandAnimation.value, [0, 0.1, 1], [0, 0, 1], Extrapolation.CLAMP);
    return { height, opacity };
  });

  const animatedChevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${chevronRotation.value}deg` }] }));

  // Validate invoice format
  const validateInvoice = (inv: string): boolean => {
    return RGBWallet.isRgbInvoice(inv);
  };

  // Send the token
  const actuallySend = async () => {
    try {
      assert(token, 'internal error: token not loaded');
      assert(invoice, 'invoice is required');
      setStep(SendRgbTokenStep.Broadcasting);
      await new Promise((resolve) => setTimeout(resolve, 200));

      const wallet = (await BackgroundExecutor.lazyInitWallet(network as any, accountNumber)) as RGBWallet;
      assert(wallet instanceof RGBWallet, 'Not an RGB wallet');

      const satValueToSend = new BigNumber(amountToSend).multipliedBy(new BigNumber(10).pow(token.decimals)).toFixed(0);

      const transactionId = await wallet.transferToken(token.id, BigInt(satValueToSend), invoice, String(feeRate));

      if (transactionId) {
        setStep(SendRgbTokenStep.Success);
      } else {
        setError('Error: transaction failed (unknown error)');
        setStep(SendRgbTokenStep.Init);
      }
    } catch (error: any) {
      setError(error.message);
      setStep(SendRgbTokenStep.Init);
    }
  };

  // Prepare and sign transaction
  const prepareTransaction = async () => {
    setStep(SendRgbTokenStep.Loading);
    await new Promise((resolve) => setTimeout(resolve, 200));
    setError('');

    try {
      assert(balance, 'internal error: balance not loaded');
      assert(token, 'internal error: token not loaded');
      assert(invoice, 'invoice is required');
      assert(validateInvoice(invoice), 'Invalid RGB invoice format. Must start with rgb:');

      const amt = parseFloat(amountToSend);
      assert(!isNaN(amt), 'Invalid amount');
      assert(amt > 0, 'Amount should be > 0');

      const satValueToSendBN = new BigNumber(amt);
      const satValueToSend = satValueToSendBN.multipliedBy(new BigNumber(10).pow(token.decimals)).toString(10);
      assert(new BigNumber(balance).gte(satValueToSend), 'Not enough balance');

      setStep(SendRgbTokenStep.Signed);
    } catch (error: any) {
      setError(error.message);
      setStep(SendRgbTokenStep.Init);
    }
  };

  const handleScanQR = useCallback(async () => {
    try {
      const scannedInvoice = await scanQr();
      if (scannedInvoice) {
        setInvoice(scannedInvoice);
      }
    } catch (error) {
      console.error('QR scan error:', error);
      Alert.alert('Error', 'Failed to scan QR code');
    }
  }, [scanQr]);

  const handleMaxAmount = useCallback(() => {
    if (balance && token) {
      const formattedBalance = formatBalance(balance, token.decimals, 8);
      setAmountToSend(formattedBalance);
    }
  }, [balance, token]);

  const handleFeeSelection = (rate: number) => {
    setSelectedFeeRate(rate);
    setCustomFeeRate(undefined);
    setIsFeeSelectorExpanded(false);
  };

  const toggleFeeSelector = () => {
    setIsFeeSelectorExpanded(!isFeeSelectorExpanded);
  };

  const resetToHome = () => {
    router.replace('/Home');
  };

  // Validate required parameters
  if (!params.tokenId || !params.tokenSymbol) {
    Alert.alert('Error', 'Missing token information');
    router.back();
    return null;
  }

  const isInputDisabled = step !== SendRgbTokenStep.Init;

  return (
    <RadialGradientScreen network={network}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title={`Send ${token?.name || params.tokenName}`} />
      <View style={styles.networkBadge}>
        <ThemedText style={styles.networkText}>on {capitalizeFirstLetter(network)}</ThemedText>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoidingView}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Success Screen */}
          {step === SendRgbTokenStep.Success ? (
            <View style={styles.successContainer}>
              <View style={styles.riveContainer}>
                <Rive ref={riveRef} autoplay={true} style={styles.riveAnimation} resourceName="success" onError={(error) => console.log('Rive animation error:', error)} />
              </View>
              <Text style={[styles.successTitle, { color: textColor }]}>Transaction Sent!</Text>
              <Text style={[styles.successMessage, { color: textColor, opacity: 0.8 }]}>Your token transfer was successful.</Text>
              <Pressable style={[styles.sendAnotherButton, { backgroundColor: successColor }]} onPress={resetToHome} activeOpacity={0.7}>
                <Text style={styles.sendAnotherButtonText}>Back to Wallet</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* Invoice Input */}
              <View style={styles.section}>
                <Text style={[styles.label, { color: textColor }]}>RGB Invoice</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[styles.input, { color: textColor, borderColor: borderColor, backgroundColor: 'rgba(0, 0, 0, 0.2)' }]}
                    value={invoice}
                    onChangeText={setInvoice}
                    placeholder="rgb:..."
                    testID="invoice-input"
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isInputDisabled}
                  />
                  <Pressable style={styles.scanButton} onPress={handleScanQR} activeOpacity={0.7}>
                    <Ionicons name="scan-outline" size={20} color="rgba(255, 255, 255, 0.8)" />
                  </Pressable>
                </View>
              </View>

              {/* Amount Input */}
              <View style={styles.section}>
                <View style={styles.amountHeader}>
                  <Text style={[styles.label, { color: textColor }]}>Amount</Text>
                  <Pressable onPress={handleMaxAmount} activeOpacity={0.7}>
                    <Text style={[styles.maxButton, { color: primaryColor }]}>MAX</Text>
                  </Pressable>
                </View>
                <TextInput
                  style={[styles.input, { color: textColor, borderColor: borderColor, backgroundColor: 'rgba(0, 0, 0, 0.2)' }]}
                  value={amountToSend}
                  onChangeText={setAmountToSend}
                  placeholder="0.00"
                  testID="amount-input"
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                  keyboardType="decimal-pad"
                  editable={!isInputDisabled}
                />
                <Text style={[styles.balanceText, { color: textColor, opacity: 0.8, marginTop: 8 }]}>
                  {`Available: ${token?.symbol || ''} ${balance ? formatBalance(balance, token?.decimals ?? 2, token?.decimals ?? 2) : '0'}`}
                </Text>
              </View>

              {/* Fee Selector */}
              {!isLoadingFees && feeEstimates && (
                <View style={styles.section}>
                  <View style={styles.feeSelectorContainer}>
                    <Pressable style={isFeeSelectorExpanded ? styles.feeSelectorExpandedHeader : styles.feeSelectorHeader} onPress={toggleFeeSelector}>
                      {isFeeSelectorExpanded ? (
                        <>
                          <ThemedText style={styles.feeSelectorTitle}>Network Fee</ThemedText>
                          <Animated.View style={animatedChevronStyle}>
                            <Ionicons name="chevron-down" size={20} color="rgba(255, 255, 255, 0.6)" />
                          </Animated.View>
                        </>
                      ) : (
                        <>
                          <View style={styles.feeSelectorCollapsedContent}>
                            <ThemedText style={styles.feeSelectorLabel}>Network Fee</ThemedText>
                            <ThemedText style={styles.feeSelectorSelected}>
                              {feeName} - {feeRate} sats/vB
                            </ThemedText>
                          </View>
                          <Animated.View style={animatedChevronStyle}>
                            <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.6)" />
                          </Animated.View>
                        </>
                      )}
                    </Pressable>

                    <Animated.View style={[styles.feeOptionsContainer, animatedFeeOptionsStyle]}>
                      <Pressable style={[styles.feeOption, feeRate === feeEstimates.fast && styles.selectedFeeOption]} onPress={() => handleFeeSelection(feeEstimates.fast)}>
                        <View style={styles.feeOptionContent}>
                          <ThemedText style={styles.feeOptionName}>Fast</ThemedText>
                          <ThemedText style={styles.feeOptionRate}>{feeEstimates.fast} sats/vB</ThemedText>
                        </View>
                      </Pressable>

                      <Pressable style={[styles.feeOption, feeRate === feeEstimates.medium && styles.selectedFeeOption]} onPress={() => handleFeeSelection(feeEstimates.medium)}>
                        <View style={styles.feeOptionContent}>
                          <ThemedText style={styles.feeOptionName}>Medium</ThemedText>
                          <ThemedText style={styles.feeOptionRate}>{feeEstimates.medium} sats/vB</ThemedText>
                        </View>
                      </Pressable>

                      <Pressable style={[styles.feeOption, feeRate === feeEstimates.slow && styles.selectedFeeOption]} onPress={() => handleFeeSelection(feeEstimates.slow)}>
                        <View style={styles.feeOptionContent}>
                          <ThemedText style={styles.feeOptionName}>Slow</ThemedText>
                          <ThemedText style={styles.feeOptionRate}>{feeEstimates.slow} sats/vB</ThemedText>
                        </View>
                      </Pressable>
                    </Animated.View>
                  </View>
                </View>
              )}

              {isLoadingFees && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color={primaryColor} size="small" />
                  <Text style={[styles.loadingText, { color: textColor }]}>Loading fees...</Text>
                </View>
              )}

              {/* Error Display */}
              {error && (
                <View style={[styles.errorContainer, { marginBottom: 16 }]}>
                  <Text style={[styles.errorText, { color: errorColor }]}>{error}</Text>
                </View>
              )}

              {/* Loading States */}
              {step === SendRgbTokenStep.Loading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color={primaryColor} size="small" />
                  <Text style={[styles.loadingText, { color: textColor }]}>Validating...</Text>
                </View>
              )}

              {step === SendRgbTokenStep.Broadcasting && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color={primaryColor} size="small" />
                  <Text style={[styles.loadingText, { color: textColor }]}>Sending...</Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.buttonContainer}>
                {step === SendRgbTokenStep.Init && (
                  <Pressable style={styles.sendButton} onPress={prepareTransaction} activeOpacity={0.7} testID="send-screen-send-button">
                    <Ionicons name="send" size={20} color="#FFFFFF" style={styles.sendIcon} />
                    <Text style={styles.sendButtonText}>Review</Text>
                  </Pressable>
                )}

                {step === SendRgbTokenStep.Signed && (
                  <View style={styles.preparedContainer}>
                    {/* Transaction Summary */}
                    <View style={styles.summaryContainer}>
                      <View style={styles.summaryRow}>
                        <ThemedText style={styles.summaryLabel}>Amount</ThemedText>
                        <ThemedText style={styles.summaryValue}>
                          {amountToSend} {token?.symbol}
                        </ThemedText>
                      </View>
                      <View style={styles.summaryRow}>
                        <ThemedText style={styles.summaryLabel}>Network Fee</ThemedText>
                        <ThemedText style={styles.summaryValue}>{feeRate} sats/vB</ThemedText>
                      </View>
                      <View style={styles.summaryRow}>
                        <ThemedText style={styles.summaryLabel}>To Invoice</ThemedText>
                        <ThemedText style={styles.summaryValueSmall} numberOfLines={1} ellipsizeMode="middle">
                          {invoice}
                        </ThemedText>
                      </View>
                    </View>

                    <LongPressButton
                      onLongPressComplete={actuallySend}
                      style={styles.confirmButton}
                      textStyle={styles.confirmButtonText}
                      title="Hold to confirm send"
                      progressColor="rgba(255, 255, 255, 0.3)"
                    />
                    <Pressable style={styles.cancelButton} onPress={() => setStep(SendRgbTokenStep.Init)} activeOpacity={0.7}>
                      <Text style={[styles.cancelButtonText, { color: textColor }]}>Cancel</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </RadialGradientScreen>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  scanButton: {
    width: 50,
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  amountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  maxButton: {
    fontSize: 14,
    fontWeight: '600',
  },
  balanceText: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 100, 100, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 100, 100, 0.3)',
  },
  errorText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  buttonContainer: {
    marginTop: 24,
  },
  sendIcon: {
    marginRight: 0,
  },
  sendButton: {
    backgroundColor: '#000000',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  sendButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  confirmButton: {
    backgroundColor: '#000000',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  riveContainer: {
    width: '100%',
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  riveAnimation: {
    width: '180%',
    height: '180%',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 280,
  },
  sendAnotherButton: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
  },
  sendAnotherButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  networkBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 30,
  },
  networkText: {
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  preparedContainer: {
    width: '100%',
  },
  summaryContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  summaryValue: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryValueSmall: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '500',
    maxWidth: 200,
  },
  // Fee selector styles
  feeSelectorContainer: {
    marginBottom: 0,
  },
  feeSelectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 17,
    borderRadius: 16,
    height: 64,
  },
  feeSelectorExpandedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 17,
    borderRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    height: 64,
  },
  feeSelectorTitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 18,
    fontWeight: '400',
  },
  feeSelectorCollapsedContent: {
    flex: 1,
  },
  feeSelectorLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
  },
  feeSelectorSelected: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
  },
  feeOptionsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
  },
  feeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    height: 64,
  },
  selectedFeeOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  feeOptionContent: {
    flex: 1,
  },
  feeOptionName: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  feeOptionRate: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
  },
});
