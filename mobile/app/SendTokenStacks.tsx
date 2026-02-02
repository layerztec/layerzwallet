import React, { useContext, useState, useEffect, useCallback } from 'react';
import Pressable from '../components/Pressable';
import { View, Text, TextInput, StyleSheet, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import assert from 'assert';
import BigNumber from 'bignumber.js';

import RadialGradientScreen from '@/components/RadialGradientScreen';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import LongPressButton from '@/components/LongPressButton';
import { useTokenBalance } from '@shared/hooks/useTokenBalance';
import { useBalance } from '@shared/hooks/useBalance';
import { capitalizeFirstLetter, formatBalance } from '@shared/modules/string-utils';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { ThemedText } from '@/components/ThemedText';
import { CachedTokenInfo } from '@shared/types/token-info';
import { walletCanHaveTokens } from '@shared/class/wallets/interface-can-have-tokens';
import { TSupportedLazyInitWalletNetworks } from '@shared/modules/wallet-utils';

export type SendTokenStacksParams = {
  tokenId: string;
  tokenSymbol: string;
  tokenName: string;
  tokenDecimals: string;
};

// Enum for the different steps in the send token flow
export enum SendTokenStacksStep {
  Init,
  Loading,
  Preparing,
  Prepared,
  Sending,
  Sent,
}

export default function SendTokenStacksScreen() {
  const params = useLocalSearchParams<SendTokenStacksParams>();
  const allowMemo = params.tokenId === 'STX';

  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { scanQr } = useContext(ScanQrContext);

  // State management
  const [step, setStep] = useState<SendTokenStacksStep>(SendTokenStacksStep.Init);
  const [toAddress, setToAddress] = useState<string>('');
  const [memo, setMemo] = useState<string>('');
  const [amountToSend, setAmountToSend] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [token, setToken] = useState<CachedTokenInfo>();

  const tokenPublicKey = params.tokenId || '';
  const { balance: balanceNative } = useBalance(network, accountNumber, BackgroundExecutor);
  const { balance } = useTokenBalance(network, accountNumber, tokenPublicKey, BackgroundExecutor);

  // Use colors that work well with gradient backgrounds
  const textColor = 'rgba(255, 255, 255, 0.9)';
  const borderColor = 'rgba(255, 255, 255, 0.3)';
  const primaryColor = 'rgba(255, 255, 255, 0.8)';
  const errorColor = 'rgba(255, 100, 100, 0.9)';
  const successColor = 'rgba(75, 181, 67, 1)';

  // Loading token useEffect
  useEffect(() => {
    const loadToken = async () => {
      try {
        const wallet = await BackgroundExecutor.lazyInitWallet(network as TSupportedLazyInitWalletNetworks, accountNumber);
        assert(walletCanHaveTokens(wallet), 'Not a wallet that can have tokens');

        const tokenBalances = wallet.getTokenBalances();

        for (const token of tokenBalances) {
          if (token.id === tokenPublicKey) {
            setToken(token);
            // setTokenIdentifier(key);
            return;
          }
        }
        setError('Token not found');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    loadToken();
  }, [accountNumber, network, tokenPublicKey]);

  // Re-render trigger when balanceNative changes
  useEffect(() => {
    // do nothing, just to trigger a re-render when balanceNative changes
  }, [balanceNative, network]);

  // actuallySend function
  const actuallySend = async () => {
    try {
      assert(token, 'internal error: token not loaded');
      setStep(SendTokenStacksStep.Sending);
      await new Promise((resolve) => setTimeout(resolve, 200)); // propagate ui
      const wallet = await BackgroundExecutor.lazyInitWallet(network as TSupportedLazyInitWalletNetworks, accountNumber);
      assert(walletCanHaveTokens(wallet), 'Not a wallet that can have tokens');

      const satValueToSend = new BigNumber(amountToSend).multipliedBy(new BigNumber(10).pow(token.decimals)).toFixed(0);

      const transactionId = await wallet.transferToken(token.id, BigInt(satValueToSend), toAddress, memo);

      if (transactionId) {
        setStep(SendTokenStacksStep.Sent);
      } else {
        setError('Error: transaction failed (unknown error)');
      }
    } catch (error: any) {
      setError(error.message);
      setStep(SendTokenStacksStep.Init);
    }
  };

  // prepareTransaction function
  const prepareTransaction = async () => {
    setStep(SendTokenStacksStep.Loading);
    await new Promise((resolve) => setTimeout(resolve, 200)); // propagate ui
    setError('');
    try {
      assert(balance, 'internal error: balance not loaded');
      assert(token, 'internal error: token not loaded');
      assert(toAddress, 'recipient address empty');
      const amt = parseFloat(amountToSend);
      assert(!isNaN(amt), 'Invalid amount');
      assert(amt > 0, 'Amount should be > 0');

      const satValueToSendBN = new BigNumber(amt);
      const satValueToSend = satValueToSendBN.multipliedBy(new BigNumber(10).pow(token.decimals)).toString(10);
      assert(new BigNumber(balance).gte(satValueToSend), 'Not enough balance');

      await new Promise((r) => setTimeout(r, 200)); // propagate
      setStep(SendTokenStacksStep.Prepared);
    } catch (error: any) {
      setError(error.message);
      setStep(SendTokenStacksStep.Init);
    }
  };

  const handleScanQR = useCallback(async () => {
    try {
      const scannedAddress = await scanQr();
      if (scannedAddress) {
        setToAddress(scannedAddress);
      }
    } catch (error) {
      console.error('QR scan error:', error);
      Alert.alert('Error', 'Failed to scan QR code');
    }
  }, [scanQr]);

  const handleMaxAmount = useCallback(() => {
    if (balance && token) {
      const formattedBalance = formatBalance(balance, token.decimals, 8);
      setAmountToSend(formattedBalance);
    }
  }, [balance, token]);

  const resetToInit = () => {
    router.replace('/Home');
  };

  // Validate required parameters after all hooks
  if (!params.tokenId || !params.tokenSymbol) {
    Alert.alert('Error', 'Missing token information');
    router.back();
    return null;
  }

  return (
    <RadialGradientScreen network={network}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title={`Send ${token?.name || params.tokenName}`} />
      <View style={styles.networkBadge}>
        <ThemedText style={styles.networkText}>on {capitalizeFirstLetter(network)}</ThemedText>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoidingView}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <>
            {/* Form fields - only show when not sent */}
            {step !== SendTokenStacksStep.Sent && (
              <>
                {/* Recipient Address */}
                <View style={styles.section}>
                  <Text style={[styles.label, { color: textColor }]}>Recipient</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          color: textColor,
                          borderColor: borderColor,
                          backgroundColor: 'rgba(0, 0, 0, 0.2)',
                        },
                      ]}
                      value={toAddress}
                      onChangeText={setToAddress}
                      placeholder="Enter the recipient's address"
                      testID="recipient-address-input"
                      placeholderTextColor="rgba(255, 255, 255, 0.6)"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={step === SendTokenStacksStep.Init}
                    />
                    <Pressable style={styles.scanButton} onPress={handleScanQR} activeOpacity={0.7}>
                      <Ionicons name="scan-outline" size={20} color="rgba(255, 255, 255, 0.8)" />
                    </Pressable>
                  </View>
                </View>

                {/* Amount */}
                <View style={styles.section}>
                  <View style={styles.amountHeader}>
                    <Text style={[styles.label, { color: textColor }]}>Amount</Text>
                    <Pressable onPress={handleMaxAmount} activeOpacity={0.7}>
                      <Text style={[styles.maxButton, { color: primaryColor }]}>MAX</Text>
                    </Pressable>
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        color: textColor,
                        borderColor: borderColor,
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      },
                    ]}
                    value={amountToSend}
                    onChangeText={setAmountToSend}
                    placeholder="0.00"
                    testID="amount-input"
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    keyboardType="decimal-pad"
                    editable={step === SendTokenStacksStep.Init}
                  />
                  {/* Available Balance */}
                  <Text style={[styles.balanceText, { color: textColor, opacity: 0.8, marginTop: 8 }]}>
                    {`Available balance: ${token?.symbol} ${balance ? formatBalance(balance, token?.decimals ?? 2, token?.decimals ?? 2) : ''}`}
                  </Text>
                </View>

                {/* Memo */}
                {allowMemo ? (
                  <View style={styles.section}>
                    <View style={styles.amountHeader}>
                      <Text style={[styles.label, { color: textColor }]}>Memo</Text>
                    </View>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          color: textColor,
                          borderColor: borderColor,
                          backgroundColor: 'rgba(0, 0, 0, 0.2)',
                        },
                      ]}
                      value={memo}
                      onChangeText={setMemo}
                      placeholder=""
                      placeholderTextColor="rgba(255, 255, 255, 0.6)"
                      editable={step === SendTokenStacksStep.Init}
                    />
                  </View>
                ) : null}
              </>
            )}

            {/* Error Display */}
            {error && (
              <View style={[styles.errorContainer, { marginBottom: 16 }]}>
                <Text style={[styles.errorText, { color: errorColor }]}>{error}</Text>
              </View>
            )}

            {/* Loading States */}
            {step === SendTokenStacksStep.Loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={primaryColor} size="small" />
                <Text style={[styles.loadingText, { color: textColor }]}>Loading...</Text>
              </View>
            )}

            {step === SendTokenStacksStep.Sending && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={primaryColor} size="small" />
                <Text style={[styles.loadingText, { color: textColor }]}>Sending...</Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              {step === SendTokenStacksStep.Init && (
                <Pressable style={styles.sendButton} onPress={prepareTransaction} activeOpacity={0.7} testID="send-screen-send-button">
                  <Ionicons name="send" size={20} color="#FFFFFF" style={styles.sendIcon} />
                  <Text style={styles.sendButtonText}>Send</Text>
                </Pressable>
              )}

              {step === SendTokenStacksStep.Prepared && (
                <View style={styles.preparedContainer}>
                  <LongPressButton
                    onLongPressComplete={actuallySend}
                    style={styles.confirmButton}
                    textStyle={styles.confirmButtonText}
                    title="Hold to confirm send"
                    progressColor="rgba(255, 255, 255, 0.3)"
                  />
                  <Pressable style={styles.cancelButton} onPress={resetToInit} activeOpacity={0.7}>
                    <Text style={[styles.cancelButtonText, { color: textColor }]}>Cancel</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* Success Screen */}
            {step === SendTokenStacksStep.Sent && (
              <View style={styles.successContainer}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark-circle" size={64} color={successColor} />
                </View>
                <Text style={[styles.successTitle, { color: textColor }]}>Transaction Sent!</Text>
                <Text style={[styles.successMessage, { color: textColor, opacity: 0.8 }]}>Your token transfer was successful.</Text>
                <Pressable style={[styles.sendAnotherButton, { backgroundColor: successColor }]} onPress={resetToInit} activeOpacity={0.7}>
                  <Text style={styles.sendAnotherButtonText}>Back to Wallet</Text>
                </Pressable>
              </View>
            )}
          </>
        </ScrollView>
      </KeyboardAvoidingView>
    </RadialGradientScreen>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
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
    marginLeft: 12,
  },
  amountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  maxButton: {
    fontSize: 14,
    fontWeight: '600',
  },
  balanceText: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 100, 100, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 100, 100, 0.3)',
  },
  errorText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  buttonContainer: {
    marginTop: 24,
  },
  sendIcon: {
    marginRight: 0,
  },
  sendButton: {
    backgroundColor: '#000000',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  sendButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  confirmButton: {
    backgroundColor: '#000000',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 280,
  },
  sendAnotherButton: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
  },
  sendAnotherButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  networkBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 30,
  },
  networkText: {
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  preparedContainer: {
    width: '100%',
  },
});
