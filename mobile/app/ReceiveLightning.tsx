import { PrepareReceiveRequest, ReceivePaymentRequest } from '@breeztech/breez-sdk-liquid';
import { Ionicons } from '@expo/vector-icons';
import BigNumber from 'bignumber.js';
import * as Clipboard from 'expo-clipboard';
import { Stack, useRouter } from 'expo-router';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import GradientScreen from '@/components/GradientScreen';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import { ThemedText } from '@/components/ThemedText';
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
      <GradientScreen>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Receive Lightning" />
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.contentContainer}>
            <View style={styles.successContainer}>
              <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
              <ThemedText style={styles.successMessage}>
                Received: +{isNewBalanceGT() ? formatBalance(String(isNewBalanceGT()), getDecimalsByNetwork(network), 8) : ''} {getTickerByNetwork(network)}
              </ThemedText>
              <TouchableOpacity style={styles.shareButton} onPress={() => router.back()}>
                <ThemedText style={styles.shareButtonText}>Back to Wallet</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </GradientScreen>
    );
  }

  return (
    <GradientScreen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Receive Lightning" />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.contentContainer}>
          <View style={styles.qrSection}>
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
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                  value={amount}
                  onChangeText={handleAmountChange}
                  keyboardType="numeric"
                  testID="ReceiveLightningAmountInput"
                />

                {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : <ThemedText style={styles.hintText}>Enter the amount you want to receive</ThemedText>}

                <TouchableOpacity
                  style={[styles.generateButton, (isGenerating || !isWalletInitialized) && styles.disabledButton]}
                  onPress={generateInvoice}
                  disabled={isGenerating || !isWalletInitialized}
                  testID="GenerateButton"
                >
                  <ThemedText style={styles.generateButtonText}>{isGenerating ? 'Generating...' : !isWalletInitialized ? 'Initializing...' : 'Generate Invoice'}</ThemedText>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <ThemedText style={styles.subtitle}>Scan the QR code or copy the invoice</ThemedText>

                <View style={styles.qrContainer} testID="LNQrContainer">
                  <QRCode testID="InvoiceQrCode" value={invoice} size={280} backgroundColor="white" color="black" />
                </View>

                <View style={styles.invoiceInfoContainer}>
                  <ThemedText style={styles.amountDisplay}>Amount: {amount} sats</ThemedText>
                  {feesSat !== null && <ThemedText style={styles.feeDisplay}>Network Fee: {feesSat} sats</ThemedText>}
                </View>

                <View style={styles.addressContainer}>
                  <TouchableOpacity testID="CopyInvoiceButton" onPress={handleCopyInvoice} style={styles.addressTextContainer}>
                    <ThemedText testID="InvoiceText" style={styles.addressText} numberOfLines={2} ellipsizeMode="middle">
                      {invoice}
                    </ThemedText>
                    <Ionicons testID="CopyIcon" name="copy-outline" size={20} color="rgba(255, 255, 255, 0.8)" style={styles.copyIcon} />
                  </TouchableOpacity>
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.shareButton} onPress={handleShare} testID="LNShareButton">
                    <Ionicons name="share-outline" size={28} color="rgba(255, 255, 255, 0.8)" />
                    <ThemedText style={styles.shareButtonText}>Share invoice</ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.copyButton} onPress={handleNewInvoice} testID="NewInvoiceButton">
                    <Ionicons name="refresh" size={22} color="rgba(255, 255, 255, 0.8)" />
                    <ThemedText style={styles.copyButtonText}>New invoice</ThemedText>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
  },
  qrSection: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 30,
    width: '100%',
  },
  subtitle: {
    marginBottom: 20,
    textAlign: 'center',
  },
  limitsText: {
    marginBottom: 20,
    textAlign: 'center',
  },
  amountInput: {
    width: '80%',
    height: 50,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 15,
    textAlign: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: 'white',
  },
  errorText: {
    color: '#FF6B6B',
    marginBottom: 15,
    textAlign: 'center',
  },
  hintText: {
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 15,
    textAlign: 'center',
  },
  generateButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    width: '80%',
  },
  generateButtonText: {},
  disabledButton: {
    opacity: 0.5,
  },
  qrContainer: {
    marginBottom: 30,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invoiceInfoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  amountDisplay: {
    marginBottom: 5,
  },
  feeDisplay: {},
  addressContainer: {
    width: '100%',
    marginBottom: 30,
  },
  addressTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
  },
  addressText: {
    flex: 1,
  },
  copyIcon: {
    marginLeft: 8,
  },
  actionButtons: {
    width: '100%',
    gap: 8,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 12,
  },
  shareButtonText: {},
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 12,
  },
  copyButtonText: {},
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  successMessage: {
    marginTop: 20,
    marginBottom: 40,
    textAlign: 'center',
  },
});
