import { Ionicons } from '@expo/vector-icons';
import BigNumber from 'bignumber.js';
import { useRouter } from 'expo-router';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedLayerBackground } from '@/components/AnimatedLayerBackground';
import Button from '@/components/Button';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import { ThemedText } from '@/components/ThemedText';
import TransferList from '@/components/transfer/TransferList';
import TransferAmountSection from '@/components/transfer/TransferAmountSection';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { getNetworkPrimaryColorDarkened } from '@shared/constants/Colors';
import { sleep } from '@shared/modules/sleep';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { useAssetBalance } from '@shared/hooks/useAssetBalance';
import { useAssetExchangeRate } from '@shared/hooks/useAssetExchangeRate';
import { AllNetworkInfos } from '@shared/models/all-network-infos';
import { getAssetInfo } from '@shared/models/asset-info';
import { Denomination, TransferExecution, TransferNoRouteError, TransferPairInfo } from '@shared/types/transfer';
import { useTransferFlow } from '@/src/transfer/TransferFlowContext';

export default function TransferInput() {
  const router = useRouter();
  const { sendAsset, receiveAsset, quote, committed, setQuote, setCommitted, setPreparedExecution, transferService } = useTransferFlow();
  const { accountNumber } = useContext(AccountNumberContext);
  const { balance: sendBalance } = useAssetBalance(sendAsset, accountNumber, BackgroundExecutor);
  const [sendAmount, setSendAmount] = useState<string>('');
  const [receiveAmount, setReceiveAmount] = useState<string>('');
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [denomination, setDenomination] = useState<Denomination>('Native');
  const { exchangeRate: sendRate } = useAssetExchangeRate(sendAsset);
  const { exchangeRate: receiveRate } = useAssetExchangeRate(receiveAsset);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [quoteError, setQuoteError] = useState('');
  const [serviceWarnings, setServiceWarnings] = useState<{ service: string; message: string }[]>([]);
  const [pairInfo, setPairInfo] = useState<TransferPairInfo | undefined>();
  const [isContinuing, setIsContinuing] = useState(false);
  const isContinuingRef = useRef(false);

  const sendNetwork = useMemo(() => {
    if (!sendAsset) return 'base';
    try {
      return getAssetInfo(sendAsset).network;
    } catch {
      return 'base';
    }
  }, [sendAsset]);

  const handleSendAssetPress = () => {
    router.push({ pathname: '/modals/transfer-select-asset', params: { side: 'send' } });
  };

  const handleReceiveAssetPress = () => {
    router.push({ pathname: '/modals/transfer-select-asset', params: { side: 'receive' } });
  };

  const fetchQuoteFromSend = useCallback(
    async (amount: string) => {
      if (!sendAsset || !receiveAsset || !amount || parseFloat(amount) <= 0) {
        setReceiveAmount('');
        setQuote(undefined);
        setIsQuoteLoading(false);
        setQuoteError('');
        return;
      }

      setIsQuoteLoading(true);
      setQuoteError('');
      setServiceWarnings([]);
      setPreparedExecution(undefined);
      try {
        const newQuote = await transferService.getQuote(sendAsset, receiveAsset, amount);
        setQuote(newQuote);
        setReceiveAmount(newQuote.receiveAmount);
        setQuoteError('');
        setServiceWarnings(newQuote.serviceErrors || []);
      } catch (e: any) {
        setReceiveAmount('');
        setQuote(undefined);
        if (e instanceof TransferNoRouteError && e.serviceErrors.length > 0) {
          setQuoteError(e.serviceErrors.map((se: { service: string; message: string }) => `${se.service}: ${se.message}`).join('\n'));
        } else {
          setQuoteError(e.message || 'Quote failed');
        }
      } finally {
        setIsQuoteLoading(false);
      }
    },
    [sendAsset, receiveAsset, transferService, setReceiveAmount, setQuote, setIsQuoteLoading, setPreparedExecution]
  );

  const fetchQuoteFromReceive = useCallback(
    async (amount: string) => {
      if (!sendAsset || !receiveAsset || !pairInfo || !amount || parseFloat(amount) <= 0) {
        setSendAmount('');
        setQuote(undefined);
        setIsQuoteLoading(false);
        setQuoteError('');
        return;
      }

      setIsQuoteLoading(true);
      setQuoteError('');
      setServiceWarnings([]);
      setPreparedExecution(undefined);
      try {
        const rate = new BigNumber(pairInfo.rate);
        const estimatedSend = new BigNumber(amount).div(rate);
        const newQuote = await transferService.getQuote(sendAsset, receiveAsset, estimatedSend.toFixed(8));
        setQuote(newQuote);
        setSendAmount(new BigNumber(newQuote.sendAmount).toFixed());
        setReceiveAmount(new BigNumber(newQuote.receiveAmount).toFixed());
        setQuoteError('');
        setServiceWarnings(newQuote.serviceErrors || []);
      } catch (e: any) {
        setSendAmount('');
        setQuote(undefined);
        if (e instanceof TransferNoRouteError && e.serviceErrors.length > 0) {
          setQuoteError(e.serviceErrors.map((se: { service: string; message: string }) => `${se.service}: ${se.message}`).join('\n'));
        } else {
          setQuoteError(e.message || 'Quote failed');
        }
      } finally {
        setIsQuoteLoading(false);
      }
    },
    [sendAsset, receiveAsset, transferService, pairInfo, setSendAmount, setQuote, setIsQuoteLoading, setPreparedExecution]
  );

  const debouncedFetch = useCallback(
    (amount: string, side: 'send' | 'receive') => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        if (side === 'send') {
          fetchQuoteFromSend(amount);
        } else {
          fetchQuoteFromReceive(amount);
        }
      }, 500);
    },
    [fetchQuoteFromSend, fetchQuoteFromReceive]
  );

  const handleSendAmountChange = (text: string) => {
    setSendAmount(text);
    debouncedFetch(text, 'send');
  };

  const handleReceiveAmountChange = (text: string) => {
    setReceiveAmount(text);
    debouncedFetch(text, 'receive');
  };

  // Fetch pair info (min/max) and refetch quote when assets change
  useEffect(() => {
    if (sendAsset && receiveAsset) {
      setQuote(undefined);
      setPairInfo(undefined);

      // Fetch pair info for min/max validation
      transferService
        .getPairInfo?.(sendAsset, receiveAsset)
        .then(setPairInfo)
        .catch(() => setPairInfo(undefined));

      if (sendAmount && parseFloat(sendAmount) > 0) {
        fetchQuoteFromSend(sendAmount);
      } else if (receiveAmount && parseFloat(receiveAmount) > 0) {
        fetchQuoteFromReceive(receiveAmount);
      }
    }
  }, [sendAsset, receiveAsset]); // eslint-disable-line react-hooks/exhaustive-deps

  // Retry receive quote when pairInfo arrives (fetchQuoteFromReceive requires pairInfo)
  useEffect(() => {
    if (pairInfo && !quote && !isQuoteLoading && !quoteError && sendAsset && receiveAsset && receiveAmount && parseFloat(receiveAmount) > 0 && !sendAmount) {
      fetchQuoteFromReceive(receiveAmount);
    }
  }, [pairInfo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear input state after a successful transfer so the user can't accidentally re-submit
  useEffect(() => {
    if (committed) {
      setSendAmount('');
      setReceiveAmount('');
      setCommitted(false);
    }
  }, [committed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refetch quote when returning from confirm (quote cleared on confirm unmount)
  useEffect(() => {
    if (!quote) {
      setIsContinuing(false);
      isContinuingRef.current = false;
    }
    if (!committed && !quote && !isQuoteLoading && !quoteError && sendAsset && receiveAsset && sendAmount && parseFloat(sendAmount) > 0) {
      fetchQuoteFromSend(sendAmount);
    }
  }, [quote]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const limitsError = useMemo(() => {
    if (!pairInfo || !sendAmount || !sendAsset) return '';
    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) return '';
    const min = parseFloat(pairInfo.min);
    const max = parseFloat(pairInfo.max);
    const { ticker } = getAssetInfo(sendAsset);
    if (amount < min) return `Minimum ${pairInfo.min} ${ticker}`;
    if (amount > max) return `Maximum ${pairInfo.max} ${ticker}`;
    return '';
  }, [pairInfo, sendAmount, sendAsset]);

  const balanceError = useMemo(() => {
    if (!sendAsset || !sendAmount || !sendBalance) return '';
    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) return '';
    // `native:lightning` is a meta source asset — the actual funds live across
    // individual LN-capable wallets (Breez/Spark/Ark) and the confirm screen picks
    // which one pays. There is no unified balance to check here.
    if (sendAsset === 'native:lightning') return '';
    const info = getAssetInfo(sendAsset);
    if (AllNetworkInfos[info.network]?.isTestnet) return '';
    const amountSmallest = new BigNumber(sendAmount).times(new BigNumber(10).pow(info.decimals));
    if (amountSmallest.gt(new BigNumber(sendBalance))) {
      return `Insufficient ${info.ticker} balance`;
    }
    return '';
  }, [sendAsset, sendAmount, sendBalance]);

  const canContinue = !!sendAsset && !!receiveAsset && !!quote && parseFloat(sendAmount) > 0 && !isQuoteLoading && !limitsError && !balanceError;

  const handleContinue = async () => {
    if (!canContinue || isContinuingRef.current) return;
    isContinuingRef.current = true;
    setIsContinuing(true);
    await sleep(10);
    router.push('/modals/transfer-confirm');
  };

  const handleTransferPress = (execution: TransferExecution) => {
    router.push({ pathname: '/TransferDetails', params: { execution: JSON.stringify(execution) } });
  };

  const handleDenominationSwitch = () => {
    setDenomination(denomination === 'Native' ? 'Fiat' : 'Native');
  };

  const handleErrorLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Clipboard.setStringAsync(limitsError || balanceError || quoteError);
  };

  return (
    <View style={styles.backgroundContainer}>
      <AnimatedLayerBackground network={sendNetwork} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
          <ScreenHeader title="Transfer" testID="TransferScreenTitle" style={styles.screenHeader} showBackButton={false} />
          <View style={styles.container}>
            {/* Send Section */}
            <TransferAmountSection
              label="Send"
              type="send"
              amount={sendAmount}
              onAmountChange={handleSendAmountChange}
              asset={sendAsset}
              onAssetPress={handleSendAssetPress}
              denomination={denomination}
              exchangeRate={sendRate}
              onDenominationSwitch={handleDenominationSwitch}
              editable={true}
              testID="TransferSend"
            />

            {/* Arrow Divider */}
            <View style={styles.arrowContainer}>
              <View style={[styles.arrowCircle, { backgroundColor: getNetworkPrimaryColorDarkened(sendNetwork) }]}>
                <Ionicons name="arrow-down" size={18} color="rgba(255, 255, 255, 0.6)" />
              </View>
            </View>

            {/* Receive Section */}
            <TransferAmountSection
              label="Receive"
              type="receive"
              amount={receiveAmount}
              onAmountChange={handleReceiveAmountChange}
              asset={receiveAsset}
              onAssetPress={handleReceiveAssetPress}
              denomination={denomination}
              exchangeRate={receiveRate}
              onDenominationSwitch={handleDenominationSwitch}
              editable={true}
              testID="TransferReceive"
            />

            {/* Quote Loading Indicator */}
            {isQuoteLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.6)" />
                <ThemedText style={styles.loadingText}>Fetching quote...</ThemedText>
              </View>
            )}

            {/* Limits / Balance / Quote Error */}
            {!isQuoteLoading && (limitsError || balanceError || quoteError) ? (
              <Pressable style={({ pressed }) => [styles.errorContainer, pressed && { opacity: 0.5 }]} onLongPress={handleErrorLongPress}>
                <ThemedText testID="TransferQuoteError" style={styles.errorText}>
                  {limitsError || balanceError || quoteError}
                </ThemedText>
              </Pressable>
            ) : null}

            {/* Service Warnings (partial failures — quote still valid) */}
            {!isQuoteLoading && serviceWarnings.length > 0 && !quoteError && (
              <View style={styles.errorContainer}>
                {serviceWarnings.map((w) => (
                  <ThemedText key={w.service} style={styles.warningText}>
                    {w.service}: {w.message}
                  </ThemedText>
                ))}
              </View>
            )}

            {/* Continue Button */}
            <View style={styles.buttonContainer}>
              <Button testID="TransferContinueButton" title="Continue" onPress={handleContinue} style={[styles.continueButton, !canContinue && styles.disabledButton]} disabled={!canContinue} />
            </View>

            {/* Ongoing Transfers */}
            <View style={styles.ongoingContainer}>
              <TransferList transferService={transferService} onTransferPress={handleTransferPress} activeOnly title="Ongoing" />
            </View>
          </View>
        </SafeAreaView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  backgroundContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    marginHorizontal: 20,
  },
  screenHeader: {
    marginBottom: 8,
  },
  arrowContainer: {
    alignItems: 'center',
    marginVertical: 3,
  },
  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -16,
    marginBottom: -16,
    zIndex: 1, // should be above inputs
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  errorContainer: {
    marginTop: 16,
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: 13,
    color: '#FF9500',
    fontWeight: '400',
  },
  warningText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '400',
  },
  ongoingContainer: {
    marginTop: 32,
  },
  buttonContainer: {
    marginTop: 32,
  },
  continueButton: {
    height: 56,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  disabledButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    opacity: 0.6,
  },
});
