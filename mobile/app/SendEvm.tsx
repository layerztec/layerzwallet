import { Ionicons } from '@expo/vector-icons';
import Pressable from '../components/Pressable';
import Slider from '@react-native-community/slider';
import assert from 'assert';
import BigNumber from 'bignumber.js';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import React, { useContext, useEffect, useState } from 'react';
import { Keyboard, StyleSheet, TextInput, View, ScrollView } from 'react-native';

import GradientScreen from '@/components/GradientScreen';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import LongPressButton from '@/components/LongPressButton';
import { ThemedText } from '@/components/ThemedText';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { EvmWallet } from '@shared/class/evm-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useBalance } from '@shared/hooks/useBalance';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { formatBalance } from '@shared/modules/string-utils';
import { NETWORK_BITCOIN } from '@shared/types/networks';
import { StringNumber } from '@shared/types/string-number';
import { TransactionSuccessProps } from './TransactionSuccessEvm';
import { handleError } from '@/src/modules/error-handler';

export type SendEvmParams = {
  toAddress?: string;
  amount?: string;
};

export default function SendScreen() {
  const params = useLocalSearchParams<SendEvmParams>();
  const router = useRouter();
  const [screenState, setScreenState] = useState<'init' | 'preparing' | 'prepared' | 'broadcasting'>('init');
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { scanQr } = useContext(ScanQrContext);
  const [address, setAddress] = useState<string>('');
  const recipientAddress = params.toAddress ?? '';
  const amount = params.amount ?? '';
  const [feeMultiplier, setFeeMultiplier] = useState(1);
  const [errorMessage, setErrorMessage] = useState('');
  const { balance } = useBalance(network, accountNumber, BackgroundExecutor);
  const [bytes, setBytes] = useState('');
  const [fees, setFees] = useState<StringNumber>(); // min fees user will have to pay for the transaction
  const [maxFees, setMaxFees] = useState<StringNumber>(); // max fees user will have to pay for the transaction

  // loading OUR address
  useEffect(() => {
    BackgroundExecutor.getAddress(network, accountNumber)
      .then((addressResponse) => {
        setAddress(addressResponse);
      })
      .catch((error) => {
        handleError(error, 'SendEvm');
        setErrorMessage('Error fetching address: ' + error.message);
      });
  }, [accountNumber, network]);

  const validateAddress = (address: string) => {
    if (!address.trim()) {
      return false;
    }

    // Use the appropriate validation method based on network
    if (network === NETWORK_BITCOIN) {
      // TODO: For Bitcoin, we would need a specific validation
      // This is a placeholder - you would need to implement proper Bitcoin address validation
      return address.trim().length > 26;
    } else {
      // For EVM-compatible networks
      return EvmWallet.isAddressValid(address);
    }
  };

  const handleAddressChange = (text: string) => {
    router.setParams({ toAddress: text });
    setErrorMessage('');
  };

  const handleAmountChange = (text: string) => {
    const normalizedText = text.replace(',', '.');
    if (normalizedText === '' || /^\d*\.?\d*$/.test(normalizedText)) {
      router.setParams({ amount: normalizedText });
      setErrorMessage('');
    }
  };

  const validateForm = () => {
    // Validate recipient address
    if (!recipientAddress.trim()) {
      setErrorMessage('Recipient address is required');
      return false;
    }

    if (!validateAddress(recipientAddress)) {
      setErrorMessage('Invalid recipient address');
      return false;
    }

    // Validate amount
    if (!amount || parseFloat(amount) <= 0) {
      setErrorMessage('Please enter a valid amount');
      return false;
    }

    // Check if amount is greater than balance
    const decimals = getDecimalsByNetwork(network);
    const amountValue = parseFloat(amount);
    const balanceValue = balance ? parseFloat(formatBalance(balance, decimals)) : 0;

    if (amountValue > balanceValue) {
      setErrorMessage('Insufficient balance');
      return false;
    }

    return true;
  };

  const handleSend = async () => {
    Keyboard.dismiss();
    setErrorMessage('');
    setScreenState('preparing');
    if (!validateForm()) {
      setScreenState('init');
      return;
    }

    await prepareTransaction();
  };

  const handleBroadcast = async () => {
    Keyboard.dismiss();
    setErrorMessage('');
    setScreenState('broadcasting');
    const e = new EvmWallet();
    try {
      const txid = await e.broadcastTransaction(network, bytes);

      const params: TransactionSuccessProps = {
        amount: new BigNumber(amount).multipliedBy(new BigNumber(10).pow(getDecimalsByNetwork(network))).toString(10),
        recipient: recipientAddress,
        network: network,
        transactionId: txid,
        bytes: bytes,
      };

      // Navigate to TransactionSuccessEvm with all required parameters
      router.replace({
        pathname: '/TransactionSuccessEvm',
        params,
      });
    } catch (error: any) {
      setScreenState('init');
      setErrorMessage(`Transaction failed: ${error.message}`);
    }
  };

  const prepareTransaction = async () => {
    setErrorMessage('');
    setBytes('');
    try {
      assert(address, 'internal error: address not loaded');
      assert(balance, 'internal error: balance not loaded');
      assert(recipientAddress, 'recipient address empty');
      assert(EvmWallet.isAddressValid(recipientAddress), 'recipient address is not valid');
      const amt = parseFloat(amount);
      assert(!isNaN(amt), 'Invalid amount');
      assert(amt > 0, 'Amount should be > 0');

      const satValueBN = new BigNumber(amt);
      const satValue = satValueBN.multipliedBy(new BigNumber(10).pow(getDecimalsByNetwork(network))).toString(10);
      assert(new BigNumber(balance).gte(satValue), 'Not enough balance');

      const e = new EvmWallet();
      const paymentTransaction = await e.createPaymentTransaction(address, recipientAddress, satValue);
      const feeData = await e.getFeeData(network);
      let baseFee;
      try {
        baseFee = await e.getBaseFeePerGas(network);
      } catch {
        baseFee = 0n;
      }
      const prepared = await e.prepareTransaction(paymentTransaction, network, feeData, BigInt(Math.round(feeMultiplier)));

      // calculating fees
      console.log('feeData=', feeData);

      console.log('lastBaseFeePerGas=', baseFee.toString());
      console.log('feeData.maxFeePerGas=', feeData.maxFeePerGas?.toString());
      console.log('feeData.maxPriorityFeePerGas=', feeData.maxPriorityFeePerGas?.toString());
      console.log('feeData.gasPrice=', feeData.gasPrice?.toString());
      console.log('prepared.gasLimit=', prepared.gasLimit?.toString());

      const calculatedMinFee = e.calculateMinFee(baseFee, prepared);
      const calculatedMaxFee = e.calculateMaxFee(prepared);

      setFees(calculatedMinFee);
      setMaxFees(calculatedMaxFee);

      console.log('calculatedFee=', calculatedMinFee);
      console.log('calculatedMaxFee=', calculatedMaxFee);

      const mnemonic = await BackgroundExecutor.getMasterSeed();
      const bytes = await e.signTransaction(prepared, mnemonic, accountNumber);
      setBytes(bytes);
      setScreenState('prepared');
      console.log('bytes=', bytes);
    } catch (error: any) {
      setErrorMessage(error.message);
      setScreenState('init');
    }
  };

  const handleScanQr = async () => {
    try {
      const scannedAddress = await scanQr();
      if (scannedAddress) {
        router.setParams({ toAddress: scannedAddress });
      }
    } catch (error) {
      console.error('QR scan error:', error);
      setErrorMessage('Failed to scan QR code');
    }
  };

  if (screenState === 'broadcasting') {
    return (
      <GradientScreen variant={network}>
        <ScreenHeader title={`Send ${getTickerByNetwork(network)}`} />
        <View style={styles.broadcastingContainer}>
          <ThemedText style={styles.broadcastingText}>Broadcasting transaction...</ThemedText>
        </View>
      </GradientScreen>
    );
  }

  return (
    <GradientScreen variant={network}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title={`Send ${getTickerByNetwork(network)}`} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentContainer}>
          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning" size={20} color="#ff4444" />
              <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
            </View>
          ) : null}

          <View style={styles.inputSection}>
            <ThemedText style={styles.inputLabel}>Recipient Address</ThemedText>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter recipient address"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                value={recipientAddress}
                onChangeText={handleAddressChange}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable style={styles.qrButton} onPress={handleScanQr}>
                <Ionicons name="scan-outline" size={20} color="rgba(255, 255, 255, 0.8)" />
              </Pressable>
            </View>
          </View>

          <View style={styles.inputSection}>
            <ThemedText style={styles.inputLabel}>Amount</ThemedText>
            <View style={styles.amountContainer}>
              <TextInput style={styles.amountInput} placeholder="0.00" placeholderTextColor="rgba(255, 255, 255, 0.6)" value={amount} onChangeText={handleAmountChange} keyboardType="decimal-pad" />
              <ThemedText style={styles.ticker}>{getTickerByNetwork(network)}</ThemedText>
            </View>
            <ThemedText style={styles.balanceText}>
              Available balance: {balance ? formatBalance(balance, getDecimalsByNetwork(network)) : 'Loading...'} {getTickerByNetwork(network)}
            </ThemedText>
          </View>

          <View style={styles.feeSection}>
            <ThemedText style={styles.inputLabel}>Fee Speed: {feeMultiplier.toFixed(0)}x</ThemedText>
            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={5}
                step={1}
                value={feeMultiplier}
                onValueChange={setFeeMultiplier}
                minimumTrackTintColor="rgba(255, 255, 255, 0.8)"
                maximumTrackTintColor="rgba(255, 255, 255, 0.3)"
                thumbTintColor="rgba(255, 255, 255, 0.9)"
              />
              <View style={styles.sliderLabels}>
                <ThemedText style={styles.sliderLabel}>Slower</ThemedText>
                <ThemedText style={styles.sliderLabel}>Faster</ThemedText>
              </View>
            </View>
          </View>

          {screenState === 'preparing' ? (
            <View style={styles.loadingContainer}>
              <ThemedText style={styles.loadingText}>Preparing transaction...</ThemedText>
            </View>
          ) : null}

          {screenState === 'init' ? (
            <Pressable style={[styles.sendButton, (!recipientAddress || !amount) && styles.disabledButton]} onPress={handleSend} disabled={!recipientAddress || !amount}>
              <Ionicons name="send" size={20} color="rgba(255, 255, 255, 0.8)" />
              <ThemedText style={styles.sendButtonText}>Send</ThemedText>
            </Pressable>
          ) : null}

          {screenState === 'prepared' && fees && maxFees ? (
            <View style={styles.preparedContainer}>
              <ThemedText style={styles.preparedTitle}>Ready to Send</ThemedText>

              <View style={styles.detailsContainer}>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>To:</ThemedText>
                  <ThemedText style={styles.detailValue} numberOfLines={1} ellipsizeMode="middle">
                    {recipientAddress}
                  </ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Amount:</ThemedText>
                  <ThemedText style={styles.detailValue}>
                    {amount} {getTickerByNetwork(network)}
                  </ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Fee Range:</ThemedText>
                  <ThemedText style={styles.detailValue}>
                    {formatBalance(fees, getDecimalsByNetwork(network))} - {formatBalance(maxFees, getDecimalsByNetwork(network))} {getTickerByNetwork(network)}
                  </ThemedText>
                </View>
              </View>

              <LongPressButton
                style={styles.confirmButton}
                textStyle={styles.confirmButtonText}
                onLongPressComplete={handleBroadcast}
                title="Hold to confirm send"
                progressColor="rgba(255, 255, 255, 0.3)"
                backgroundColor="#000000"
              />
            </View>
          ) : null}
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
  },
  inputSection: {
    marginBottom: 30,
  },
  inputLabel: {
    marginBottom: 12,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  input: {
    flex: 1,
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    paddingHorizontal: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  qrButton: {
    width: 50,
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    paddingRight: 16,
  },
  amountInput: {
    flex: 1,
    height: 50,
    paddingHorizontal: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  ticker: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  balanceText: {
    marginTop: 8,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  feeSection: {
    marginBottom: 30,
  },
  sliderContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 16,
  },
  slider: {
    height: 40,
    marginBottom: 8,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
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
    alignItems: 'center',
    marginVertical: 20,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  sendButton: {
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
  sendButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  disabledButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  preparedContainer: {
    marginTop: 20,
  },
  preparedTitle: {
    marginBottom: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  detailsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
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
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  confirmButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  confirmButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  broadcastingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  broadcastingText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
});
