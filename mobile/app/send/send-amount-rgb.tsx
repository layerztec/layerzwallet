import { Ionicons } from '@expo/vector-icons';
import assert from 'assert';
import BigNumber from 'bignumber.js';
import { Stack, useRouter } from 'expo-router';
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import AmountInput from '@/components/AmountInput';
import RadialGradientScreen from '@/components/RadialGradientScreen';
import ScreenSendHeader from '@/components/navigation/ScreenSendHeader';
import { ThemedText } from '@/components/ThemedText';
import { overlayBackgroundDeeper } from '@shared/constants/Colors';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { TFeeEstimate } from '@shared/blue_modules/BlueElectrum';
import { RGBWallet } from '@shared/class/wallets/rgb-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { useBalance } from '@shared/hooks/useBalance';
import { useCachedExchangeRate } from '@shared/hooks/useCachedExchangeRate';
import { useTokenBalance } from '@shared/hooks/useTokenBalance';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { sleep } from '@shared/modules/sleep';
import { formatBalance } from '@shared/modules/string-utils';
import { NETWORK_RGB, NETWORK_RGB_TESTNET } from '@shared/types/networks';
import { CachedTokenInfo } from '@shared/types/token-info';
import Pressable from '../../components/Pressable';
import { useSendFlow } from './_layout';

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

