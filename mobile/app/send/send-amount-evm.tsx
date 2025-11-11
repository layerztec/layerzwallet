import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import BigNumber from 'bignumber.js';
import { Stack, useRouter } from 'expo-router';
import React, { useContext, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

import AmountInput from '@/components/AmountInput';
import GradientScreen from '@/components/GradientScreen';
import ScreenSendHeader from '@/components/navigation/ScreenSendHeader';
import { ThemedText } from '@/components/ThemedText';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { EvmWallet } from '@shared/class/evm-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { formatBalance } from '@shared/modules/string-utils';
import { withAsset, SendAssetProps } from '@/hooks/withAsset';
import { useSendFlow } from './_layout';

const SendAmountEvm: React.FC<SendAssetProps> = ({ balance, exchangeRate, ticker, token, decimals }) => {
  const router = useRouter();
  const { network, address: recipientAddress, amount: contextAmount, setAmount: setContextAmount, denomination, setDenomination, setCreatedTransaction } = useSendFlow();
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
    if (!EvmWallet.isAddressValid(recipientAddress)) return 'Invalid recipient address';
    if (!localAmount) return 'Please enter an amount';
    const amt = parseFloat(localAmount);
    if (isNaN(amt) || amt <= 0) return 'Amount must be greater than 0';
    if (!balance) return 'Balance not loaded';
    const amountInBase = new BigNumber(amt).multipliedBy(new BigNumber(10).pow(decimals));
    if (amountInBase.isNaN() || amountInBase.lte(0)) return 'Invalid amount';
    if (new BigNumber(balance).lt(amountInBase)) return 'Insufficient balance';
    return null;
  };

  const prepareTransaction = async () => {
    const err = validate();
    if (err) {
      setErrorMessage(err);
      return;
    }
    setErrorMessage(null);
    setIsPreparing(true);
    try {
      const sender = await BackgroundExecutor.getAddress(network, accountNumber);
      const amt = new BigNumber(localAmount || '0');
      const value = amt.multipliedBy(new BigNumber(10).pow(decimals)).toString(10);

      const e = new EvmWallet();
      let paymentTransaction;

      if (token) {
        // Create token transfer transaction
        paymentTransaction = await e.createTokenTransferTransaction(sender, recipientAddress, token, value);
      } else {
        // Create regular payment transaction
        paymentTransaction = await e.createPaymentTransaction(sender, recipientAddress, value);
      }

      const feeData = await e.getFeeData(network);
      let baseFee;
      try {
        baseFee = await e.getBaseFeePerGas(network);
      } catch {
        baseFee = 0n;
      }
      const prepared = await e.prepareTransaction(paymentTransaction, network, feeData, BigInt(Math.round(feeMultiplier)));

      const calculatedMinFee = e.calculateMinFee(baseFee, prepared);

      const mnemonic = await BackgroundExecutor.getMasterSeed();
      const signedBytes = await e.signTransaction(prepared, mnemonic, accountNumber);
      setContextAmount(localAmount || '');

      // Calculate actual fee (using min fee as the actual fee)
      const actualFeeNumber = parseFloat(calculatedMinFee);

      // Store transaction and redirect to confirm screen
      setCreatedTransaction({
        txhex: signedBytes,
        actualFee: actualFeeNumber,
        feeRate: undefined, // EVM doesn't use feeRate like Bitcoin
      });

      router.push('/send/send-confirm');
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to prepare transaction');
    } finally {
      setIsPreparing(false);
    }
  };

  const buttonDisabled = !localAmount || !!errorMessage;

  return (
    <GradientScreen variant={network} scroll={true}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenSendHeader network={network} title={`Send ${ticker}`} />

      <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
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
          </View>

          <TouchableOpacity style={[styles.continueButton, buttonDisabled && styles.disabledButton]} onPress={prepareTransaction} disabled={buttonDisabled || isPreparing}>
            {isPreparing ? (
              <>
                <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.8)" />
                <ThemedText style={styles.continueButtonText}>Creating...</ThemedText>
              </>
            ) : (
              <ThemedText style={styles.continueButtonText}>Next</ThemedText>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </GradientScreen>
  );
};

export default withAsset(SendAmountEvm);

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  inputSection: {
    marginBottom: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  errorText: {
    color: 'white',
    fontSize: 14,
  },
  feeSection: {
    marginBottom: 30,
  },
  feeLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 12,
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
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    marginTop: 'auto',
  },
  continueButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
