import { PrepareSendRequest, PrepareSendResponse, SendPaymentRequest } from '@breeztech/breez-sdk-liquid';
import BigNumber from 'bignumber.js';
import { Stack } from 'expo-router';
import React, { useContext, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import LongPressButton from '@/components/LongPressButton';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { AskMnemonicContext } from '@/src/hooks/AskMnemonicContext';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BreezWallet, getBreezNetwork } from '@shared/class/wallets/breez-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { formatBalance } from '@shared/modules/string-utils';
import { NETWORK_LIQUID, NETWORK_LIQUIDTESTNET } from '@shared/types/networks';

const SendLightning = () => {
  const { scanQr } = useContext(ScanQrContext);
  const { askMnemonic } = useContext(AskMnemonicContext);
  const navigation = useNavigation();
  const [invoice, setInvoice] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isPreparing, setIsPreparing] = useState<boolean>(false);
  const [isPrepared, setIsPrepared] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [preparedResponse, setPreparedResponse] = useState<PrepareSendResponse | null>(null);
  const [feeSats, setFeeSats] = useState<number | null>(null);
  const [amountToSend, setAmountToSend] = useState<string>('');
  const network = useContext(NetworkContext).network as typeof NETWORK_LIQUID | typeof NETWORK_LIQUIDTESTNET;
  const { accountNumber } = useContext(AccountNumberContext);
  const breezWallet = useRef<BreezWallet | null>(null);

  const handleInvoiceChange = (text: string) => {
    setInvoice(text);
    setError('');
  };

  const prepareTransaction = async () => {
    setIsPreparing(true);
    setError('');
    try {
      // Validate invoice
      if (!invoice || invoice.trim() === '') {
        throw new Error('Please enter a valid Lightning invoice');
      }

      const mnemonic = await BackgroundExecutor.getSubMnemonic(accountNumber);
      const wallet = new BreezWallet(mnemonic, getBreezNetwork(network));
      breezWallet.current = wallet;

      // Prepare the payment
      const prepareSendRequest: PrepareSendRequest = {
        destination: invoice.trim(),
      };
      const prepareResponse = await wallet.prepareSendPayment(prepareSendRequest);
      setPreparedResponse(prepareResponse);

      // Extract fee
      setFeeSats(prepareResponse.feesSat || 0);

      // Extract amount information from the destination
      if (prepareResponse.destination.type === 'bolt11' && prepareResponse.destination.invoice.amountMsat) {
        const msat = new BigNumber(prepareResponse.destination.invoice.amountMsat);
        const satAmount = msat.dividedBy(1000).integerValue(BigNumber.ROUND_FLOOR);
        setAmountToSend(satAmount.toString());
      } else {
        throw new Error('Could not determine payment amount from invoice');
      }

      setIsPrepared(true);
    } catch (error: any) {
      console.error('Prepare transaction error:', error);
      setError(error.message);
    } finally {
      setIsPreparing(false);
    }
  };

  const sendPayment = async () => {
    try {
      if (!breezWallet.current || !preparedResponse) {
        throw new Error('Transaction not properly prepared');
      }

      await askMnemonic(); // verify password
      const sendRequest: SendPaymentRequest = {
        prepareResponse: preparedResponse,
      };

      const paymentResponse = await breezWallet.current.sendPayment(sendRequest);
      console.log('Payment sent:', paymentResponse);
      setIsSuccess(true);
    } catch (error: any) {
      console.error('Send payment error:', error);
      setError(error.message);
    }
  };

  const handleQRScan = async () => {
    const scanned = await scanQr();
    if (scanned) {
      setInvoice(scanned);
    }
  };

  const handleCancel = () => {
    setIsPreparing(false);
    setIsPrepared(false);
    setPreparedResponse(null);
  };

  if (isSuccess) {
    return (
      <SafeAreaView style={styles.container}>
        <ThemedView style={styles.successContainer}>
          <Ionicons name="checkmark-circle" size={48} color="#4CAF50" style={styles.successIcon} />
          <ThemedText style={styles.successTitle}>Payment Sent!</ThemedText>
          <ThemedText style={styles.successAmount}>{amountToSend ? formatBalance(amountToSend, 8, 8) : ''} sats</ThemedText>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ThemedText style={styles.backButtonText}>Back to Wallet</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: `Send Lightning`, headerShown: true }} />
      <ThemedView style={styles.content}>
        <ThemedView style={[styles.networkBar, { backgroundColor: '#FF9500' }]}>
          <ThemedText style={styles.networkText}>{network?.toUpperCase()} LIGHTNING</ThemedText>
        </ThemedView>

        <ThemedView style={styles.inputSection}>
          <ThemedText style={styles.inputLabel}>Lightning Invoice</ThemedText>
          <ThemedView style={styles.invoiceInputContainer}>
            <TextInput style={styles.input} placeholder="Enter the Lightning invoice" placeholderTextColor="#999" onChangeText={handleInvoiceChange} value={invoice} multiline />
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

        {isPreparing && (
          <ThemedView style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#007AFF" />
            <ThemedText style={styles.loadingText}>Preparing transaction...</ThemedText>
          </ThemedView>
        )}

        {isPrepared && (
          <ThemedView style={styles.detailsContainer}>
            <ThemedText style={styles.detailsTitle}>Payment Details</ThemedText>
            <ThemedView style={styles.detailsRow}>
              <ThemedText style={styles.detailsLabel}>Amount:</ThemedText>
              <ThemedText style={styles.detailsValue}>{amountToSend ? formatBalance(amountToSend, 8, 8) : ''} sats</ThemedText>
            </ThemedView>
            {feeSats !== null && (
              <ThemedView style={styles.detailsRow}>
                <ThemedText style={styles.detailsLabel}>Fee:</ThemedText>
                <ThemedText style={styles.detailsValue}>{feeSats} sats</ThemedText>
              </ThemedView>
            )}
          </ThemedView>
        )}

        {!isPreparing && !isPrepared && (
          <TouchableOpacity style={styles.payButton} onPress={prepareTransaction}>
            <Ionicons name="flash" size={20} color="white" style={styles.payIcon} />
            <ThemedText style={styles.payButtonText}>Verify Payment</ThemedText>
          </TouchableOpacity>
        )}

        {isPrepared && (
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
  networkBar: {
    marginBottom: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    alignSelf: 'center',
  },
  networkText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
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
  },
  scanButton: {
    marginLeft: 10,
    width: 50,
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
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
    marginVertical: 16,
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
    marginBottom: 20,
  },
  successTitle: {
    color: '#4CAF50',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  successAmount: {
    fontSize: 18,
    marginBottom: 30,
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
