import React, { useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import * as bolt11 from 'bolt11';
import BigNumber from 'bignumber.js';

import LongPressButton from '@/components/LongPressButton';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { capitalizeFirstLetter, formatBalance } from '@shared/modules/string-utils';
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
      <SafeAreaView style={styles.container}>
        <ThemedView style={styles.successContainer}>
          <ThemedText style={styles.successIcon}>✓</ThemedText>
          <ThemedText style={styles.successTitle}>Sent!</ThemedText>
          <ThemedText style={styles.successAmount}>{amountToSend ? formatBalance(amountToSend, 8, 8) : ''} sats have been sent</ThemedText>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ThemedText style={styles.backButtonText}>Back to Wallet</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: `Send Lightning on ${capitalizeFirstLetter(network)}`, headerShown: true }} />
      <ThemedView style={styles.content}>
        <ThemedView style={styles.inputSection}>
          <ThemedText style={styles.inputLabel}>Lightning Invoice</ThemedText>
          <ThemedView style={styles.invoiceInputContainer}>
            <TextInput style={styles.input} placeholder="Enter the Lightning invoice" placeholderTextColor="#999" onChangeText={onInvoiceInput} value={invoice} multiline />
            <TouchableOpacity style={styles.scanButton} onPress={handleQRScan}>
              <Ionicons name="scan-outline" size={24} color="#007AFF" />
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>

        {error && (
          <ThemedView style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </ThemedView>
        )}

        {sendState === 'preparing' || sendState === 'sending' ? (
          <ThemedView style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#007AFF" />
            <ThemedText style={styles.loadingText}>loading...</ThemedText>
          </ThemedView>
        ) : null}

        {invoice && amountToSend && (
          <ThemedView style={styles.detailsContainer}>
            <ThemedText style={styles.detailsTitle}>Payment Details</ThemedText>
            <ThemedView style={styles.detailsRow}>
              <ThemedText style={styles.detailsLabel}>Amount:</ThemedText>
              <ThemedText style={styles.detailsValue}>
                {amountToSend ? formatBalance(amountToSend, getDecimalsByNetwork(NETWORK_BITCOIN)) : ''} {getTickerByNetwork(NETWORK_BITCOIN)}
              </ThemedText>
            </ThemedView>
            {feeSats !== null && (
              <ThemedView style={styles.detailsRow}>
                <ThemedText style={styles.detailsLabel}>Fee:</ThemedText>
                <ThemedText style={styles.detailsValue}>up to {feeSats} sats</ThemedText>
              </ThemedView>
            )}
          </ThemedView>
        )}

        {sendState === 'idle' && (
          <TouchableOpacity style={styles.payButton} onPress={prepareTransaction}>
            <ThemedText style={styles.payIcon}>⚡</ThemedText>
            <ThemedText style={styles.payButtonText}>Send</ThemedText>
          </TouchableOpacity>
        )}

        {sendState === 'prepared' && (
          <ThemedView style={styles.confirmContainer}>
            <LongPressButton
              style={styles.payButton}
              textStyle={styles.payButtonText}
              onLongPressComplete={sendPayment}
              title="Hold to send payment"
              progressColor="#FFFFFF"
              backgroundColor="#FF9500"
            />

            <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
              <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        )}
      </ThemedView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  headline: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontWeight: 'bold',
    marginBottom: 10,
  },
  invoiceInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  input: {
    flex: 1,
    minHeight: 100,
    maxHeight: 150,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    textAlignVertical: 'top',
    marginRight: 10,
  },
  scanButton: {
    width: 50,
    height: 40,
    borderWidth: 1,
    borderColor: '#282c34',
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  scanIcon: {
    fontSize: 20,
  },
  errorContainer: {
    marginBottom: 15,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 16,
  },
  detailsContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailsLabel: {
    fontSize: 16,
    color: '#666',
  },
  detailsValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  payButton: {
    backgroundColor: '#FF9500',
    borderRadius: 8,
    height: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  payIcon: {
    marginRight: 10,
    fontSize: 20,
  },
  payButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  confirmContainer: {
    marginTop: 20,
  },
  cancelButton: {
    marginTop: 15,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'gray',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  successIcon: {
    color: '#4CAF50',
    fontSize: 48,
    marginBottom: 20,
  },
  successTitle: {
    color: '#4CAF50',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  successAmount: {
    color: '#666',
    fontSize: 18,
    marginBottom: 30,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    height: 50,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SendLightning;
