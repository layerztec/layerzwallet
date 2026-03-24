import { Ionicons } from '@expo/vector-icons';
import Pressable from '../../components/Pressable';
import assert from 'assert';
import BigNumber from 'bignumber.js';
import * as bolt11 from 'bolt11';
import { Stack, useRouter } from 'expo-router';
import React, { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';

import AmountInput from '@/components/AmountInput';
import RadialGradientScreen from '@/components/RadialGradientScreen';
import ScreenSendHeader from '@/components/navigation/ScreenSendHeader';
import { ThemedText } from '@/components/ThemedText';
import { overlayBackgroundDeeper } from '@shared/constants/Colors';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useBalance } from '@shared/hooks/useBalance';
import { useCachedExchangeRate } from '@shared/hooks/useCachedExchangeRate';
import { useSelectedFiat } from '@shared/hooks/useSelectedFiat';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { formatBalance } from '@shared/modules/string-utils';
import { NETWORK_BITCOIN } from '@shared/types/networks';
import { useSendFlow } from './_layout';

const SendAmountLightning: React.FC = () => {
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const { lightning, denomination, setDenomination, amount } = useSendFlow();
  const { accountNumber } = useContext(AccountNumberContext);
  assert(lightning && lightning.layer, 'Lightning context not found');
  const { layer } = lightning;
  const { balance } = useBalance(layer, accountNumber, BackgroundExecutor);
  const fiat = useSelectedFiat();
  const { exchangeRate } = useCachedExchangeRate(NETWORK_BITCOIN, fiat);

  const [localAmount, setLocalAmount] = useState(amount);
  const [localMemo, setLocalMemo] = useState('');
  const [error, setError] = useState<string>('');
  const [isPreparing, setIsPreparing] = useState(false);

  const formattedBalance = formatBalance(balance || '0', getDecimalsByNetwork(NETWORK_BITCOIN));
  const decimals = getDecimalsByNetwork(network);

  // Determine if this is LNURL or invoice
  const isLnurl = Boolean(lightning.lnurlPayServicePayload);
  const isInvoice = Boolean(lightning.decodedInvoice && !lightning.decodedInvoice.satoshis);
  const lnurlPayload = lightning.lnurlPayServicePayload;
  const commentAllowed = lnurlPayload?.commentAllowed || 0;
  const canAddMemo = isLnurl && commentAllowed > 0;

  useEffect(() => {
    // If we have a lightning address with fixed amount, set it
    if (lnurlPayload && lnurlPayload.min && lnurlPayload.max && lnurlPayload.min === lnurlPayload.max) {
      setLocalAmount(String(lnurlPayload.min));
    }
  }, [lnurlPayload]);

  useEffect(() => {
    setError('');
  }, [localAmount]);

  const handleDenominationSwitch = () => {
    if (exchangeRate) {
      setDenomination(denomination === 'Native' ? 'Fiat' : 'Native');
    }
  };

  const handleAmountChange = (text: string) => {
    const normalized = text.replace(',', '.');
    if (normalized === '' || /^\d*\.?\d*$/.test(normalized)) {
      setLocalAmount(normalized);
      setError('');
    }
  };

  const handleMemoChange = (text: string) => {
    if (commentAllowed > 0 && text.length <= commentAllowed) {
      setLocalMemo(text);
      setError('');
    }
  };

  const handleMaxPress = () => {
    if (!balance) return;
    setLocalAmount(formattedBalance);
  };

  const validateAmount = (): string | null => {
    if (!localAmount) {
      return 'Please enter an amount';
    }

    const amountSats = BigNumber(localAmount).multipliedBy(BigNumber(10).pow(decimals)).toNumber();
    if (isNaN(amountSats) || amountSats <= 0) {
      return 'Amount must be greater than 0';
    }

    // Check LNURL limits if applicable
    if (isLnurl && lnurlPayload) {
      if (lnurlPayload.min && amountSats < lnurlPayload.min) {
        return `Amount must be at least ${lnurlPayload.min} sats`;
      }
      if (lnurlPayload.max && amountSats > lnurlPayload.max) {
        return `Amount must be at most ${lnurlPayload.max} sats`;
      }
    }

    if (!balance) return 'Balance not loaded';
    if (BigNumber(balance).lt(amountSats)) return 'Insufficient balance';

    return null;
  };

  const handleContinue = async () => {
    const validationError = validateAmount();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsPreparing(true);
    setError('');

    try {
      // If LNURL, fetch fresh invoice with amount and memo
      if (isLnurl && lightning.lnurlInstance) {
        // convert amount to sats
        const amountSats = BigNumber(localAmount).multipliedBy(BigNumber(10).pow(decimals)).toNumber();
        const memoToSend = canAddMemo ? localMemo : '';

        const bolt11payload = await lightning.lnurlInstance.requestBolt11FromLnurlPayService(amountSats, memoToSend);

        if (bolt11payload && bolt11payload.pr) {
          const invoiceToUse = bolt11payload.pr;
          const decodedInvoiceToUse = bolt11.decode(invoiceToUse); // decode the new invoice
          lightning.setInvoice(invoiceToUse);
          lightning.setDecodedInvoice(decodedInvoiceToUse);
        } else {
          throw new Error('Failed to fetch invoice from LNURL service');
        }
      } else if (isInvoice) {
        // For invoice with no amount, the invoice is already set
        // The payment service will use the user-entered amount
        // No need to modify the invoice
      }

      router.push('/send/send-confirm-lightning');
    } catch (err: any) {
      console.error('Failed to prepare lightning payment:', err);
      setError('Failed to prepare payment: ' + err.message);
    } finally {
      setIsPreparing(false);
    }
  };

  const buttonDisabled = !localAmount || !!error || !balance || isPreparing;

  return (
    <RadialGradientScreen network={network} scroll={true}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenSendHeader network={network} title={`Send ${getTickerByNetwork(network)}`} />

      <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <View style={styles.container}>
          <View style={styles.inputSection}>
            <AmountInput
              value={localAmount}
              onChangeText={handleAmountChange}
              ticker={getTickerByNetwork(NETWORK_BITCOIN)}
              balance={formattedBalance}
              exchangeRate={exchangeRate}
              denomination={denomination}
              decimals={getDecimalsByNetwork(NETWORK_BITCOIN)}
              onDenominationSwitch={handleDenominationSwitch}
              onMaxPress={handleMaxPress}
              onBalancePress={handleMaxPress}
            />

            {canAddMemo && (
              <View style={styles.memoSection}>
                <ThemedText style={styles.memoLabel}>Memo (optional, max {commentAllowed} chars)</ThemedText>
                <View style={styles.memoInputContainer}>
                  <TextInput
                    style={styles.memoInput}
                    placeholder="Add a memo"
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    value={localMemo}
                    onChangeText={handleMemoChange}
                    maxLength={commentAllowed}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </View>
            )}

            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="close" size={16} color="white" />
                <ThemedText style={styles.errorText}>{error}</ThemedText>
              </View>
            )}
          </View>

          <Pressable style={[styles.continueButton, buttonDisabled && styles.disabledButton]} onPress={handleContinue} disabled={buttonDisabled}>
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
      </KeyboardAvoidingView>
    </RadialGradientScreen>
  );
};

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
  memoSection: {
    marginTop: 16,
  },
  memoLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginBottom: 8,
  },
  memoInputContainer: {
    backgroundColor: overlayBackgroundDeeper,
    borderRadius: 12,
    padding: 12,
  },
  memoInput: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
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
    marginBottom: 24,
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

export default SendAmountLightning;
