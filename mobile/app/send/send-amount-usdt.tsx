import type { PrepareSendRequest } from '@breeztech/breez-sdk-liquid';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import assert from 'assert';
import BigNumber from 'bignumber.js';
import { Stack, useRouter } from 'expo-router';
import React, { useContext, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Pressable from '../../components/Pressable';

import AmountInput from '@/components/AmountInput';
import GradientScreen from '@/components/GradientScreen';
import ScreenSendHeader from '@/components/navigation/ScreenSendHeader';
import { ThemedText } from '@/components/ThemedText';
import { SendAssetProps, withAsset } from '@/hooks/withAsset';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { EvmWallet } from '@shared/class/evm-wallet';
import { BreezWallet } from '@shared/class/wallets/breez-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getTickerByNetwork } from '@shared/models/network-getters';
import { getTokenInfo } from '@shared/models/token-list';
import { formatBalance } from '@shared/modules/string-utils';
import { NETWORK_LIQUID, NETWORK_LIQUID_TESTNET, NETWORK_ROOTSTOCK, NETWORK_SPARK } from '@shared/types/networks';
import { useSendFlow } from './_layout';

const SendAmountUsdt: React.FC<SendAssetProps> = ({ balance, exchangeRate, ticker, token: tokenInfo, decimals }) => {
  const router = useRouter();
  const { network: contextNetwork } = useContext(NetworkContext);
  const { network, address: recipientAddress, token, amount: contextAmount, setAmount: setContextAmount, denomination, setDenomination, setCreatedTransaction, setLiquidPrepareResult } = useSendFlow();
  const { accountNumber } = useContext(AccountNumberContext);

  const [localAmount, setLocalAmount] = useState(contextAmount);
  const [feeMultiplier, setFeeMultiplier] = useState(1);
  const [isPreparing, setIsPreparing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const formattedBalance = formatBalance(balance || '0', decimals);

  const handleDenominationSwitch = () => {
    if (exchangeRate) {
      setDenomination(denomination === 'Native' ? 'Fiat' : 'Native');
    }
  };

  const handleAmountChange = (text: string) => {
    const normalized = text.replace(',', '.');
    if (normalized === '' || /^\d*\.?\d*$/.test(normalized)) {
      setLocalAmount(normalized);
      setErrorMessage(null);
    }
  };

  const handleMaxPress = () => {
    if (!balance) return;
    setLocalAmount(formattedBalance);
  };

  const validate = () => {
    if (!recipientAddress?.trim()) return 'Recipient address is required';
    if (!localAmount) return 'Please enter an amount';
    if (localAmount.includes('.') && localAmount.split('.')[1]?.length > decimals) {
      return `Maximum ${decimals} decimal place${decimals !== 1 ? 's' : ''} allowed`;
    }
    const amt = parseFloat(localAmount);
    if (isNaN(amt) || amt <= 0) return 'Amount must be greater than 0';
    if (!balance) return 'Balance not loaded';
    const amountInBase = new BigNumber(amt).multipliedBy(new BigNumber(10).pow(decimals));
    if (amountInBase.isNaN() || amountInBase.lte(0)) return 'Invalid amount';
    if (new BigNumber(balance).lt(amountInBase)) return 'Insufficient balance';
    return null;
  };

  const prepareRootstockTransaction = async () => {
    const err = validate();
    if (err) {
      setErrorMessage(err);
      return;
    }
    setErrorMessage(null);
    setIsPreparing(true);

    try {
      assert(token, 'Token ID is required');
      const sender = await BackgroundExecutor.getAddress(network, accountNumber);
      const amt = new BigNumber(localAmount || '0');
      const value = amt.multipliedBy(new BigNumber(10).pow(decimals)).toString(10);

      const e = new EvmWallet();

      // Create token transfer transaction
      const tokenInfo = getTokenInfo(token);
      const paymentTransaction = await e.createTokenTransferTransaction(sender, recipientAddress, tokenInfo, value);

      const feeData = await e.getFeeData(network);
      let baseFee;
      try {
        baseFee = await e.getBaseFeePerGas(network);
      } catch {
        baseFee = 0n;
      }
      const prepared = await e.prepareTransaction(paymentTransaction, network, feeData, BigInt(Math.round(feeMultiplier)));

      const mnemonic = await BackgroundExecutor.getMasterSeed();
      const signedBytes = await e.signTransaction(prepared, mnemonic, accountNumber);
      setContextAmount(localAmount || '');

      // Calculate actual fee (using min fee as the actual fee)
      const calculatedMinFee = e.calculateMinFee(baseFee, prepared);
      const actualFeeNumber = parseFloat(calculatedMinFee);

      // Store transaction and redirect to confirm screen
      setCreatedTransaction({
        txhex: signedBytes,
        actualFee: actualFeeNumber,
        feeRate: undefined, // EVM doesn't use feeRate like Bitcoin
      });

      router.push('/send/send-confirm');
    } catch (e: any) {
      console.error('Failed to prepare transaction:', e);
      setErrorMessage(e.message || 'Failed to prepare transaction');
    } finally {
      setIsPreparing(false);
    }
  };

  const prepareLiquidTransaction = async () => {
    const err = validate();
    if (err) {
      setErrorMessage(err);
      return;
    }
    setErrorMessage(null);
    setIsPreparing(true);

    try {
      assert(network === NETWORK_LIQUID || network === NETWORK_LIQUID_TESTNET, 'Network must be Liquid');
      assert(token, 'Token ID is required');

      const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
      assert(wallet instanceof BreezWallet, 'Wallet must be a BreezWallet');

      // Prepare the send payment
      const prepareRequest: PrepareSendRequest = {
        destination: recipientAddress,
        amount: {
          type: 'asset',
          toAsset: token, // USDT asset ID
          receiverAmount: parseFloat(localAmount),
        },
      };

      const prepareResponse = await wallet.prepareSendPayment(prepareRequest);
      setLiquidPrepareResult(prepareResponse);
      setContextAmount(localAmount);
      router.push('/send/send-confirm');
    } catch (err: any) {
      console.error('Failed to prepare transaction:', err);
      setErrorMessage('Failed to prepare transaction: ' + err.message);
    } finally {
      setIsPreparing(false);
    }
  };

  const prepareSparkTransaction = async () => {
    const err = validate();
    if (err) {
      setErrorMessage(err);
      return;
    }

    setErrorMessage(null);

    setContextAmount(localAmount);
    router.push('/send/send-confirm');
  };

  const handleContinue = async () => {
    if (network === NETWORK_ROOTSTOCK) {
      await prepareRootstockTransaction();
    } else if (network === NETWORK_LIQUID || network === NETWORK_LIQUID_TESTNET) {
      await prepareLiquidTransaction();
    } else if (network === NETWORK_SPARK) {
      await prepareSparkTransaction();
    } else {
      setErrorMessage('Unsupported network');
    }
  };

  const buttonDisabled = !localAmount || !!errorMessage;

  return (
    <GradientScreen variant={contextNetwork} scroll={true}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenSendHeader network={contextNetwork} title={`Send ${getTickerByNetwork(contextNetwork)}`} />

      <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.container}>
            <View style={styles.inputSection}>
              <AmountInput
                value={localAmount}
                onChangeText={handleAmountChange}
                ticker={ticker}
                balance={formattedBalance}
                exchangeRate={exchangeRate !== undefined ? String(exchangeRate) : undefined}
                denomination={denomination}
                decimals={decimals}
                onDenominationSwitch={handleDenominationSwitch}
                onMaxPress={handleMaxPress}
                onBalancePress={handleMaxPress}
              />

              {errorMessage && (
                <View style={styles.errorContainer}>
                  <Ionicons name="close" size={16} color="white" />
                  <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
                </View>
              )}
            </View>

            {/* Fee Section - Only show for Rootstock (EVM) */}
            {network === NETWORK_ROOTSTOCK && (
              <View style={styles.feeSection}>
                <ThemedText style={styles.feeLabel}>Fee Speed: {feeMultiplier.toFixed(0)}x</ThemedText>
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
                <ThemedText style={styles.feeNote}>Higher fees result in faster confirmation times</ThemedText>
              </View>
            )}

            <Pressable style={[styles.continueButton, buttonDisabled && styles.disabledButton]} onPress={handleContinue} disabled={buttonDisabled || isPreparing}>
              {isPreparing ? (
                <>
                  <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.8)" />
                  <ThemedText style={styles.continueButtonText}>Preparing...</ThemedText>
                </>
              ) : (
                <ThemedText style={styles.continueButtonText}>Next</ThemedText>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientScreen>
  );
};

export default withAsset(SendAmountUsdt);

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  inputSection: {
    marginBottom: 24,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 100, 100, 0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 100, 100, 0.3)',
  },
  errorText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    flex: 1,
  },
  feeSection: {
    marginBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  feeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 12,
  },
  sliderContainer: {
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sliderLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  feeNote: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 8,
    fontStyle: 'italic',
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  continueButton: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginTop: 'auto',
  },
  disabledButton: {
    opacity: 0.5,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
});
