import { Ionicons } from '@expo/vector-icons';
import assert from 'assert';
import BigNumber from 'bignumber.js';
import { router, Stack } from 'expo-router';
import React, { useContext, useRef, useState } from 'react';
import { View, ScrollView, ActivityIndicator, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

import GradientScreen from '@/components/GradientScreen';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import LongPressButton from '@/components/LongPressButton';
import { ThemedText } from '@/components/ThemedText';
import { AskMnemonicContext } from '@/src/hooks/AskMnemonicContext';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { ArkWallet } from '@shared/class/wallets/ark-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useBalance } from '@shared/hooks/useBalance';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { formatBalance } from '@shared/modules/string-utils';
import { NETWORK_SPARK } from '@shared/types/networks';
import { SparkWallet } from '@shared/class/wallets/spark-wallet';

const SendArk = () => {
  const { scanQr } = useContext(ScanQrContext);
  const [toAddress, setToAddress] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isPreparing, setIsPreparing] = useState<boolean>(false);
  const [isPrepared, setIsPrepared] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { askMnemonic } = useContext(AskMnemonicContext);
  const { balance } = useBalance(network, accountNumber, BackgroundExecutor);
  const arkWallet = useRef<ArkWallet | undefined>(undefined);

  const handleAmountChange = (text: string) => {
    const normalizedText = text.replace(',', '.');
    if (normalizedText === '' || /^\d*\.?\d*$/.test(normalizedText)) {
      setAmount(normalizedText);
      setError('');
    }
  };

  const actualSend = async () => {
    let startTs = Date.now();
    try {
      setIsSending(true);
      await new Promise((resolve) => setTimeout(resolve, 100)); // sleep to propagate
      const satValueBN = new BigNumber(amount);
      const satValue = satValueBN.multipliedBy(new BigNumber(10).pow(getDecimalsByNetwork(network))).toString(10);

      if (!arkWallet) {
        throw new Error('Internal error: ArkWallet is not set');
      }
      console.log('actual value to send:', +satValue);

      startTs = Date.now();
      const transactionId = await arkWallet.current?.pay(toAddress, +satValue);
      assert(transactionId, 'Internal error: ArkWallet.pay() failed');
      console.log('submitted txid:', transactionId);

      setIsSuccess(true);
    } catch (error: any) {
      setError(error.message);
    } finally {
      console.log('actualSend took', (Date.now() - startTs) / 1000, 'sec');
      setIsSending(false);
    }
  };

  const prepareTransaction = async () => {
    setIsPreparing(true);
    setError('');
    try {
      // TODO: validate the address
      // TODO: validate the amount

      let mnemonic = await askMnemonic();
      let w: ArkWallet | SparkWallet = new ArkWallet();

      if (network === NETWORK_SPARK) {
        w = new SparkWallet();
        mnemonic = await BackgroundExecutor.getSubMnemonic(accountNumber);
        w.setSecret(mnemonic);
        await w.init();
      } else {
        w.setSecret(mnemonic);
        w.setAccountNumber(accountNumber);
        await w.init();
      }
      arkWallet.current = w;

      setIsPrepared(true);
    } catch (error: any) {
      console.error(error.message);
      setError(error.message);
    } finally {
      setIsPreparing(false);
    }
  };

  if (isSuccess) {
    return (
      <GradientScreen variant="green">
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title={`Send ${getTickerByNetwork(network)}`} />
        <View style={styles.successContainer}>
          <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
          <ThemedText style={styles.successTitle}>Transaction Sent!</ThemedText>
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/home')}>
            <ThemedText style={styles.backButtonText}>Back to Wallet</ThemedText>
          </TouchableOpacity>
        </View>
      </GradientScreen>
    );
  }

  return (
    <GradientScreen variant="green">
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title={`Send ${getTickerByNetwork(network)}`} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentContainer}>
          <View style={styles.networkBadge}>
            <ThemedText style={styles.networkText}>{network === NETWORK_SPARK ? 'SPARK' : 'ARK'} NETWORK</ThemedText>
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning" size={20} color="#ff4444" />
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            </View>
          ) : null}

          <View style={styles.inputSection}>
            <ThemedText style={styles.inputLabel}>Recipient</ThemedText>
            <View style={styles.addressInputContainer}>
              <TextInput
                style={styles.input}
                testID="recipient-address-input"
                placeholder="Enter the recipient's address"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                onChangeText={setToAddress}
                value={toAddress}
              />
              <TouchableOpacity
                style={styles.scanButton}
                onPress={async () => {
                  const scanned = await scanQr();
                  console.log({ scanned });
                  if (scanned) {
                    setToAddress(scanned);
                  }
                }}
              >
                <Ionicons name="qr-code-outline" size={20} color="rgba(255, 255, 255, 0.8)" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputSection}>
            <ThemedText style={styles.inputLabel}>Amount</ThemedText>
            <TextInput
              style={styles.input2}
              testID="amount-input"
              placeholder="0.00"
              placeholderTextColor="rgba(255, 255, 255, 0.6)"
              keyboardType="numeric"
              onChangeText={handleAmountChange}
              value={amount}
            />
            <ThemedText style={styles.balanceText}>
              Available balance: {balance ? formatBalance(balance, getDecimalsByNetwork(network), 8) : ''} {getTickerByNetwork(network)}
            </ThemedText>
          </View>

          {isPreparing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.8)" />
              <ThemedText style={styles.loadingText}>Preparing transaction...</ThemedText>
            </View>
          ) : null}

          {!isPreparing && !isPrepared ? (
            <TouchableOpacity style={styles.sendButton} testID="send-screen-send-button" onPress={prepareTransaction}>
              <Ionicons name="send" size={20} color="rgba(255, 255, 255, 0.8)" style={styles.sendIcon} />
              <ThemedText style={styles.sendButtonText}>Send</ThemedText>
            </TouchableOpacity>
          ) : null}

          {isPrepared ? (
            isSending ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.8)" />
                <ThemedText style={styles.loadingText}>Sending...</ThemedText>
              </View>
            ) : (
              <View style={styles.confirmContainer}>
                <LongPressButton
                  style={styles.sendButton}
                  textStyle={styles.sendButtonText}
                  onLongPressComplete={actualSend}
                  title="Hold to confirm send"
                  progressColor="#FFFFFF"
                  backgroundColor="#007AFF"
                />

                <TouchableOpacity
                  onPress={() => {
                    setIsPreparing(false);
                    setIsPrepared(false);
                  }}
                  style={styles.cancelButton}
                >
                  <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
                </TouchableOpacity>
              </View>
            )
          ) : null}
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
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 69, 0, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 0, 0.4)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 30,
  },
  networkText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
    textAlign: 'center',
  },
  inputSection: {
    marginBottom: 30,
  },
  inputLabel: {
    marginBottom: 12,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  addressInputContainer: {
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
  input2: {
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    paddingHorizontal: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  scanButton: {
    width: 50,
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceText: {
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 8,
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
  sendButton: {
    backgroundColor: '#000000',
    borderRadius: 16,
    height: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    gap: 8,
  },
  sendIcon: {
    marginRight: 0,
  },
  sendButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  confirmContainer: {
    marginTop: 20,
  },
  confirmButton: {
    backgroundColor: '#000000',
    borderRadius: 16,
    height: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  cancelButton: {
    marginTop: 15,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    textDecorationLine: 'underline',
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  successTitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 20,
    marginBottom: 30,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#000000',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '80%',
    alignItems: 'center',
  },
  backButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: 'bold',
  },
});

export default SendArk;
