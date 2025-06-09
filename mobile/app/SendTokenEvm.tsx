import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View, TextInput, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import LongPressButton from '@/components/LongPressButton';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import Slider from '@react-native-community/slider';

import { AskMnemonicContext } from '@/src/hooks/AskMnemonicContext';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { EvmWallet } from '@shared/class/evm-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useTokenBalance } from '@shared/hooks/useTokenBalance';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { getTokenList } from '@shared/models/token-list';
import { formatBalance } from '@shared/modules/string-utils';
import { Networks } from '@shared/types/networks';
import { StringNumber } from '@shared/types/string-number';
import assert from 'assert';
import BigNumber from 'bignumber.js';

export type SendTokenEvmProps = {
  contractAddress: string;
};

const SendTokenEvm: React.FC = () => {
  const params = useLocalSearchParams<SendTokenEvmProps>();
  const { contractAddress } = params;

  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { scanQr } = useContext(ScanQrContext);

  const list = getTokenList(network);
  const token = list.find((token) => token.address === contractAddress);

  const { balance } = useTokenBalance(network, accountNumber, contractAddress, BackgroundExecutor);

  const [address, setAddress] = useState<string>(''); // our address
  const [toAddress, setToAddress] = useState<string>('');
  const [bytes, setBytes] = useState<string>(''); // txhex ready to broadcast
  const [amountToSend, setAmountToSend] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [screenState, setScreenState] = useState<'init' | 'preparing' | 'prepared'>('init');
  const [fees, setFees] = useState<StringNumber>(); // min fees user will have to pay for the transaction
  const [maxFees, setMaxFees] = useState<StringNumber>(); // max fees user will have to pay for the transaction
  const { askMnemonic } = useContext(AskMnemonicContext);
  const [feeMultiplier, setFeeMultiplier] = useState<number>(1);

  const formatBalanceNativeCoin = (balance: StringNumber, network: Networks): string => {
    const decimals = getDecimalsByNetwork(network);
    return new BigNumber(balance)
      .dividedBy(new BigNumber(10).pow(decimals))
      .toFixed(7)
      .replace(/\.?0+$/, '');
  };

  useEffect(() => {
    BackgroundExecutor.getAddress(network, accountNumber).then((addressResponse) => {
      setAddress(addressResponse);
    });
  }, [accountNumber, network]);

  const handleScanQr = async () => {
    try {
      const scannedAddress = await scanQr();
      if (scannedAddress) {
        setToAddress(scannedAddress);
      }
    } catch (error) {
      console.error('QR scan error:', error);
      setError('Failed to scan QR code');
    }
  };

  const broadcastTransaction = async () => {
    try {
      console.log('broadcasting', bytes);
      const e = new EvmWallet();
      const transactionId = await e.broadcastTransaction(network, bytes);
      console.log('broadcasted:', transactionId);
      if (typeof transactionId !== 'string') {
        throw new Error('Error: ' + JSON.stringify(transactionId));
      }

      const satValueBN = new BigNumber(amountToSend);
      const satValue = satValueBN.multipliedBy(new BigNumber(10).pow(token?.decimals ?? 1)).toString(10);

      router.replace({
        pathname: '/TransactionSuccessEvm',
        params: {
          transactionId,
          amount: '0',
          network: network,
          bytes,
          recipient: toAddress,
          amountToken: satValue,
          tokenContractAddress: token?.address,
        },
      });
    } catch (error: any) {
      setError(error.message);
    }
  };

  const prepareTransaction = async () => {
    setScreenState('preparing');
    setError('');
    try {
      assert(address, 'internal error: address not loaded');
      assert(balance, 'internal error: balance not loaded');
      assert(token, 'internal error: token not loaded');
      assert(toAddress, 'recipient address empty');
      assert(EvmWallet.isAddressValid(toAddress), 'recipient address is not valid');
      const amt = parseFloat(amountToSend);
      assert(!isNaN(amt), 'Invalid amount');
      assert(amt > 0, 'Amount should be > 0');

      const satValueToSendBN = new BigNumber(amt);
      const satValueToSend = satValueToSendBN.multipliedBy(new BigNumber(10).pow(token.decimals)).toString(10);
      assert(new BigNumber(balance).gte(satValueToSend), 'Not enough balance');

      const e = new EvmWallet();
      const paymentTransaction = await e.createTokenTransferTransaction(address, toAddress, token, satValueToSend);
      const feeData = await e.getFeeData(network);
      let baseFee;
      try {
        baseFee = await e.getBaseFeePerGas(network);
      } catch {
        baseFee = 0n;
      }
      const prepared = await e.prepareTransaction(paymentTransaction, network, feeData, BigInt(feeMultiplier));

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

      const mnemonic = await askMnemonic();
      const bytes = await e.signTransaction(prepared, mnemonic, accountNumber);
      setBytes(bytes);
      setScreenState('prepared');
    } catch (error: any) {
      console.error(error.message);
      setError(error.message);
      setScreenState('init');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen
        options={{
          title: `Send ${token?.name}`,
          headerShown: true,
        }}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <ThemedText style={styles.networkText}>on {getTickerByNetwork(network)}</ThemedText>

            <ThemedView style={styles.inputContainer}>
              <ThemedText style={styles.label}>Recipient</ThemedText>
              <View style={styles.addressInputContainer}>
                <TextInput style={styles.input} placeholder="Enter the recipient's address" value={toAddress} onChangeText={setToAddress} placeholderTextColor="#888" />
                <TouchableOpacity style={styles.scanButton} onPress={handleScanQr}>
                  <Ionicons name="qr-code-outline" size={24} color="#2f95dc" />
                </TouchableOpacity>
              </View>
            </ThemedView>

            <ThemedView style={styles.inputContainer}>
              <ThemedText style={styles.label}>Amount</ThemedText>
              <TextInput style={styles.input} placeholder="0.00" value={amountToSend} onChangeText={setAmountToSend} keyboardType="decimal-pad" placeholderTextColor="#888" />
              <ThemedText style={styles.balanceText}>
                Available balance: {token?.symbol} {balance ? formatBalance(balance, token?.decimals ?? 1, 2) : ''}
              </ThemedText>
            </ThemedView>

            {fees && maxFees && (
              <ThemedText style={styles.feesText}>
                Fees between {formatBalanceNativeCoin(fees, network)} {getTickerByNetwork(network)} and {formatBalanceNativeCoin(maxFees, network)} {getTickerByNetwork(network)}
              </ThemedText>
            )}

            {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

            {screenState === 'preparing' && <ThemedText style={styles.loadingText}>Preparing transaction...</ThemedText>}

            {screenState === 'init' && (
              <View style={styles.feeSliderContainer}>
                <ThemedText style={styles.feeLabel}>Fee priority: {feeMultiplier}x</ThemedText>
                <Slider
                  style={styles.slider}
                  minimumValue={1}
                  maximumValue={5}
                  step={1}
                  value={feeMultiplier}
                  onValueChange={setFeeMultiplier}
                  minimumTrackTintColor="#2f95dc"
                  maximumTrackTintColor="#d3d3d3"
                />
              </View>
            )}

            {screenState === 'init' && (
              <TouchableOpacity style={styles.sendButton} onPress={prepareTransaction}>
                <Ionicons name="send" size={20} color="white" style={styles.sendIcon} />
                <ThemedText style={styles.sendButtonText}>Send</ThemedText>
              </TouchableOpacity>
            )}

            {screenState === 'prepared' && (
              <View style={styles.confirmContainer}>
                <LongPressButton onLongPressComplete={broadcastTransaction} style={styles.confirmButton} title="Hold to confirm send" />

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setBytes('');
                    setFees(undefined);
                    setMaxFees(undefined);
                    setScreenState('init');
                  }}
                >
                  <ThemedText style={styles.cancelText}>Cancel</ThemedText>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
  },
  networkText: {
    fontSize: 16,
    color: 'gray',
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontWeight: 'bold',
    marginBottom: 8,
    fontSize: 16,
  },
  addressInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  scanButton: {
    marginLeft: 8,
    padding: 8,
  },
  balanceText: {
    color: 'gray',
    marginTop: 8,
    fontSize: 14,
  },
  feesText: {
    color: 'gray',
    marginBottom: 16,
    fontSize: 14,
  },
  errorText: {
    color: 'red',
    marginBottom: 16,
    fontSize: 14,
  },
  loadingText: {
    marginVertical: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  feeSliderContainer: {
    marginBottom: 20,
  },
  feeLabel: {
    color: 'gray',
    fontSize: 14,
    marginBottom: 8,
  },
  slider: {
    height: 40,
    width: '100%',
  },
  sendButton: {
    backgroundColor: '#2f95dc',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  sendButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  sendIcon: {
    marginRight: 8,
  },
  confirmContainer: {
    alignItems: 'center',
  },
  confirmButton: {
    backgroundColor: '#2f95dc',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  cancelButton: {
    marginTop: 16,
    padding: 8,
  },
  cancelText: {
    color: 'gray',
    textDecorationLine: 'underline',
    fontSize: 16,
  },
});

export default SendTokenEvm;
