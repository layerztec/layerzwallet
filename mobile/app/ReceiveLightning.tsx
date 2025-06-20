import { PrepareReceiveRequest, ReceivePaymentRequest } from '@breeztech/breez-sdk-liquid';
import { Ionicons } from '@expo/vector-icons';
import BigNumber from 'bignumber.js';
import * as Clipboard from 'expo-clipboard';
import { Stack, useRouter } from 'expo-router';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { BreezWallet, getBreezNetwork } from '@shared/class/wallets/breez-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { formatBalance } from '@shared/modules/string-utils';
import { NETWORK_LIGHTNING, NETWORK_LIGHTNINGTESTNET } from '@shared/types/networks';
import { StringNumber } from '@shared/types/string-number';

export default function ReceiveLightningScreen() {
  const router = useRouter();
  const network = useContext(NetworkContext).network as typeof NETWORK_LIGHTNING | typeof NETWORK_LIGHTNINGTESTNET;
  const { accountNumber } = useContext(AccountNumberContext);
  const [amount, setAmount] = useState<string>('');
  const [invoice, setInvoice] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [limits, setLimits] = useState<{ min: number; max: number } | null>(null);
  const [isWalletInitialized, setIsWalletInitialized] = useState<boolean>(false);
  const [feesSat, setFeesSat] = useState<number | null>(null);
  const [oldBalance, setOldBalance] = useState<StringNumber>('');
  const [balance, setBalance] = useState<StringNumber>('');
  const breezWalletRef = useRef<BreezWallet | null>(null);

  // Initialize the BreezWallet
  useEffect(() => {
    (async () => {
      try {
        const breezMnemonic = await BackgroundExecutor.getSubMnemonic(accountNumber);
        const breezNetwork = getBreezNetwork(network);
        breezWalletRef.current = new BreezWallet(breezMnemonic, breezNetwork);
        setIsWalletInitialized(true);
        const wallet = breezWalletRef.current;
        const limitsResponse = await wallet.fetchLightningLimits();
        setLimits({
          min: limitsResponse.receive.minSat,
          max: limitsResponse.receive.maxSat,
        });

        // Get initial balance
        const currentBalance = await breezWalletRef.current.getBalance();
        const balanceStr = currentBalance.toString(10);
        setBalance(balanceStr);
        setOldBalance(balanceStr);
      } catch (err) {
        console.error('Failed to initialize Breez wallet:', err);
        setError('Failed to initialize wallet. Please try again.');
      }
    })();

    return () => {
      breezWalletRef.current = null;
      setIsWalletInitialized(false);
    };
  }, [network, accountNumber]);

  // Setup balance polling
  useEffect(() => {
    if (!breezWalletRef.current || !isWalletInitialized) return;

    const pollBalance = async () => {
      try {
        const currentBalance = await breezWalletRef.current!.getBalance();
        const balanceStr = currentBalance.toString(10);
        setBalance(balanceStr);
      } catch (error) {
        console.error('Error polling balance:', error);
      }
    };

    // Poll balance initially and then every 10 seconds
    pollBalance();
    const intervalId = setInterval(pollBalance, 10000);

    return () => clearInterval(intervalId);
  }, [isWalletInitialized]);

  const isNewBalanceGT = (): false | StringNumber => {
    if (Boolean(balance && oldBalance && new BigNumber(balance).gt(oldBalance))) {
      return new BigNumber(balance ?? '0').minus(oldBalance).toString(10);
    }
    return false;
  };

  const handleAmountChange = (text: string) => {
    // Only allow digits (no decimals)
    if (text === '' || /^\d+$/.test(text)) {
      setAmount(text);
      setError('');
    }
  };

  const handleNewInvoice = () => {
    setInvoice('');
    setFeesSat(null);
  };

  const generateInvoice = async () => {
    // Validate amount
    if (!amount || amount === '') {
      setError('Please enter an amount');
      return;
    }

    // Check if amount is valid integer
    if (!/^\d+$/.test(amount)) {
      setError('Amount must be a whole number (integer)');
      return;
    }

    const amountSats = parseInt(amount, 10);

    // Check if amount is positive
    if (amountSats <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    if (!breezWalletRef.current || !isWalletInitialized) {
      setError('Wallet is not initialized yet. Please try again.');
      return;
    }

    setIsGenerating(true);
    setError('');
    setFeesSat(null);

    try {
      // Validate against limits
      if (limits) {
        if (amountSats < limits.min) {
          setError(`Amount must be at least ${limits.min} sats`);
          setIsGenerating(false);
          return;
        }
        if (amountSats > limits.max) {
          setError(`Amount must be less than ${limits.max} sats`);
          setIsGenerating(false);
          return;
        }
      }

      // Step 1: Prepare receive payment to get fee information
      const prepareRequest: PrepareReceiveRequest = {
        paymentMethod: 'lightning',
        amount: { type: 'bitcoin', payerAmountSat: amountSats },
      };

      const wallet = breezWalletRef.current;
      const prepareResponse = await wallet.prepareReceivePayment(prepareRequest);
      setFeesSat(prepareResponse.feesSat);

      // Step 2: Generate the actual lightning invoice
      const receiveRequest: ReceivePaymentRequest = {
        prepareResponse: prepareResponse,
        description: `Payment to ${getTickerByNetwork(network)} wallet`,
      };

      const receiveResponse = await wallet.receivePayment(receiveRequest);
      setInvoice(receiveResponse.destination);
    } catch (err) {
      console.error('Failed to generate invoice:', err);
      setError('Failed to generate invoice. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyInvoice = async () => {
    if (!invoice) {
      return;
    }
    await Clipboard.setStringAsync(invoice);
    Alert.alert('Success', 'Invoice copied to clipboard');
  };

  const handleShare = async () => {
    if (!invoice) {
      return;
    }
    try {
      await Share.share({
        message: `Lightning invoice for ${getTickerByNetwork(network)}: ${invoice}`,
      });
    } catch {
      Alert.alert('Error', 'Failed to share invoice');
    }
  };

  // Handle payment received
  if (isNewBalanceGT()) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ title: 'Receive Lightning', headerShown: true }} />
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <ThemedView style={styles.contentContainer}>
            <ThemedView style={[styles.networkBar, { backgroundColor: '#FF9500' }]}>
              <ThemedText style={styles.networkText}>{network?.toUpperCase()} LIGHTNING</ThemedText>
            </ThemedView>

            <ThemedView style={styles.successContainer}>
              <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
              <ThemedText style={styles.successText}>
                Received: +{isNewBalanceGT() ? formatBalance(String(isNewBalanceGT()), getDecimalsByNetwork(network), 8) : ''} {getTickerByNetwork(network)}
              </ThemedText>
              <TouchableOpacity style={styles.button} onPress={() => router.back()}>
                <ThemedText style={styles.buttonText}>Back to Wallet</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'Receive Lightning', headerShown: true }} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.contentContainer}>
          <ThemedView testID="ReceiveLightningHeader" style={[styles.networkBar, { backgroundColor: '#FF9500' }]}>
            <ThemedText style={styles.networkText}>{network?.toUpperCase()} LIGHTNING</ThemedText>
          </ThemedView>

          {!invoice ? (
            <>
              <ThemedText style={styles.subtitle}>Enter amount to receive in sats</ThemedText>

              {limits && (
                <ThemedText style={styles.limitsText}>
                  Min: {limits.min} sats | Max: {limits.max} sats
                </ThemedText>
              )}

              <TextInput
                style={styles.amountInput}
                placeholder="Amount (sats)"
                placeholderTextColor="#888"
                value={amount}
                onChangeText={handleAmountChange}
                keyboardType="numeric"
                testID="ReceiveLightningAmountInput"
              />

              {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : <ThemedText style={styles.hintText}>Enter the amount you want to receive</ThemedText>}

              <TouchableOpacity
                style={[styles.button, (isGenerating || !isWalletInitialized) && styles.disabledButton]}
                onPress={generateInvoice}
                disabled={isGenerating || !isWalletInitialized}
                testID="GenerateButton"
              >
                <ThemedText style={styles.buttonText}>{isGenerating ? 'Generating...' : !isWalletInitialized ? 'Initializing...' : 'Generate Invoice'}</ThemedText>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <ThemedText style={styles.subtitle}>Scan the QR code or copy the invoice</ThemedText>

              <ThemedView style={styles.qrContainer} testID="LNQrContainer">
                <QRCode testID="InvoiceQrCode" value={invoice} size={200} backgroundColor="white" color="black" />
              </ThemedView>

              <ThemedView style={styles.invoiceInfoContainer}>
                <ThemedText style={styles.amountText}>Amount: {amount} sats</ThemedText>

                {feesSat !== null && <ThemedText style={styles.feeText}>Network Fee: {feesSat} sats</ThemedText>}
              </ThemedView>

              <ThemedView style={styles.addressContainer}>
                <ThemedText testID="InvoiceLabel" style={styles.addressLabel}>
                  Invoice:
                </ThemedText>
                <TouchableOpacity testID="CopyInvoiceButton" onPress={handleCopyInvoice} style={styles.addressTextContainer}>
                  <ThemedText testID="InvoiceText" style={styles.addressText} numberOfLines={2} ellipsizeMode="middle">
                    {invoice}
                  </ThemedText>
                  <Ionicons testID="CopyIcon" name="copy-outline" size={20} color="#007AFF" style={styles.copyIcon} />
                </TouchableOpacity>
              </ThemedView>

              <ThemedView style={styles.buttonContainer}>
                <TouchableOpacity style={styles.button} onPress={handleNewInvoice} testID="NewInvoiceButton">
                  <ThemedText style={styles.buttonText}>Generate New Invoice</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity testID="LNShareButton" onPress={handleShare} style={styles.shareButton}>
                  <Ionicons name="share-outline" size={24} color="#007AFF" />
                </TouchableOpacity>
              </ThemedView>
            </>
          )}
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  contentContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  networkBar: {
    marginBottom: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  networkText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 10,
    textAlign: 'center',
  },
  limitsText: {
    fontSize: 14,
    color: 'gray',
    marginBottom: 20,
  },
  amountInput: {
    width: '80%',
    height: 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 18,
    marginBottom: 15,
    textAlign: 'center',
  },
  errorText: {
    color: 'red',
    marginBottom: 15,
    textAlign: 'center',
  },
  hintText: {
    color: 'gray',
    marginBottom: 15,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    width: '80%',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  qrContainer: {
    marginVertical: 20,
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  invoiceInfoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  amountText: {
    fontSize: 16,
    marginBottom: 5,
  },
  feeText: {
    fontSize: 14,
    color: 'gray',
  },
  addressContainer: {
    width: '100%',
    marginTop: 10,
  },
  addressLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  addressTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 12,
  },
  addressText: {
    fontSize: 12,
    flex: 1,
  },
  copyIcon: {
    marginLeft: 8,
  },
  buttonContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    marginTop: 20,
  },
  shareButton: {
    marginTop: 15,
    padding: 10,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 20,
    marginBottom: 40,
    textAlign: 'center',
  },
});
