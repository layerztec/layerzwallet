import { Ionicons } from '@expo/vector-icons';
import BigNumber from 'bignumber.js';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

import GradientScreen from '@/components/GradientScreen';
import ScreenSendHeader from '@/components/navigation/ScreenSendHeader';
import { ThemedText } from '@/components/ThemedText';
import * as BlueElectrum from '@shared/blue_modules/BlueElectrum';
import { useCachedExchangeRate } from '@shared/hooks/useCachedExchangeRate';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { formatBalance, formatFiatBalance } from '@shared/modules/string-utils';
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
  const usdValue = exchangeRate ? formatFiatBalance(amount || '0', 0, Number(exchangeRate)) + ' USD' : '';
  const usdFee = exchangeRate
    ? formatFiatBalance(
        BigNumber(actualFee)
          .dividedBy(new BigNumber(10).pow(getDecimalsByNetwork(network)))
          .toString() || '0',
        0,
        Number(exchangeRate)
      ) + ' USD'
    : '';

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
    const groups = addr.match(/.{1,4}/g) || [];

    return (
      <>
        {groups.map((group, index) => {
          const isFirstOrLast = index === 0 || index === groups.length - 1;
          const opacity = isFirstOrLast ? 1 : 0.6;

          return (
            <ThemedText key={index} style={[styles.addressDisplay, { opacity }]}>
              {group}
              {index < groups.length - 1 && ' '}
            </ThemedText>
          );
        })}
      </>
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
              <View style={styles.transactionDetails}>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Amount</ThemedText>
                  <View style={styles.amountContainer}>
                    <ThemedText style={styles.detailValue}>
                      {amount} {getTickerByNetwork(network)}
                    </ThemedText>
                    {usdValue && <ThemedText style={styles.usdValue}>{usdValue}</ThemedText>}
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Network Fee</ThemedText>
                  <View style={styles.amountContainer}>
                    <ThemedText style={styles.detailValue}>
                      {formatBalance(String(actualFee), getDecimalsByNetwork(network), 8)} {getTickerByNetwork(network)}
                    </ThemedText>
                    {usdFee && <ThemedText style={styles.usdValue}>{usdFee}</ThemedText>}
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>To</ThemedText>
                  <View style={styles.addressTextContainer}>{formatAddressWithOpacity(address)}</View>
                </View>
              </View>

              <TouchableOpacity style={[styles.sendButton, isBroadcasting && styles.disabledButton]} onPress={broadcast} disabled={isBroadcasting}>
                <ThemedText style={styles.sendButtonText}>{isBroadcasting ? 'Sending...' : 'Send'}</ThemedText>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    gap: 12,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
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
  transactionDetails: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 20,
    paddingVertical: 24,
    marginBottom: 30,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  detailLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: '400',
  },
  detailValue: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  usdValue: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 16,
    marginTop: 4,
  },
  addressValue: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 16,
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
  addressDisplay: {
    textAlign: 'center',
    lineHeight: 24,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 16,
  },
  addressTextContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    flex: 1,
    marginLeft: 12,
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
