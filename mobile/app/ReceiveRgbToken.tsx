import { Ionicons } from '@expo/vector-icons';
import assert from 'assert';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useContext, useRef, useState } from 'react';
import { ActivityIndicator, Animated, KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import ScreenHeader from '@/components/navigation/ScreenHeader';
import RadialGradientScreen from '@/components/RadialGradientScreen';
import { ThemedText } from '@/components/ThemedText';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { RGBWallet } from '@shared/class/wallets/rgb-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { capitalizeFirstLetter } from '@shared/modules/string-utils';
import { NETWORK_RGB, NETWORK_RGB_TESTNET, Networks } from '@shared/types/networks';
import Pressable from '../components/Pressable';

export type ReceiveRgbTokenProps = {
  network: Networks;
};

enum ReceiveStep {
  EnterAmount = 'enter_amount',
  ShowInvoice = 'show_invoice',
}

export default function ReceiveRgbTokenScreen() {
  const params = useLocalSearchParams<ReceiveRgbTokenProps>();
  const network = (params.network ?? NETWORK_RGB_TESTNET) as typeof NETWORK_RGB | typeof NETWORK_RGB_TESTNET;
  const { accountNumber } = useContext(AccountNumberContext);
  const [step, setStep] = useState<ReceiveStep>(ReceiveStep.EnterAmount);
  const [amount, setAmount] = useState('');
  const [invoice, setInvoice] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const pressScaleAnim = useRef(new Animated.Value(1)).current;

  const handleGenerateInvoice = useCallback(async () => {
    const amountNumber = parseInt(amount, 10);
    if (!amount || isNaN(amountNumber) || amountNumber <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
      assert(wallet instanceof RGBWallet, 'Not an RGB wallet');
      const receiveInvoice = await wallet.getWitnessReceiveInvoice(amountNumber);
      setInvoice(receiveInvoice);
      setStep(ReceiveStep.ShowInvoice);
    } catch (err) {
      console.error('Error getting RGB receive invoice:', err);
      setError('Failed to generate receive invoice');
    } finally {
      setIsLoading(false);
    }
  }, [network, accountNumber, amount]);

  const handleAmountChange = (text: string) => {
    // Only allow positive integers
    const normalized = text.replace(/[^0-9]/g, '');
    setAmount(normalized);
    setError(null);
  };

  const handleShare = async () => {
    if (!invoice || isSharing) return;
    setIsSharing(true);
    try {
      await Share.share({
        message: `My RGB invoice: ${invoice}`,
      });
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyInvoice = async () => {
    if (invoice) {
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

      await Clipboard.setStringAsync(invoice);
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

  // Amount input step
  if (step === ReceiveStep.EnterAmount) {
    return (
      <RadialGradientScreen network={network}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title={`Receive on ${capitalizeFirstLetter(network)}`} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoidingView}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.amountInputContainer}>
              <ThemedText style={styles.label}>Enter Amount</ThemedText>
              <ThemedText style={styles.sublabel}>Specify the token amount you want to receive</ThemedText>

              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={handleAmountChange}
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                keyboardType="number-pad"
                testID="AmountInput"
                autoFocus
              />

              {error && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color="#FF6B6B" />
                  <ThemedText style={styles.errorText}>{error}</ThemedText>
                </View>
              )}

              <Pressable
                style={[styles.generateButton, (!amount || isLoading) && styles.generateButtonDisabled]}
                onPress={handleGenerateInvoice}
                disabled={!amount || isLoading}
                testID="GenerateInvoiceButton"
              >
                {isLoading ? <ActivityIndicator size="small" color="#ffffff" /> : <ThemedText style={styles.generateButtonText}>Generate Invoice</ThemedText>}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </RadialGradientScreen>
    );
  }

  // Show invoice step
  return (
    <RadialGradientScreen network={network}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScreenHeader title={`Receive on ${capitalizeFirstLetter(network)}`} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentContainer}>
          <View style={styles.qrSection}>
            {!isLoading && invoice && !error ? (
              <Pressable onPress={handleCopyInvoice} onPressIn={handlePressIn} onPressOut={handlePressOut} testID="CopyInvoiceButton" disabled={!invoice || isCopied || isSharing}>
                <Animated.View style={[styles.qrAndAddressContainer, { transform: [{ scale: pressScaleAnim }] }]}>
                  <View style={styles.qrContainer} testID="QrContainer">
                    <QRCode
                      testID="InvoiceQrCode"
                      value={invoice}
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
                    <ThemedText style={styles.amountBadge}>Amount: {amount}</ThemedText>
                    {isCopied ? (
                      <Animated.View
                        style={{
                          transform: [{ scale: scaleAnim }],
                          opacity: opacityAnim,
                        }}
                      >
                        <ThemedText style={styles.addressDisplay} testID="InvoiceText">
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
                        testID="InvoiceText"
                      >
                        <ThemedText style={styles.addressDisplay}>{invoice}</ThemedText>
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
                      <ThemedText style={styles.loadingText}>Generating invoice...</ThemedText>
                    </View>
                  ) : error ? (
                    <View style={styles.qrPlaceholder}>
                      <Ionicons name="alert-circle" size={48} color="#FF6B6B" />
                      <ThemedText style={styles.errorText}>{error}</ThemedText>
                    </View>
                  ) : (
                    <View style={styles.qrPlaceholder}>
                      <ThemedText style={styles.errorText}>No invoice available</ThemedText>
                    </View>
                  )}
                </View>
              </>
            )}
          </View>

          <View style={styles.actionButtons}>
            <Pressable testID="ShareButton" onPress={handleShare} style={styles.shareButton} disabled={!invoice}>
              <ThemedText style={styles.shareButtonText}>Share...</ThemedText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </RadialGradientScreen>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  amountInputContainer: {
    flex: 1,
    paddingTop: 40,
  },
  label: {
    fontSize: 24,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
  },
  sublabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginBottom: 40,
  },
  amountInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 16,
    padding: 20,
    fontSize: 32,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
    textAlignVertical: 'center',
    marginBottom: 24,
    width: '100%',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  generateButton: {
    backgroundColor: '#000000',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateButtonDisabled: {
    opacity: 0.5,
  },
  generateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
    borderRadius: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  errorText: {
    color: '#FF6B6B',
    marginLeft: 4,
    textAlign: 'center',
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
  amountBadge: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
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
    marginBottom: 20,
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
});
