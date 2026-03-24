import { Ionicons } from '@expo/vector-icons';
import BigNumber from 'bignumber.js';
import { Stack, useRouter } from 'expo-router';
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Pressable from '../../components/Pressable';

import AmountInput from '@/components/AmountInput';
import RadialGradientScreen from '@/components/RadialGradientScreen';
import ScreenSendHeader from '@/components/navigation/ScreenSendHeader';
import { ThemedText } from '@/components/ThemedText';
import { overlayBackgroundDeeper } from '@shared/constants/Colors';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { CreateTransactionTarget } from '@shared/class/wallets/types';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { useBalance } from '@shared/hooks/useBalance';
import { useCachedExchangeRate } from '@shared/hooks/useCachedExchangeRate';
import { useSelectedFiat } from '@shared/hooks/useSelectedFiat';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { formatFiatDisplay } from '@shared/modules/fiat-utils';
import { sleep } from '@shared/modules/sleep';
import { formatBalance } from '@shared/modules/string-utils';
import { validateAddress } from '@shared/modules/wallet-utils';
import { useSendFlow } from './_layout';
import { TFeeEstimate } from '@shared/blue_modules/BlueElectrum';

enum FeeIndex {
  Fast = 'fast',
  Medium = 'medium',
  Slow = 'slow',
}

const FeeOptions = [
  { index: FeeIndex.Fast, name: 'Fast', key: 'fast' as keyof TFeeEstimate },
  { index: FeeIndex.Medium, name: 'Medium', key: 'medium' as keyof TFeeEstimate },
  { index: FeeIndex.Slow, name: 'Slow', key: 'slow' as keyof TFeeEstimate },
] as const;

