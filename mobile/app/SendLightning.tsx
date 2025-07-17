import BigNumber from 'bignumber.js';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity, View, ScrollView } from 'react-native';
import * as bolt11 from 'bolt11';

import GradientScreen from '@/components/GradientScreen';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import LongPressButton from '@/components/LongPressButton';
import { ThemedText } from '@/components/ThemedText';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { formatBalance } from '@shared/modules/string-utils';
import { NETWORK_BITCOIN, Networks } from '@shared/types/networks';
import { AskMnemonicContext } from '@/src/hooks/AskMnemonicContext';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { WalletFactory } from '@shared/class/wallet-factory';
import { TLightningWallet } from '@shared/types/TWallet';
import { Ionicons } from '@expo/vector-icons';

export type SendLightningProps = {
  network: Networks;
};

const maxFeePercent = 1; // hardcoded at the moment. might give user option to adjust later

const SendLightning: React.FC = () => {
  const params = useLocalSearchParams<SendLightningProps>();
  const network = params.network;
  const { scanQr } = useContext(ScanQrContext);
  const { askMnemonic } = useContext(AskMnemonicContext);
  const navigation = useNavigation();
  const [invoice, setInvoice] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [sendState, setSendState] = useState<'idle' | 'preparing' | 'prepared' | 'sending' | 'success'>('idle');
  const [feeSats, setFeeSats] = useState<number | null>(null);
  const [amountToSend, setAmountToSend] = useState<string>('');
  const { accountNumber } = useContext(AccountNumberContext);
  const walletRef = useRef<TLightningWallet | null>(null);

  const onInvoiceInput = async (scanned: string) => {
    setInvoice(scanned);
    try {
      const decoded = bolt11.decode(scanned.trim());
      setAmountToSend(String(decoded.satoshis));

      if (!decoded.satoshis) {
        throw new Error('Could not determine payment amount from invoice');
      }

      const feeBN = new BigNumber(decoded.satoshis).dividedBy(100).multipliedBy(maxFeePercent).toNumber();
      setFeeSats(Math.max(Math.round(feeBN), 1));
      setError('');
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleQRScan = async () => {
    const scanned = await scanQr();
    if (scanned && scanned.trim()) {
      await onInvoiceInput(scanned.trim());
    }
  };

  // Initialize the wallet
  useEffect(() => {
    const initializeWallet = async () => {
      try {
        walletRef.current = await WalletFactory.getInstance().getLightningWallet(network, accountNumber, BackgroundExecutor);
      } catch (err) {
        console.error('Failed to initialize wallet:', err);
        setError('Failed to initialize wallet. Please try again.');
      }
    };

    initializeWallet();

    return () => {
      walletRef.current = null;
    };
  }, [accountNumber, network]);

  const prepareTransaction = async () => {
    setSendState('preparing');
    setError('');
    try {
      await askMnemonic(); // verify password

      setSendState('prepared');
    } catch (error: any) {
      console.error('Prepare transaction error:', error);
      setError(error.message);
      setSendState('idle');
    }
  };

  const sendPayment = async () => {
    try {
      if (!walletRef.current) {
        throw new Error('Internal error: wallet not initialized');
      }

      setSendState('sending');
      await new Promise((r) => setTimeout(r, 200)); // propagate

      // Send payment
      const paymentResponse = await walletRef.current.payLightningInvoice(invoice);

      if (paymentResponse) {
        setSendState('success');
      } else {
        setSendState('idle');
        setError('Payment failed');
      }
    } catch (error: any) {
      console.error('Send payment error:', error);
      setError(error.message);
      setSendState('idle');
    }
  };

  const handleCancel = () => {
    setSendState('idle');
  };

  if (sendState === 'success') {
    return (
      <GradientScreen variant={network}>
        <ScreenHeader title="Send Lightning" />
        <View style={styles.successContainer}>
          <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
          <ThemedText style={styles.successMessage}>Payment Sent!</ThemedText>
          <ThemedText style={styles.successSubMessage}>{amountToSend ? formatBalance(amountToSend, 8, 8) : ''} sats</ThemedText>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ThemedText style={styles.backButtonText}>Back to Wallet</ThemedText>
          </TouchableOpacity>
        </View>
      </GradientScreen>
    );
  }

  return (
    <GradientScreen variant={network}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Send Lightning" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentContainer}>
          {/* Network Badge */}
          <View style={styles.networkBadge}>
            <Ionicons name="flash" size={16} color="rgba(255, 255, 255, 0.9)" />
            <ThemedText style={styles.networkText}>{network?.toUpperCase()} LIGHTNING</ThemedText>
          </View>

          {/* Error Display */}
          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning" size={20} color="#ff4444" />
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            </View>
          ) : null}

          {/* Invoice Input Section */}
          <View style={styles.inputSection}>
            <ThemedText style={styles.inputLabel}>Lightning Invoice</ThemedText>
            <View style={styles.invoiceContainer}>
              <TextInput
                style={styles.invoiceInput}
                placeholder="Paste Lightning invoice here..."
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                onChangeText={onInvoiceInput}
                value={invoice}
                multiline
                textAlignVertical="top"
              />
              <TouchableOpacity style={styles.scanButton} onPress={handleQRScan}>
                <Ionicons name="qr-code-outline" size={20} color="rgba(255, 255, 255, 0.8)" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Loading Display */}
          {sendState === 'preparing' || sendState === 'sending' ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.8)" />
              <ThemedText style={styles.loadingText}>{sendState === 'preparing' ? 'Preparing payment...' : 'Sending payment...'}</ThemedText>
            </View>
          ) : null}

          {/* Payment Details */}
          {invoice && amountToSend && sendState === 'idle' ? (
            <View style={styles.detailsContainer}>
              <ThemedText style={styles.detailsTitle}>Payment Details</ThemedText>

              <View style={styles.detailRow}>
                <ThemedText style={styles.detailLabel}>Amount:</ThemedText>
                <ThemedText style={styles.detailValue}>
                  {amountToSend ? formatBalance(amountToSend, getDecimalsByNetwork(NETWORK_BITCOIN)) : ''} {getTickerByNetwork(NETWORK_BITCOIN)}
                </ThemedText>
              </View>

              {feeSats !== null && (
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Fee:</ThemedText>
                  <ThemedText style={styles.detailValue}>up to {feeSats} sats</ThemedText>
                </View>
              )}
            </View>
          ) : null}

          {/* Verify Button */}
          {sendState === 'idle' && invoice && amountToSend && (
            <TouchableOpacity style={[styles.verifyButton]} onPress={prepareTransaction}>
              <Ionicons name="flash" size={20} color="rgba(255, 255, 255, 0.8)" />
              <ThemedText style={styles.verifyButtonText}>Send Payment</ThemedText>
            </TouchableOpacity>
          )}

          {/* Confirm Payment */}
          {sendState === 'prepared' && (
            <View style={styles.confirmContainer}>
              <LongPressButton
                style={styles.confirmButton}
                textStyle={styles.confirmButtonText}
                onLongPressComplete={sendPayment}
                title="Hold to send payment"
                progressColor="rgba(255, 255, 255, 0.3)"
                backgroundColor="#000000"
              />

              <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
                <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </GradientScreen>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  contentContainer: {
    flex: 1,
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 149, 0, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.4)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 30,
    gap: 6,
  },
  networkText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  inputSection: {
    marginBottom: 30,
  },
  inputLabel: {
    marginBottom: 12,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  invoiceContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  invoiceInput: {
    flex: 1,
    minHeight: 120,
    maxHeight: 160,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: 'rgba(255, 255, 255, 0.9)',
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
    alignSelf: 'flex-start',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  errorText: {
    color: '#ff4444',
    flex: 1,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    gap: 10,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  detailsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  detailsTitle: {
    marginBottom: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  detailValue: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 'auto',
    marginBottom: 20,
    gap: 8,
  },
  verifyButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  confirmContainer: {
    marginTop: 'auto',
  },
  confirmButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    textDecorationLine: 'underline',
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
  },
  successSubMessage: {
    marginBottom: 40,
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.7)',
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
  },
});

export default SendLightning;
