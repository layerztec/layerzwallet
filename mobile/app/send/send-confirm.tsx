import { Ionicons } from '@expo/vector-icons';
import BigNumber from 'bignumber.js';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

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
  const { network, address, amount, bitcoin, reset } = useSendFlow();
  const { exchangeRate } = useCachedExchangeRate(network, 'USD');

  const [error, setError] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const createdTransaction = bitcoin?.createdTransaction;
  const txhex = createdTransaction?.txhex || '';
  const actualFee = createdTransaction?.actualFee || 0;
  const feeInNative = formatBalance(String(actualFee), getDecimalsByNetwork(network), 8);
  const decimals = getDecimalsByNetwork(network);

  // Get network-specific background color
  const networkGradient = getNetworkGradient(network);
  const networkBackgroundColor = networkGradient[0]; // Use the first (darker) color from the gradient

  // USD conversions - amount is already in native units (BTC), fee is in base units (sats)
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

  // Redirect back if no transaction is available
  if (!createdTransaction) {
    router.replace('/send/send-amount');
    return null;
  }

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

  const handleBack = () => {
    reset();
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

  if (isSuccess) {
    return (
      <GradientScreen variant={network} scroll={true}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenSendHeader network={network} title={`Send ${getTickerByNetwork(network)}`} />
        <View style={styles.successContainer}>
          <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
          <ThemedText style={styles.successMessage}>Transaction Sent!</ThemedText>
          <ThemedText style={styles.successSubMessage}>Your {getTickerByNetwork(network)} are on their way</ThemedText>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <ThemedText style={styles.backButtonText}>Back to Wallet</ThemedText>
          </TouchableOpacity>
        </View>
      </GradientScreen>
    );
  }

  return (
    <GradientScreen variant={network} scroll={true}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenSendHeader network={network} title={`Send ${getTickerByNetwork(network)}`} />

      <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <View style={styles.container}>
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
              <View style={styles.totalSection}>
                <View style={styles.sectionHeader}>
                  <ThemedText style={styles.sectionHeaderText}>Total</ThemedText>
                </View>
                <View style={[styles.totalCard, { backgroundColor: networkBackgroundColor }]}>
                  <ThemedText style={styles.totalAmount}>
                    {totalAmount.toString()} {getTickerByNetwork(network)}
                  </ThemedText>
                  {totalUsd && <ThemedText style={styles.totalUsd}>{totalUsd}</ThemedText>}
                </View>
              </View>

              {/* Details Section */}
              <View style={styles.detailsSection}>
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
              </View>

              {/* Send to Section */}
              <View style={styles.sendToSection}>
                <View style={styles.sectionHeader}>
                  <ThemedText style={styles.sectionHeaderText}>Send to</ThemedText>
                </View>
                <View style={[styles.addressCard, { backgroundColor: networkBackgroundColor }]}>{formatAddressWithOpacity(address)}</View>
              </View>

              <TouchableOpacity style={[styles.sendButton, isBroadcasting && styles.disabledButton]} onPress={broadcast} disabled={isBroadcasting}>
                <ThemedText style={styles.sendButtonText}>{isBroadcasting ? 'Sending...' : 'Confirm Send'}</ThemedText>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </GradientScreen>
  );
};

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
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
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 18,
    padding: 2,
    marginBottom: 32,
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
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    marginTop: 'auto',
    height: 56,
  },
  sendButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  successMessage: {
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 24,
    fontWeight: '600',
  },
  successSubMessage: {
    marginBottom: 40,
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
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