const SendAmountBtc: React.FC = () => {
  const router = useRouter();
  const { network, address, amount: contextAmount, setAmount: setContextAmount, setCreatedTransaction, bitcoin, denomination, setDenomination } = useSendFlow();
  const { accountNumber } = useContext(AccountNumberContext);
  const { balance } = useBalance(network, accountNumber, BackgroundExecutor);
  const fiat = useSelectedFiat();
  const { exchangeRate } = useCachedExchangeRate(network);

  const [localAmount, setLocalAmount] = useState(contextAmount);
  const [selectedFeeRate, setSelectedFeeRate] = useState<number | undefined>();
  const [selectedFeeIndex, setSelectedFeeIndex] = useState<FeeIndex | undefined>();
  const [isFeeSelectorExpanded, setIsFeeSelectorExpanded] = useState(false);
  const [customFeeRate, setCustomFeeRate] = useState<number | undefined>();
  const [isCreatingTransaction, setIsCreatingTransaction] = useState(false);
  const [transactionError, setTransactionError] = useState<string | null>(null);

  const isLoading = bitcoin ? bitcoin.isLoadingSendData || bitcoin.isLoadingFees : false;
  const wallet = bitcoin?.wallet;
  const sendData = bitcoin?.sendData;
  const estimateFees = bitcoin?.feeEstimate;
  const feeLoadingError = bitcoin?.feeLoadingError;
  const formattedBalance = formatBalance(balance || '0', getDecimalsByNetwork(network));

  const handleDenominationSwitch = () => {
    if (exchangeRate) {
      setDenomination(denomination === 'Native' ? 'Fiat' : 'Native');
    }
  };

  const formatFee = (feeInSats: number): string => {
    if (denomination === 'Fiat' && exchangeRate) {
      const feeInNative = new BigNumber(feeInSats).dividedBy(new BigNumber(10).pow(getDecimalsByNetwork(network)));
      const feeInFiat = feeInNative.multipliedBy(Number(exchangeRate));
      return formatFiatDisplay(feeInFiat.toFixed(2), fiat);
    } else {
      return `${formatBalance(feeInSats.toString(), getDecimalsByNetwork(network))} ${getTickerByNetwork(network)}`;
    }
  };

  const buttonDisabled = useMemo(() => {
    return isLoading || (feeLoadingError && !customFeeRate) || !localAmount || !sendData || isCreatingTransaction;
  }, [isLoading, feeLoadingError, customFeeRate, localAmount, sendData, isCreatingTransaction]);

  const [feeRate, feeIndex] = useMemo(() => {
    if (selectedFeeRate !== undefined) return [selectedFeeRate, selectedFeeIndex ?? FeeIndex.Medium];
    if (customFeeRate !== undefined) return [customFeeRate, FeeIndex.Slow];
    if (estimateFees) return [estimateFees.medium, FeeIndex.Medium];
    return [1, FeeIndex.Slow];
  }, [selectedFeeRate, customFeeRate, estimateFees, selectedFeeIndex]);

  const feeName = useMemo(() => {
    switch (feeIndex) {
      case FeeIndex.Fast:
        return 'Fast';
      case FeeIndex.Medium:
        return 'Medium';
      case FeeIndex.Slow:
        return 'Slow';
      default:
        return 'Network Fee';
    }
  }, [feeIndex]);

  const feeRateOptions: { [rate: number]: number } = useMemo(() => {
    if (!sendData?.utxos || !address || !wallet) {
      return {};
    }

    const options = new Set<number>([feeRate]);
    if (estimateFees) {
      options.add(estimateFees.slow);
      options.add(estimateFees.medium);
      options.add(estimateFees.fast);
    }

    const satValueBN = new BigNumber(parseFloat(localAmount || '0'));
    const satValue = satValueBN.multipliedBy(new BigNumber(10).pow(getDecimalsByNetwork(network))).toNumber();

    const targets: CreateTransactionTarget[] = [
      {
        address: wallet.isAddressValid(address) ? address : '36JxaUrpDzkEerkTf1FzwHNE1Hb7cCjgJV',
        value: Number.isNaN(satValue) || satValue === 0 ? 546 : satValue,
      },
    ];

    const result: { [key: number]: number } = {};
    Array.from(options).forEach((v) => {
      try {
        const { fee } = wallet.coinselect(sendData.utxos, targets, v);
        result[v] = fee;
      } catch (e: any) {
        if (e.message.includes('Not enough')) {
          const targets2 = targets.map((t, index) => (index > 0 ? { ...t, value: 546 } : { address: t.address }));
          try {
            const { fee } = wallet.coinselect(sendData.utxos, targets2, v);
            result[v] = fee;
          } catch {}
        }
      }
    });

    return result;
  }, [feeRate, estimateFees, sendData?.utxos, localAmount, address, network, wallet]);

  const maxAmount: string | undefined = useMemo(() => {
    if (!sendData?.utxos || !address || !wallet) {
      return;
    }

    const targets: CreateTransactionTarget[] = [{ address }];

    try {
      const res1 = wallet.coinselect(sendData.utxos, targets, feeRate);
      return new BigNumber(res1.outputs[0].value).dividedBy(new BigNumber(10).pow(getDecimalsByNetwork(network))).toString();
    } catch (e: any) {
      if (e.message.includes('Not enough')) {
        try {
          const res2 = wallet.coinselect(sendData.utxos, targets, 1);
          return new BigNumber(res2.outputs[0].value).dividedBy(new BigNumber(10).pow(getDecimalsByNetwork(network))).toString();
        } catch {}
      }
    }
  }, [feeRate, sendData?.utxos, address, network, wallet]);

  const handleAmountChange = (text: string) => {
    const normalized = text.replace(',', '.');
    if (normalized === '' || /^\d*\.?\d*$/.test(normalized)) {
      setLocalAmount(normalized);
      setValidationError(null);
    }
  };

  const handleCustomFeeChange = (text: string) => {
    const normalized = text.replace(',', '.');
    if (normalized === '' || /^\d*\.?\d*$/.test(normalized)) {
      const numValue = normalized === '' ? undefined : Number(normalized);
      setCustomFeeRate(numValue);
      setSelectedFeeRate(undefined);
    }
  };

  const handleMaxPress = () => {
    if (maxAmount) {
      setLocalAmount(maxAmount);
    } else {
      Alert.alert('Error', 'Failed to calculate maximum amount');
    }
  };

  const handleFeeSelection = (feeRate: number, index: FeeIndex) => {
    setSelectedFeeRate(feeRate);
    setSelectedFeeIndex(index);
    setIsFeeSelectorExpanded(false);
  };

  const toggleFeeSelector = () => {
    setIsFeeSelectorExpanded(!isFeeSelectorExpanded);
  };

  const validateAmount = () => {
    if (!localAmount || !balance) return { isValid: false, error: 'Please enter an amount' };
    const networkDecimals = getDecimalsByNetwork(network);
    if (localAmount.includes('.') && localAmount.split('.')[1]?.length > networkDecimals) {
      return { isValid: false, error: `Maximum ${networkDecimals} decimal place${networkDecimals !== 1 ? 's' : ''} allowed` };
    }

    const amt = parseFloat(localAmount);
    if (isNaN(amt) || amt <= 0) return { isValid: false, error: 'Amount must be greater than 0' };

    const satValueBN = new BigNumber(amt);
    const satValue = satValueBN.multipliedBy(new BigNumber(10).pow(networkDecimals)).toString(10);
    if (!new BigNumber(balance).gte(satValue)) {
      return { isValid: false, error: 'Insufficient balance' };
    }
    return { isValid: true, error: null };
  };

  const validateFee = () => {
    if (feeLoadingError && customFeeRate === undefined) {
      return { isValid: false, error: 'Please enter a custom fee rate' };
    }
    if (customFeeRate !== undefined && (isNaN(customFeeRate) || customFeeRate <= 0)) {
      return { isValid: false, error: 'Please enter a valid fee rate' };
    }
    return { isValid: true, error: null };
  };

  const [validationError, setValidationError] = useState<string | null>(null);

  const handleContinue = async () => {
    const amountValidation = validateAmount();
    const feeValidation = validateFee();

    if (!amountValidation.isValid) {
      setValidationError(amountValidation.error);
      return;
    }

    if (!feeValidation.isValid) {
      setValidationError(feeValidation.error);
      return;
    }

    if (localAmount && sendData && wallet) {
      setValidationError(null);
      setTransactionError(null);
      setIsCreatingTransaction(true);

      await sleep(100);

      try {
        const amt = parseFloat(localAmount);
        const satValueBN = new BigNumber(amt);
        const satValue = satValueBN.multipliedBy(new BigNumber(10).pow(getDecimalsByNetwork(network))).toString(10);

        const isAddressValid = validateAddress(network, address);
        if (!isAddressValid) {
          throw new Error('Recipient address is not valid');
        }

        const mnemonic = await BackgroundExecutor.getMasterSeed();
        wallet.setSecret(mnemonic);
        wallet.setDerivationPath(`m/84'/0'/${accountNumber}'`);

        const targets: CreateTransactionTarget[] = [
          {
            address: address,
            value: Number(satValue),
          },
        ];

        // setting up internals of a wallet to properly function:
        for (const [key, value] of Object.entries(sendData.extraProperties)) {
          (wallet as any)[key] = value;
        }

        const { tx, fee } = wallet.createTransaction(sendData.utxos, targets, feeRate, sendData.changeAddress);

        if (!tx) {
          throw new Error('Failed to create transaction');
        }

        setCreatedTransaction({
          txhex: tx.toHex(),
          actualFee: fee,
          feeRate: feeRate,
        });

        setContextAmount(localAmount);
        router.push('/send/send-confirm');
      } catch (error: any) {
        console.error('Failed to create transaction:', error);
        setTransactionError(error.message || 'Failed to create transaction');
      } finally {
        setIsCreatingTransaction(false);
      }
    }
  };

  const expandAnimation = useSharedValue(0);
  const chevronRotation = useSharedValue(0);
  useEffect(() => {
    const duration = 100;
    if (isFeeSelectorExpanded) {
      expandAnimation.value = withTiming(1, { duration });
      chevronRotation.value = withTiming(1, { duration });
    } else {
      expandAnimation.value = withTiming(0, { duration });
      chevronRotation.value = withTiming(0, { duration });
    }
  }, [isFeeSelectorExpanded, expandAnimation, chevronRotation]);

  const animatedFeeOptionsStyle = useAnimatedStyle(() => {
    const height = interpolate(expandAnimation.value, [0, 1], [0, estimateFees ? 192 : 0], Extrapolation.CLAMP);
    const opacity = interpolate(expandAnimation.value, [0, 0.1, 1], [0, 0, 1], Extrapolation.CLAMP);
    return { height, opacity };
  });

  const animatedChevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${chevronRotation.value}deg` }] }));

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
              ticker={getTickerByNetwork(network)}
              balance={formattedBalance}
              exchangeRate={exchangeRate}
              denomination={denomination}
              decimals={getDecimalsByNetwork(network)}
              onDenominationSwitch={handleDenominationSwitch}
              onMaxPress={handleMaxPress}
              onBalancePress={handleMaxPress}
            />

            {validationError && (
              <View style={styles.errorContainer}>
                <Ionicons name="close" size={16} color="white" />
                <ThemedText style={styles.errorText}>{validationError}</ThemedText>
              </View>
            )}

            {transactionError && (
              <View style={styles.errorContainer}>
                <Ionicons name="close" size={16} color="white" />
                <ThemedText style={styles.errorText}>{transactionError}</ThemedText>
              </View>
            )}
          </View>

          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.8)" />
              <ThemedText style={styles.loadingText}>Loading network fees...</ThemedText>
            </View>
          )}

          {feeLoadingError && (
            <View style={styles.feeErrorContainer}>
              <View style={styles.feeErrorHeader}>
                <Ionicons name="warning" size={20} color="#FF9500" />
                <ThemedText style={styles.feeErrorTitle}>Network fees unavailable</ThemedText>
              </View>
              <ThemedText style={styles.feeErrorText}>{feeLoadingError || 'Unable to load network fees. Please enter a custom fee rate manually.'}</ThemedText>
              <View style={styles.customFeeInputContainer}>
                <ThemedText style={styles.customFeeLabel}>Custom Fee Rate (sats/vB)</ThemedText>
                <TextInput
                  style={styles.customFeeInput}
                  placeholder="Enter fee rate"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  keyboardType="numeric"
                  value={customFeeRate ? String(customFeeRate) : ''}
                  onChangeText={handleCustomFeeChange}
                />
              </View>
            </View>
          )}

          {!isLoading && !feeLoadingError && (
            <View style={styles.feeSelectorContainer}>
              <Pressable style={isFeeSelectorExpanded ? styles.feeSelectorExpandedHeader : styles.feeSelectorHeader} onPress={toggleFeeSelector}>
                {isFeeSelectorExpanded ? (
                  <>
                    <ThemedText style={styles.feeSelectorTitle}>Network Fee</ThemedText>
                    <Animated.View style={animatedChevronStyle}>
                      <Ionicons name="chevron-down" size={20} color="rgba(255, 255, 255, 0.6)" />
                    </Animated.View>
                  </>
                ) : (
                  <>
                    <View style={styles.feeSelectorCollapsedContent}>
                      <ThemedText style={styles.feeSelectorLabel}>Network Fee</ThemedText>
                      <ThemedText style={styles.feeSelectorSelected}>
                        {feeName}
                        {feeRateOptions[feeRate] && ` - ${formatFee(feeRateOptions[feeRate])}`}
                      </ThemedText>
                    </View>
                    <Animated.View style={animatedChevronStyle}>
                      <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.6)" />
                    </Animated.View>
                  </>
                )}
              </Pressable>

              {estimateFees && (
                <Animated.View style={[styles.feeOptionsContainer, animatedFeeOptionsStyle]}>
                  {FeeOptions.map((option) => (
                    <Pressable
                      key={option.index}
                      style={[styles.feeOption, feeIndex === option.index && styles.selectedFeeOption]}
                      onPress={() => handleFeeSelection(estimateFees[option.index], option.index)}
                    >
                      <View style={styles.feeOptionContent}>
                        <ThemedText style={styles.feeOptionName}>{option.name}</ThemedText>
                        <ThemedText style={styles.feeOptionRate}>{estimateFees[option.key]} sats v/b</ThemedText>
                      </View>
                      <ThemedText style={styles.feeOptionAmount}>{formatFee(feeRateOptions[estimateFees[option.key]])}</ThemedText>
                    </Pressable>
                  ))}
                </Animated.View>
              )}
            </View>
          )}

          <Pressable style={[styles.continueButton, buttonDisabled && styles.disabledButton]} onPress={handleContinue} disabled={buttonDisabled}>
            {isCreatingTransaction ? (
              <>
                <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.8)" />
                <ThemedText style={styles.continueButtonText}>Creating...</ThemedText>
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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    gap: 12,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  feeSelectorContainer: {
    marginBottom: 30,
  },
  feeSelectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 17,
    borderRadius: 16,
    height: 64,
  },
  feeSelectorExpandedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 17,
    borderRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    height: 64,
  },
  feeSelectorTitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 18,
    fontWeight: '400',
  },
  feeSelectorCollapsedContent: {
    flex: 1,
  },
  feeSelectorLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
  },
  feeSelectorSelected: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
  },
  feeOptionsContainer: {
    backgroundColor: overlayBackgroundDeeper,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
  },
  feeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: overlayBackgroundDeeper,
    height: 64,
  },
  selectedFeeOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  feeOptionContent: {
    flex: 1,
  },
  feeOptionName: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  feeOptionRate: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
  },
  feeOptionAmount: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    textAlign: 'right',
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
  feeErrorContainer: {
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.3)',
  },
  feeErrorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  feeErrorTitle: {
    color: '#FF9500',
    fontSize: 16,
    fontWeight: '600',
  },
  feeErrorText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 16,
  },
  customFeeInputContainer: {
    gap: 12,
  },
  customFeeLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  customFeeInput: {
    backgroundColor: overlayBackgroundDeeper,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
  },
});

export default SendAmountBtc;
