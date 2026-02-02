import type { PrepareSendRequest } from '@breeztech/breez-sdk-liquid';
import { Ionicons } from '@expo/vector-icons';
import assert from 'assert';
import BigNumber from 'bignumber.js';
import { Stack, useRouter } from 'expo-router';
import React, { useContext, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Pressable from '../../components/Pressable';

import AmountInput from '@/components/AmountInput';
import RadialGradientScreen from '@/components/RadialGradientScreen';
import ScreenSendHeader from '@/components/navigation/ScreenSendHeader';
import { ThemedText } from '@/components/ThemedText';
import { SendAssetProps, withAsset } from '@/hooks/withAsset';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { BreezWallet, LBTC_ASSET_IDS } from '@shared/class/wallets/breez-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { formatBalance } from '@shared/modules/string-utils';
import { validateAddress } from '@shared/modules/wallet-utils';
import { NETWORK_LIQUID, NETWORK_LIQUID_TESTNET } from '@shared/types/networks';
import { useSendFlow } from './_layout';

const SendAmountLiquid: React.FC<SendAssetProps> = ({ balance, exchangeRate, ticker, token, decimals }) => {
  const router = useRouter();
  const { network, address, amount: contextAmount, setAmount: setContextAmount, setLiquidPrepareResult, token: contextToken, denomination, setDenomination } = useSendFlow();
  const { accountNumber } = useContext(AccountNumberContext);

  const [localAmount, setLocalAmount] = useState(contextAmount);
  const [error, setError] = useState<string>('');
  const [isPreparing, setIsPreparing] = useState<boolean>(false);

  // Determine which asset to use: token from context or default L-BTC
  const targetAssetId = useMemo(() => {
    const defaultAssetId = network === NETWORK_LIQUID ? LBTC_ASSET_IDS.mainnet : LBTC_ASSET_IDS.testnet;
    return contextToken || defaultAssetId;
  }, [contextToken, network]);

  const isLoading = balance === undefined;

  const formattedBalance = formatBalance(balance || '0', decimals);

  const handleAmountChange = (text: string) => {
    const normalizedText = text.replace(',', '.');
    if (normalizedText === '' || /^\d*\.?\d*$/.test(normalizedText)) {
      setLocalAmount(normalizedText);
      setError('');
    }
  };

  const handleDenominationSwitch = () => {
    if (exchangeRate) {
      setDenomination(denomination === 'Native' ? 'Fiat' : 'Native');
    }
  };

  const handleMaxPress = () => {
    if (!balance) return;
    setLocalAmount(formattedBalance);
  };

  const validateInputs = (): string | null => {
    if (!address || address.trim() === '') {
      return 'Please enter a valid Liquid address';
    }

    if (!localAmount || localAmount === '') {
      return 'Please enter an amount';
    }

    if (localAmount.includes('.') && localAmount.split('.')[1]?.length > decimals) {
      return `Maximum ${decimals} decimal place${decimals !== 1 ? 's' : ''} allowed`;
    }

    const amountNum = parseFloat(localAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return 'Please enter a valid amount';
    }

    if (!balance) return 'Balance not loaded';
    const amountInBase = new BigNumber(amountNum).multipliedBy(new BigNumber(10).pow(decimals));
    if (amountInBase.isNaN() || amountInBase.lte(0)) return 'Invalid amount';
    if (new BigNumber(balance).lt(amountInBase)) return 'Insufficient balance';

    if (!validateAddress(network, address)) {
      return 'Invalid Liquid address';
    }

    return null;
  };

  const handleContinue = async () => {
    const validationError = validateInputs();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsPreparing(true);
    setError('');

    try {
      assert(network === NETWORK_LIQUID || network === NETWORK_LIQUID_TESTNET, 'Network must be Liquid');
      const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
      assert(wallet instanceof BreezWallet, 'Wallet must be a BreezWallet');

      // Prepare the send payment
      const prepareRequest: PrepareSendRequest = {
        destination: address,
        amount: {
          type: 'asset',
          toAsset: targetAssetId,
          receiverAmount: parseFloat(localAmount),
        },
      };

      const prepareResponse = await wallet.prepareSendPayment(prepareRequest);
      setLiquidPrepareResult(prepareResponse);
      setContextAmount(localAmount);
      router.push('/send/send-confirm');
    } catch (err: any) {
      console.error('Failed to prepare transaction:', err);
      setError('Failed to prepare transaction: ' + err.message);
    } finally {
      setIsPreparing(false);
    }
  };

  const buttonDisabled = !localAmount || !!error || isLoading || isPreparing;

  if (isLoading) {
    return (
      <RadialGradientScreen network={network} scroll={true}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenSendHeader network={network} title={`Send ${ticker}`} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="rgba(255, 255, 255, 0.8)" />
          <ThemedText style={styles.loadingText}>Loading assets...</ThemedText>
        </View>
      </RadialGradientScreen>
    );
  }

  return (
    <RadialGradientScreen network={network} scroll={true}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenSendHeader network={network} title={`Send ${ticker}`} />

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
        </ScrollView>
      </KeyboardAvoidingView>
    </RadialGradientScreen>
  );
};

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  inputSection: {
    marginBottom: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
    paddingRight: 16,
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
});

export default withAsset(SendAmountLiquid);
