import { Ionicons } from '@expo/vector-icons';
import Pressable from '../components/Pressable';
import assert from 'assert';
import BigNumber from 'bignumber.js';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext, useRef, useState } from 'react';
import { View, ScrollView, ActivityIndicator, StyleSheet, TextInput } from 'react-native';

import GradientScreen from '@/components/GradientScreen';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import LongPressButton from '@/components/LongPressButton';
import { ThemedText } from '@/components/ThemedText';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { ArkWallet } from '@shared/class/wallets/ark-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useBalance } from '@shared/hooks/useBalance';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { formatBalance } from '@shared/modules/string-utils';
import { NETWORK_ARK, NETWORK_ARK_MUTINYNET, NETWORK_SPARK, NETWORK_STACKS } from '@shared/types/networks';
import { SparkWallet } from '@shared/class/wallets/spark-wallet';
import { StacksWallet } from '@shared/class/wallets/stacks-wallet';
import { InterfaceAccountBasedWallet } from '@shared/class/wallets/interface-account-based-wallet';

export type SendAccountBasedParams = {
  toAddress?: string;
  amount?: string;
};

/**
 * This screen is used to send native-coin transactions for all
 * single-address wallets (Ark, Spark, Stacks)
 */
const SendAccountBased = () => {
  const params = useLocalSearchParams<SendAccountBasedParams>();
  const router = useRouter();
  const { scanQr } = useContext(ScanQrContext);

  const toAddress = params.toAddress ?? '';
  const amount = params.amount ?? '';
  const [error, setError] = useState<string>('');
  const [isPreparing, setIsPreparing] = useState<boolean>(false);
  const [isPrepared, setIsPrepared] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { balance } = useBalance(network, accountNumber, BackgroundExecutor);
  const accountBasedWallet = useRef<InterfaceAccountBasedWallet | undefined>(undefined);

  const actualSend = async () => {
    let startTs = Date.now();
    try {
      setIsSending(true);
      await new Promise((resolve) => setTimeout(resolve, 100)); // sleep to propagate
      const satValueBN = new BigNumber(amount);
      const satValue = satValueBN.multipliedBy(new BigNumber(10).pow(getDecimalsByNetwork(network))).toString(10);

      if (!accountBasedWallet) {
        throw new Error('Internal error: accountBasedWallet is not set');
      }
      console.log('actual value to send:', +satValue);

      startTs = Date.now();
      const transactionId = await accountBasedWallet.current?.pay(toAddress, +satValue);
      assert(transactionId, 'Internal error: accountBasedWallet.pay() failed');
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

      await new Promise((r) => setTimeout(r, 200)); // propagate

      assert(network === NETWORK_ARK_MUTINYNET || network === NETWORK_SPARK || network === NETWORK_ARK || network === NETWORK_STACKS, 'Internal error: wallet of incorrect type');
      let w = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
      assert(w instanceof ArkWallet || w instanceof SparkWallet || w instanceof StacksWallet, 'Internal error: incorrect wallet instance');

      accountBasedWallet.current = w;
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
      <GradientScreen variant={network}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title={`Send ${getTickerByNetwork(network)}`} />
        <View style={styles.successContainer}>
          <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
          <ThemedText style={styles.successTitle}>Transaction Sent!</ThemedText>
          <Pressable style={styles.backButton} onPress={() => router.replace('/Home')}>
            <ThemedText style={styles.backButtonText}>Back to Wallet</ThemedText>
          </Pressable>
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
          <View style={styles.networkBadge}>
            <ThemedText style={styles.networkText}>{network.toUpperCase()} LAYER</ThemedText>
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
                onChangeText={(text) => router.setParams({ toAddress: text })}
                value={toAddress}
              />
              <Pressable
                style={styles.scanButton}
                onPress={async () => {
                  const scanned = await scanQr();
                  if (scanned) {
                    router.setParams({ toAddress: scanned });
                  }
                }}
              >
                <Ionicons name="scan-outline" size={20} color="rgba(255, 255, 255, 0.8)" />
              </Pressable>
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
              onChangeText={(text) => {
                const normalized = text.replace(',', '.');
                router.setParams({ amount: normalized });
              }}
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
            <Pressable style={styles.sendButton} testID="send-screen-send-button" onPress={prepareTransaction}>
              <Ionicons name="send" size={20} color="rgba(255, 255, 255, 0.8)" style={styles.sendIcon} />
              <ThemedText style={styles.sendButtonText}>Send</ThemedText>
            </Pressable>
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

                <Pressable
                  onPress={() => {
                    setIsPreparing(false);
                    setIsPrepared(false);
                  }}
                  style={styles.cancelButton}
                >
                  <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
                </Pressable>
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

export default SendAccountBased;
