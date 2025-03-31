import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { Stack, useRouter } from 'expo-router';
import React, { useContext, useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import LongPressButton from '@/components/LongPressButton';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Csprng } from '@/src/class/rng';
import { SecureStorage } from '@/src/class/secure-storage';
import { AskPasswordContext } from '@/src/hooks/AskPasswordContext';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { EvmWallet } from '@shared/class/evm-wallet';
import { DEFAULT_NETWORK } from '@shared/config';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useBalance } from '@shared/hooks/useBalance';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { getDeviceID } from '@shared/modules/device-id';
import { decrypt } from '../src/modules/encryption';
import { formatBalance } from '@shared/modules/string-utils';
import { ENCRYPTED_PREFIX, STORAGE_KEY_MNEMONIC } from '@shared/types/IStorage';
import { NETWORK_BITCOIN } from '@shared/types/networks';
import { StringNumber } from '@shared/types/string-number';
import assert from 'assert';
import BigNumber from 'bignumber.js';
import { TransactionSuccessProps } from './TransactionSuccessEvm';
export default function SendScreen() {
  const [screenState, setScreenState] = useState<'init' | 'preparing' | 'prepared' | 'broadcasting'>('init');
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { scanQr } = useContext(ScanQrContext);
  const [address, setAddress] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [feeMultiplier, setFeeMultiplier] = useState(1);
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();
  const { balance } = useBalance(network ?? DEFAULT_NETWORK, accountNumber, BackgroundExecutor);
  const [bytes, setBytes] = useState('');
  const [fees, setFees] = useState<StringNumber>(); // min fees user will have to pay for the transaction
  const [maxFees, setMaxFees] = useState<StringNumber>(); // max fees user will have to pay for the transaction
  const { askPassword } = useContext(AskPasswordContext);

  // loading OUR address
  useEffect(() => {
    BackgroundExecutor.getAddress(network || DEFAULT_NETWORK, accountNumber)
      .then((addressResponse) => {
        setAddress(addressResponse);
      })
      .catch((error) => {
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
    setRecipientAddress(text);
    setErrorMessage('');
  };

  const handleAmountChange = (text: string) => {
    // Only allow numbers and a single decimal point
    if (text === '' || /^\d*\.?\d*$/.test(text)) {
      setAmount(text);
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
      const txid = await e.broadcastTransaction(network || DEFAULT_NETWORK, bytes);

      // Navigate to TransactionSuccessEvm with all required parameters
      router.replace({
        pathname: '/TransactionSuccessEvm',
        params: {
          amount: new BigNumber(amount).multipliedBy(new BigNumber(10).pow(getDecimalsByNetwork(network))).toString(10),
          recipient: recipientAddress,
          network: network,
          transactionId: txid,
          bytes: bytes,
        } as TransactionSuccessProps,
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

      const encryptedMnemonic = await SecureStorage.getItem(STORAGE_KEY_MNEMONIC);
      let decrypted: string = encryptedMnemonic;
      if (encryptedMnemonic.startsWith(ENCRYPTED_PREFIX)) {
        const password = await askPassword();
        if (!password) {
          setScreenState('init');
          return; // User cancelled the password prompt
        }

        try {
          decrypted = await decrypt(encryptedMnemonic.replace(ENCRYPTED_PREFIX, ''), password, await getDeviceID(SecureStorage, Csprng));
        } catch {
          // only catching and re-throwing to change the error message. probably would be better to
          // make a separate place to interpret errors and display the appropriate ones
          throw new Error('Incorrect password');
        }
      }

      const bytes = await e.signTransaction(prepared, decrypted, accountNumber);
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
        setRecipientAddress(scannedAddress);
        handleAddressChange(scannedAddress);
      }
    } catch (error) {
      console.error('QR scan error:', error);
      setErrorMessage('Failed to scan QR code');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen
        options={{
          title: 'Send',
          headerShown: true,
        }}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ThemedView style={styles.container}>
            <ThemedView style={styles.formContainer}>
              {errorMessage ? <ThemedText style={styles.errorText}>{errorMessage}</ThemedText> : null}

              <ThemedText style={styles.label}>Recipient Address</ThemedText>
              <View style={styles.addressInputContainer}>
                <TextInput style={styles.addressInput} placeholder="Enter recipient address" value={recipientAddress} onChangeText={handleAddressChange} autoCapitalize="none" autoCorrect={false} />
                <TouchableOpacity style={styles.qrButton} onPress={handleScanQr}>
                  <Ionicons name="qr-code-outline" size={24} color="white" />
                </TouchableOpacity>
              </View>

              <ThemedText style={styles.label}>Amount</ThemedText>
              <View style={styles.amountInputContainer}>
                <TextInput style={styles.amountInput} placeholder="0.0" value={amount} onChangeText={handleAmountChange} keyboardType="decimal-pad" />
                <ThemedText style={styles.ticker}>{getTickerByNetwork(network)}</ThemedText>
              </View>
              <ThemedText style={styles.availableBalance}>
                Available balance: {balance ? `${formatBalance(balance, getDecimalsByNetwork(network))} ${getTickerByNetwork(network)}` : 'Loading...'}
              </ThemedText>

              <ThemedText style={styles.label}>Fee Multiplier: {feeMultiplier.toFixed(0)}x</ThemedText>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={5}
                step={1}
                value={feeMultiplier}
                onValueChange={setFeeMultiplier}
                minimumTrackTintColor="#007AFF"
                maximumTrackTintColor="#CCCCCC"
                thumbTintColor="#007AFF"
              />
              <View style={styles.sliderLabels}>
                <ThemedText>Slower</ThemedText>
                <ThemedText>Faster</ThemedText>
              </View>

              {screenState === 'preparing' ? <ThemedText>Preparing...</ThemedText> : null}

              {screenState === 'init' ? (
                <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
                  <ThemedText style={styles.sendButtonText}>Send</ThemedText>
                </TouchableOpacity>
              ) : null}

              {screenState === 'prepared' && fees && maxFees ? (
                <View>
                  <ThemedText style={{ fontSize: 14 }}>
                    Fees between {formatBalance(fees, getDecimalsByNetwork(network))} {getTickerByNetwork(network)} and {formatBalance(maxFees, getDecimalsByNetwork(network))}{' '}
                    {getTickerByNetwork(network)}
                  </ThemedText>

                  <LongPressButton
                    style={styles.sendButton}
                    textStyle={styles.sendButtonText}
                    onLongPressComplete={handleBroadcast}
                    title="Hold to confirm send"
                    progressColor="#FFFFFF"
                    backgroundColor="#007AFF"
                  />
                </View>
              ) : null}
            </ThemedView>
          </ThemedView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  formContainer: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  errorText: {
    color: 'red',
    marginBottom: 16,
    fontSize: 14,
    textAlign: 'center',
  },
  addressInputContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'center',
  },
  addressInput: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  qrButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    width: 48,
    height: 48,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  amountInputContainer: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  amountInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  ticker: {
    paddingRight: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  availableBalance: {
    fontSize: 12,
    color: '#666',
    marginBottom: 24,
    marginLeft: 4,
  },
  slider: {
    height: 40,
    marginBottom: 8,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 16,
  },
  sendButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