const SendAmountRgb: React.FC = () => {
  const router = useRouter();
  const {
    network: networkType,
    address,
    amount: contextAmount,
    setAmount: setContextAmount,
    setCreatedTransaction,
    denomination,
    setDenomination,
    setRgbPreparedTx,
    rgbDecodedInvoice,
    token,
  } = useSendFlow();
  const network = networkType as typeof NETWORK_RGB | typeof NETWORK_RGB_TESTNET;
  const { accountNumber } = useContext(AccountNumberContext);
  const { balance: btcBalance } = useBalance(network, accountNumber, BackgroundExecutor);
  const { balance: tokenBalance } = useTokenBalance(network, accountNumber, token || '', BackgroundExecutor);
  const { exchangeRate } = useCachedExchangeRate(network, 'USD');

  // Token info state - fetched from wallet
  const [tokenInfo, setTokenInfo] = useState<CachedTokenInfo | null>(null);

  const [localAmount, setLocalAmount] = useState(contextAmount);
  const [selectedFeeRate, setSelectedFeeRate] = useState<number | undefined>();
  const [selectedFeeIndex, setSelectedFeeIndex] = useState<FeeIndex | undefined>();
  const [isFeeSelectorExpanded, setIsFeeSelectorExpanded] = useState(false);
  const [customFeeRate, setCustomFeeRate] = useState<number | undefined>();
  const [isCreatingTransaction, setIsCreatingTransaction] = useState(false);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Fee estimates
  const [feeEstimates, setFeeEstimates] = useState<TFeeEstimate | undefined>();
  const [isLoadingFees, setIsLoadingFees] = useState(true);
  const [feeLoadingError, setFeeLoadingError] = useState<string | undefined>();

  // Determine if this is a token send or BTC send
  const isTokenSend = !!token;

  // Whether the amount is locked (set by decoded invoice)
  const isAmountLocked = !!rgbDecodedInvoice?.assignment?.amount;

  // Get the appropriate balance and decimals based on send type
  const balance = isTokenSend ? tokenBalance : btcBalance;
  const decimals = isTokenSend && tokenInfo ? tokenInfo.decimals : getDecimalsByNetwork(network);
  const ticker = isTokenSend && tokenInfo ? tokenInfo.symbol : getTickerByNetwork(network);

  const formattedBalance = formatBalance(balance || '0', decimals);

  // Load token info when token is selected
  useEffect(() => {
    if (!token) {
      setTokenInfo(null);
      return;
    }

    const loadTokenInfo = async () => {
      try {
        const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
        assert(wallet instanceof RGBWallet, 'Not an RGB wallet');
        const tokenBalances = wallet.getTokenBalances();
        const info = tokenBalances.find((t) => t.id === token);
        if (info) {
          setTokenInfo(info);
        }
      } catch (e) {
        console.error('Failed to load token info:', e);
      }
    };
    loadTokenInfo();
  }, [token, network, accountNumber]);

  // Pre-fill amount from decoded invoice (convert base units to display units)
  useEffect(() => {
    if (!isAmountLocked) return;
    const d = isTokenSend && tokenInfo ? tokenInfo.decimals : getDecimalsByNetwork(network);
    const displayAmount = new BigNumber(rgbDecodedInvoice!.assignment!.amount).dividedBy(new BigNumber(10).pow(d)).toString();
    setLocalAmount(displayAmount);
  }, [isAmountLocked, rgbDecodedInvoice, tokenInfo, isTokenSend, network]);

  // Load fee estimates
  useEffect(() => {
    const loadFees = async () => {
      setIsLoadingFees(true);
      setFeeLoadingError(undefined);
      try {
        const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
        assert(wallet instanceof RGBWallet, 'Not an RGB wallet');
        const fees = await wallet.getFeeEstimates();
        setFeeEstimates(fees);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Failed to load network fees';
        setFeeLoadingError(errorMessage);
      } finally {
        setIsLoadingFees(false);
      }
    };
    loadFees();
  }, [network, accountNumber]);

  const handleDenominationSwitch = () => {
    if (exchangeRate) {
      setDenomination(denomination === 'Native' ? 'Fiat' : 'Native');
    }
  };

  const buttonDisabled = useMemo(() => {
    return isLoadingFees || (feeLoadingError && !customFeeRate) || !localAmount || isCreatingTransaction;
  }, [isLoadingFees, feeLoadingError, customFeeRate, localAmount, isCreatingTransaction]);

  const [feeRate, feeIndex] = useMemo(() => {
    if (selectedFeeRate !== undefined) return [selectedFeeRate, selectedFeeIndex ?? FeeIndex.Medium];
    if (customFeeRate !== undefined) return [customFeeRate, FeeIndex.Slow];
    if (feeEstimates) return [feeEstimates.medium, FeeIndex.Medium];
    return [1, FeeIndex.Slow];
  }, [selectedFeeRate, customFeeRate, feeEstimates, selectedFeeIndex]);

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
    if (balance) {
      // For RGB, we need to account for fees, but we'll just use the full balance for now
      // The SDK will handle fee calculation
      const maxAmount = formatBalance(balance, decimals);
      setLocalAmount(maxAmount);
    }
  };

  const handleFeeSelection = (rate: number, index: FeeIndex) => {
    setSelectedFeeRate(rate);
    setSelectedFeeIndex(index);
    setIsFeeSelectorExpanded(false);
  };

  const toggleFeeSelector = () => {
    setIsFeeSelectorExpanded(!isFeeSelectorExpanded);
  };

  const validateAmount = () => {
    if (!localAmount || !balance) return { isValid: false, error: 'Please enter an amount' };
    if (localAmount.includes('.') && localAmount.split('.')[1]?.length > decimals) {
      return { isValid: false, error: `Maximum ${decimals} decimal place${decimals !== 1 ? 's' : ''} allowed` };
    }

    const amt = parseFloat(localAmount);
    if (isNaN(amt) || amt <= 0) return { isValid: false, error: 'Amount must be greater than 0' };

    const satValueBN = new BigNumber(amt);
    const satValue = satValueBN.multipliedBy(new BigNumber(10).pow(decimals)).toString(10);
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

    setValidationError(null);
    setTransactionError(null);
    setIsCreatingTransaction(true);

    await sleep(100);

    try {
      const amt = parseFloat(localAmount);
      const amountValueBN = new BigNumber(amt);
      const amountValue = amountValueBN.multipliedBy(new BigNumber(10).pow(decimals));

      // Get wallet
      const wallet = await BackgroundExecutor.lazyInitWallet(network as any, accountNumber);
      assert(wallet instanceof RGBWallet, 'Not an RGB wallet');

      let signedData: string;
      let amountInBaseUnits: number;

      if (isTokenSend && token) {
        // Token send - validate invoice first using decodeRgbInvoice
        if (!RGBWallet.isRgbInvoice(address)) {
          throw new Error('Token sends require a valid RGB invoice (rgb:...)');
        }

        // Validate the invoice by decoding it
        try {
          await wallet.decodeRgbInvoice(address);
        } catch (invoiceError: any) {
          throw new Error(`Invalid RGB invoice: ${invoiceError.message || 'Failed to decode invoice'}`);
        }

        amountInBaseUnits = amountValue.toNumber();

        const signedPsbt = await wallet.sendTokenPrepare(token, BigInt(amountValue.toFixed(0)), address, feeRate);
        signedData = signedPsbt;

        // Store signed PSBT and token info in context for confirm screen to broadcast
        setRgbPreparedTx({
          signedPsbt,
          feeRate,
          amount: amountInBaseUnits,
          tokenId: token,
          invoice: address,
        });

        setCreatedTransaction({
          txhex: signedPsbt,
          actualFee: feeRate * 200, // Approximate fee for RGB token tx
          feeRate: feeRate,
        });
      } else {
        // BTC send - validate taproot address
        if (!RGBWallet.isTaprootAddress(address)) {
          throw new Error('BTC sends require a taproot address (bc1p/tb1p)');
        }

        amountInBaseUnits = amountValue.toNumber();

        // Create and sign PSBT (but don't broadcast)
        const signedPsbt = await wallet.sendBtcPrepare(address, amountInBaseUnits, feeRate);
        signedData = signedPsbt;

        // Store signed PSBT in context
        setRgbPreparedTx({
          signedPsbt,
          feeRate,
          amount: amountInBaseUnits,
        });

        // Also set created transaction for the confirm screen
        setCreatedTransaction({
          txhex: signedPsbt,
          actualFee: feeRate * 150, // Approximate fee (150 vB typical for taproot tx)
          feeRate: feeRate,
        });
      }

      setContextAmount(localAmount);
      router.push('/send/send-confirm');
    } catch (error: any) {
      console.error('Failed to create transaction:', error);
      setTransactionError(error.message || 'Failed to create transaction');
    } finally {
      setIsCreatingTransaction(false);
    }
  };

  // Animation for fee selector
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
    const height = interpolate(expandAnimation.value, [0, 1], [0, feeEstimates ? 192 : 0], Extrapolation.CLAMP);
    const opacity = interpolate(expandAnimation.value, [0, 0.1, 1], [0, 0, 1], Extrapolation.CLAMP);
    return { height, opacity };
  });

  const animatedChevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${chevronRotation.value}deg` }] }));

  return (
    <RadialGradientScreen network={network} scroll={true}>
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
              exchangeRate={isTokenSend ? undefined : exchangeRate} // No fiat conversion for tokens
              denomination={denomination}
              decimals={decimals}
              onDenominationSwitch={isTokenSend ? undefined : handleDenominationSwitch} // No fiat switch for tokens
              onMaxPress={isAmountLocked ? undefined : handleMaxPress}
              onBalancePress={isAmountLocked ? undefined : handleMaxPress}
              disabled={isAmountLocked}
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

          {isLoadingFees && (
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

          {!isLoadingFees && !feeLoadingError && feeEstimates && (
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
                        {feeName} - {feeRate} sats/vB
                      </ThemedText>
                    </View>
                    <Animated.View style={animatedChevronStyle}>
                      <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.6)" />
                    </Animated.View>
                  </>
                )}
              </Pressable>

              <Animated.View style={[styles.feeOptionsContainer, animatedFeeOptionsStyle]}>
                {FeeOptions.map((option) => (
                  <Pressable
                    key={option.index}
                    style={[styles.feeOption, feeIndex === option.index && styles.selectedFeeOption]}
                    onPress={() => handleFeeSelection(feeEstimates[option.index], option.index)}
                  >
                    <View style={styles.feeOptionContent}>
                      <ThemedText style={styles.feeOptionName}>{option.name}</ThemedText>
                      <ThemedText style={styles.feeOptionRate}>{feeEstimates[option.key]} sats/vB</ThemedText>
                    </View>
                  </Pressable>
                ))}
              </Animated.View>
            </View>
          )}

          <Pressable style={[styles.continueButton, buttonDisabled && styles.disabledButton]} onPress={handleContinue} disabled={buttonDisabled}>
            {isCreatingTransaction ? (
              <>
                <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.8)" />
                <ThemedText style={styles.continueButtonText}>Signing...</ThemedText>
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

export default SendAmountRgb;
