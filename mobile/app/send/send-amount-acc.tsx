import { Ionicons } from '@expo/vector-icons';
import BigNumber from 'bignumber.js';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';

import AmountInput from '@/components/AmountInput';
import GradientScreen from '@/components/GradientScreen';
import ScreenSendHeader from '@/components/navigation/ScreenSendHeader';
import { ThemedText } from '@/components/ThemedText';
import { SendAssetProps, withAsset } from '@/hooks/withAsset';
import { formatBalance } from '@shared/modules/string-utils';
import { validateAddress } from '@shared/modules/wallet-utils';
import { useSendFlow } from './_layout';
import Pressable from '@/components/Pressable';

const SendAmountAcc: React.FC<SendAssetProps> = ({ balance, exchangeRate, ticker, token, decimals }) => {
  const router = useRouter();
  const { network, address: recipientAddress, amount: contextAmount, setAmount: setContextAmount, denomination, setDenomination, memo: contextMemo, setMemo: setContextMemo } = useSendFlow();

  const [localAmount, setLocalAmount] = useState(contextAmount);
  const [localMemo, setLocalMemo] = useState(contextMemo);
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

    try {
      const isValid = validateAddress(network, recipientAddress);
      if (!isValid) return 'Invalid recipient address';
    } catch (error: any) {
      return error.message || 'Invalid recipient address';
    }

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

  const handleNext = async () => {
    // For account-based wallets, we don't create a transaction hex
    // Instead, we store the amount and let send-confirm handle the actual payment
    const err = validate();
    if (err) {
      setErrorMessage(err);
      return;
    }
    setErrorMessage(null);
    setContextAmount(localAmount);
    setContextMemo(localMemo || '');
    router.push('/send/send-confirm');
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
              testID="send-amount-acc-input"
            />

            {errorMessage && (
              <View style={styles.errorContainer}>
                <Ionicons name="close" size={16} color="white" />
                <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
              </View>
            )}

            {/* Memo field - only shown for Stacks STX token */}
            {token?.id === 'STX' && (
              <View style={styles.memoSection}>
                <ThemedText style={styles.memoLabel}>Memo (optional)</ThemedText>
                <TextInput
                  style={styles.memoInput}
                  value={localMemo}
                  onChangeText={setLocalMemo}
                  placeholder="Enter memo"
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline={false}
                />
              </View>
            )}
          </View>

          <Pressable style={[styles.continueButton, buttonDisabled && styles.disabledButton]} onPress={handleNext} disabled={buttonDisabled} testID="send-amount-acc-next-button">
            <ThemedText style={styles.continueButtonText}>Next</ThemedText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </GradientScreen>
  );
};

export default withAsset(SendAmountAcc);

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
  memoSection: {
    marginTop: 24,
  },
  memoLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  memoInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
});
