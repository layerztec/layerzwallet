import { Ionicons } from '@expo/vector-icons';
import BigNumber from 'bignumber.js';
import { useRouter } from 'expo-router';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable as RNPressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import TransferAssetIcon from '@/components/transfer/TransferAssetIcon';
import { BackgroundExecutor, getOnchainDepositAddress } from '@/src/modules/background-executor';
import { EvmWallet } from '@shared/class/evm-wallet';
import { InterfaceSendQuotable, walletCanSendQuote } from '@shared/class/wallets/interface-send-quotable';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { useAssetExchangeRate } from '@shared/hooks/useAssetExchangeRate';
import { AllNetworkInfos } from '@shared/models/all-network-infos';
import { getAssetInfo } from '@shared/models/asset-info';
import { sleep } from '@shared/modules/sleep';
import { TSupportedLazyInitWalletNetworks } from '@shared/modules/wallet-utils';
import type { AssetId } from '@shared/types/asset';
import type { SendQuote } from '@shared/types/send-quote';
import { EXECUTION_CLAIM, EXECUTION_INSTANT, type TransferExecution } from '@shared/types/transfer';
import { NETWORK_SPARK } from '@shared/types/networks';
import { useTransferFlow } from '@/src/transfer/TransferFlowContext';

const DISMISS_THRESHOLD = 150;
const CLAIM_OPTIONS_HEIGHT = 40 * 2; // 2 option rows

export default function TransferConfirm() {
  const router = useRouter();
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { sendAsset, receiveAsset, quote, setQuote, setCommitted, preparedExecution, setPreparedExecution, transferService } = useTransferFlow();
  const { accountNumber } = useContext(AccountNumberContext);
  const { exchangeRate: sendRate } = useAssetExchangeRate(sendAsset);
  const { exchangeRate: receiveRate } = useAssetExchangeRate(receiveAsset);

  const [isPreparing, setIsPreparing] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [sendQuote, setSendQuote] = useState<SendQuote | undefined>();
  const [error, setError] = useState('');
  const [claimMode, setClaimMode] = useState<'auto' | 'manual'>('auto');
  const [claimExpanded, setClaimExpanded] = useState(false);
  const claimAnim = useSharedValue(0);
  const [expirySeconds, setExpirySeconds] = useState(() => (quote ? Math.max(0, quote.expiresAt - Math.floor(Date.now() / 1000)) : 0));
  const expiryInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const quotableWalletRef = useRef<InterfaceSendQuotable | undefined>(undefined);
  const executionRef = useRef<TransferExecution | undefined>(undefined);
  const isConfirmingRef = useRef(false);
  const isFakeProvider = quote?.serviceName === 'Fake';
  const isNativeDeposit = quote?.serviceName === 'Native';
  const isSparkDeposit = isNativeDeposit && receiveAsset ? getAssetInfo(receiveAsset).network === NETWORK_SPARK : false;

  useEffect(() => {
    if (!quote) return;
    expiryInterval.current = setInterval(() => {
      const remaining = Math.max(0, quote.expiresAt - Math.floor(Date.now() / 1000));
      setExpirySeconds(remaining);
      if (remaining === 0 && expiryInterval.current) clearInterval(expiryInterval.current);
    }, 1000);
    return () => {
      if (expiryInterval.current) clearInterval(expiryInterval.current);
    };
  }, [quote]);

  const translateY = useSharedValue(screenHeight);

  useEffect(() => {
    translateY.value = withTiming(0, { duration: 300 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear quote on unmount so going back to index doesn't reuse a consumed quote
  useEffect(() => {
    return () => {
      setQuote(undefined);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getQuotableWallet = async (assetId: AssetId): Promise<InterfaceSendQuotable | undefined> => {
    const assetInfo = getAssetInfo(assetId);
    const networkInfo = AllNetworkInfos[assetInfo.network];

    if (networkInfo.isEVM) {
      const e = new EvmWallet();
      e.network = assetInfo.network;
      return e;
    }

    const wallet = await BackgroundExecutor.lazyInitWallet(assetInfo.network as TSupportedLazyInitWalletNetworks, accountNumber);
    return walletCanSendQuote(wallet) ? wallet : undefined;
  };

  // On mount: create shift + get send quote so everything is ready for one-tap confirm
  useEffect(() => {
    let cancelled = false;

    const prepare = async () => {
      if (!quote || !sendAsset || !receiveAsset) return;

      const sendAssetInfo = getAssetInfo(sendAsset);
      const receiveAssetInfo = getAssetInfo(receiveAsset);

      try {
        const fromAddress = isFakeProvider ? 'fake-address' : await BackgroundExecutor.getAddress(sendAssetInfo.network, accountNumber);

        if (preparedExecution) {
          // Reuse previously prepared execution to avoid duplicate shifts/orders
          executionRef.current = preparedExecution;
        } else {
          const settleAddress = isFakeProvider
            ? 'fake-address'
            : isNativeDeposit
              ? await getOnchainDepositAddress(receiveAssetInfo.network, accountNumber)
              : await BackgroundExecutor.getAddress(receiveAssetInfo.network, accountNumber);
          const execution = await transferService.executeTransfer(quote, accountNumber, settleAddress, fromAddress);
          if (cancelled) return;
          executionRef.current = execution;
          setPreparedExecution(execution);
        }

        const execution = executionRef.current!;

        // Fake provider or no deposit address: skip send quote
        if (isFakeProvider || !execution.depositAddress) {
          setIsPreparing(false);
          return;
        }

        const wallet = await getQuotableWallet(sendAsset);
        if (cancelled) return;
        if (!wallet) {
          setError('Automated sending not supported for this network yet');
          setIsPreparing(false);
          return;
        }
        quotableWalletRef.current = wallet;
        const amountSmallest = new BigNumber(quote.sendAmount).multipliedBy(new BigNumber(10).pow(sendAssetInfo.decimals)).toFixed(0);

        const sq = await wallet.getSendQuote({
          toAddress: execution.depositAddress,
          amount: amountSmallest,
          fromAddress,
          tokenId: sendAssetInfo.tokenId,
        });
        if (cancelled) return;
        setSendQuote(sq);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to prepare transfer');
      } finally {
        if (!cancelled) setIsPreparing(false);
      }
    };

    prepare();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Single confirm: commit + broadcast
  const handleConfirm = async () => {
    if (isConfirmingRef.current) return;
    isConfirmingRef.current = true;
    setIsConfirming(true);
    setError('');
    await sleep(10);

    try {
      if (isExpired) throw new Error('Quote has expired. Please go back and get a new quote.');
      const execution = executionRef.current;
      if (!execution) throw new Error('Transfer not ready. Please go back and try again.');

      if (execution.type === EXECUTION_CLAIM) {
        execution.autoClaim = !isSparkDeposit || claimMode === 'auto';
      }

      // Fake provider: commit and go straight to success
      if (isFakeProvider) {
        await transferService.commitTransfer(execution);
        setPreparedExecution(undefined);
        setCommitted(true);
        router.replace('/modals/transfer-success');
        return;
      }

      // Instant swap (e.g. Flashnet): execute the actual swap now, then commit
      if (execution.type === EXECUTION_INSTANT) {
        const completed = await transferService.executeInstantSwap(execution.id);
        executionRef.current = completed;
        await transferService.commitTransfer(completed);
        setPreparedExecution(undefined);
        setCommitted(true);
        router.replace('/modals/transfer-success');
        return;
      }

      if (!sendQuote) throw new Error('Send quote not available. Please go back and try again.');

      await transferService.commitTransfer(execution);

      const wallet = quotableWalletRef.current;
      if (!wallet) throw new Error('Wallet does not support send quote');
      const mnemonic = await BackgroundExecutor.getMasterSeed();
      const txid = await wallet.executeSendQuote(sendQuote, mnemonic, accountNumber);

      // Update with deposit txid after successful send
      execution.depositTxid = txid;
      await transferService.commitTransfer(execution);

      setPreparedExecution(undefined);
      setCommitted(true);
      router.replace('/modals/transfer-success');
    } catch (e: any) {
      // If send was already broadcast, update transfer with txid
      const execution = executionRef.current;
      if (execution?.depositTxid) {
        await transferService.commitTransfer(execution);
      }
      // Clear prepared execution on failure so re-attempt starts fresh
      setPreparedExecution(undefined);
      setError(e.message || 'Failed to send funds');
    } finally {
      isConfirmingRef.current = false;
      setIsConfirming(false);
    }
  };

  const handleDismiss = useCallback(() => {
    router.back();
  }, [router]);

  const animateDismiss = useCallback(() => {
    translateY.value = withTiming(screenHeight, { duration: 250 }, () => {
      runOnJS(handleDismiss)();
    });
  }, [translateY, screenHeight, handleDismiss]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > DISMISS_THRESHOLD || event.velocityY > 1000) {
        runOnJS(animateDismiss)();
      } else {
        translateY.value = withTiming(0, { duration: 200 });
      }
    });

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - translateY.value / (screenHeight * 0.75),
  }));

  const toggleClaim = () => {
    const next = !claimExpanded;
    setClaimExpanded(next);
    claimAnim.value = withTiming(next ? 1 : 0, { duration: 250 });
  };

  const selectClaim = (mode: 'auto' | 'manual') => {
    setClaimMode(mode);
    setClaimExpanded(false);
    claimAnim.value = withTiming(0, { duration: 250 });
  };

  const claimOptionsStyle = useAnimatedStyle(() => ({
    height: interpolate(claimAnim.value, [0, 1], [0, CLAIM_OPTIONS_HEIGHT]),
    opacity: interpolate(claimAnim.value, [0, 0.5, 1], [0, 0, 1]),
    overflow: 'hidden' as const,
  }));

  const formatTime = (seconds: number) => {
    if (seconds >= 3600) return `~${Math.round(seconds / 3600)}h`;
    if (seconds >= 60) return `~${Math.round(seconds / 60)}m`;
    return `${seconds}s`;
  };

  const formatExpiry = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const sendAmount = quote?.sendAmount ?? '';
  const receiveAmount = quote?.receiveAmount ?? '';
  const sendFiat = sendRate && sendAmount ? `$${new BigNumber(sendAmount).multipliedBy(sendRate).toFixed(2)}` : '';
  const receiveFiat = receiveRate && receiveAmount ? `$${new BigNumber(receiveAmount).multipliedBy(receiveRate).toFixed(2)}` : '';

  const isExpired = !isNativeDeposit && expirySeconds <= 0;
  const isReady = !isPreparing && !error && !isExpired;

  if (!sendAsset || !receiveAsset || !quote) {
    router.back();
    return null;
  }

  const sendAssetInfo = getAssetInfo(sendAsset);
  const receiveAssetInfo = getAssetInfo(receiveAsset);
  const feeDisplay = sendQuote
    ? `${new BigNumber(sendQuote.fee).dividedBy(new BigNumber(10).pow(AllNetworkInfos[sendAssetInfo.network].decimals)).toFixed()} ${sendQuote.feeTicker}`
    : quote.feeTicker
      ? `${quote.fee} ${quote.feeTicker}`
      : quote.fee;

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <Animated.View style={[styles.overlay, overlayAnimatedStyle]}>
        <RNPressable style={styles.overlayTouchable} onPress={handleDismiss} testID="ConfirmOverlay" />
      </Animated.View>
      <View style={styles.cardWrapper} pointerEvents="box-none">
        <View style={styles.cardSpacer} pointerEvents="none" />
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.card, cardAnimatedStyle]}>
            <View style={styles.grabber} />

            {isPreparing ? (
              <View style={[styles.preparingContainer, { paddingBottom: 60 + insets.bottom }]}>
                <ActivityIndicator size="large" color="rgba(255, 255, 255, 0.8)" />
                <ThemedText style={styles.preparingText}>Preparing transfer...</ThemedText>
              </View>
            ) : (
              <>
                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
                  <View style={styles.container}>
                    {/* Send Amount Block */}
                    <View style={[styles.amountBlock, styles.sendBlock]} testID="ConfirmSendBlock">
                      <View style={styles.amountTextContainer}>
                        <ThemedText style={styles.amountValue}>
                          {sendAmount} {sendAssetInfo.ticker}
                        </ThemedText>
                        <ThemedText style={styles.amountFiat}>{sendFiat || '$0.00'}</ThemedText>
                      </View>
                      <TransferAssetIcon asset={sendAsset} size={44} />
                    </View>

                    {/* Arrow Divider */}
                    <View style={styles.arrowContainer}>
                      <View style={styles.arrowCircle}>
                        <Ionicons name="arrow-down" size={18} color="rgba(255, 255, 255, 0.6)" />
                      </View>
                    </View>

                    {/* Receive Amount Block */}
                    <View style={[styles.amountBlock, styles.receiveBlock]} testID="ConfirmReceiveBlock">
                      <View style={styles.amountTextContainer}>
                        <ThemedText style={styles.amountValue}>
                          {receiveAmount} {receiveAssetInfo.ticker}
                        </ThemedText>
                        <ThemedText style={styles.amountFiat}>{receiveFiat || '$0.00'}</ThemedText>
                      </View>
                      <TransferAssetIcon asset={receiveAsset} size={44} />
                    </View>

                    {/* Details */}
                    <View style={styles.detailsContainer}>
                      <View style={[styles.detailRow, styles.detailRowFirst]} testID="ConfirmRate">
                        <ThemedText style={styles.detailLabel}>Rate</ThemedText>
                        <View style={styles.detailValueRow}>
                          <ThemedText style={styles.detailValue}>{quote.rate}</ThemedText>
                          <Ionicons name="chevron-forward" size={10} color="rgba(255, 255, 255, 0.4)" />
                        </View>
                      </View>

                      <View style={styles.detailRow} testID="ConfirmFee">
                        <ThemedText style={styles.detailLabel}>Fees</ThemedText>
                        <View style={styles.detailValueRow}>
                          <ThemedText style={styles.detailValue}>{feeDisplay}</ThemedText>
                          <Ionicons name="chevron-forward" size={10} color="rgba(255, 255, 255, 0.4)" />
                        </View>
                      </View>

                      <View style={styles.detailRow} testID="ConfirmEstTime">
                        <ThemedText style={styles.detailLabel}>Est. time</ThemedText>
                        <ThemedText style={styles.detailValue}>{formatTime(quote.estimatedTime)}</ThemedText>
                      </View>

                      {!isNativeDeposit && (
                        <View style={styles.detailRow} testID="ConfirmExpiry">
                          <ThemedText style={styles.detailLabel}>Quote expires</ThemedText>
                          <ThemedText style={[styles.detailValue, expirySeconds <= 30 && styles.expiryWarning]}>{expirySeconds > 0 ? formatExpiry(expirySeconds) : 'expired'}</ThemedText>
                        </View>
                      )}

                      {quote.serviceName && (
                        <View style={styles.detailRow} testID="ConfirmProvider">
                          <ThemedText style={styles.detailLabel}>Provider</ThemedText>
                          <ThemedText style={styles.detailValue}>{quote.serviceName}</ThemedText>
                        </View>
                      )}

                      {isSparkDeposit && (
                        <View style={styles.claimContainer}>
                          <RNPressable style={[styles.detailRow, claimExpanded && styles.claimOptionRow, !claimExpanded && styles.detailRowLast]} onPress={toggleClaim} testID="ConfirmClaim">
                            <ThemedText style={styles.detailLabel}>Claim</ThemedText>
                            <View style={styles.detailValueRow}>
                              <ThemedText style={styles.detailValue}>{claimMode}</ThemedText>
                              <Ionicons name={claimExpanded ? 'chevron-down' : 'chevron-forward'} size={10} color="rgba(255, 255, 255, 0.4)" />
                            </View>
                          </RNPressable>
                          <Animated.View style={claimOptionsStyle}>
                            <RNPressable style={[styles.detailRow, styles.claimOptionRow]} onPress={() => selectClaim('auto')} testID="ConfirmClaimAuto">
                              <ThemedText style={styles.claimOptionText}>auto</ThemedText>
                              {claimMode === 'auto' && <Ionicons name="checkmark" size={16} color="rgba(255, 255, 255, 0.9)" />}
                            </RNPressable>
                            <RNPressable style={[styles.detailRow, styles.claimOptionRow, styles.detailRowLast]} onPress={() => selectClaim('manual')} testID="ConfirmClaimManual">
                              <ThemedText style={styles.claimOptionText}>manual</ThemedText>
                              {claimMode === 'manual' && <Ionicons name="checkmark" size={16} color="rgba(255, 255, 255, 0.9)" />}
                            </RNPressable>
                          </Animated.View>
                        </View>
                      )}
                    </View>

                    {/* Error */}
                    {error ? (
                      <View style={styles.errorContainer} testID="ConfirmError">
                        <ThemedText style={styles.errorText}>{error}</ThemedText>
                      </View>
                    ) : null}
                  </View>
                </ScrollView>

                {/* Confirm Button */}
                <View style={[styles.buttonContainer, { paddingBottom: 40 + insets.bottom }]}>
                  {isConfirming ? (
                    <View style={styles.loadingContainer} testID="ConfirmLoading">
                      <ActivityIndicator size="large" color="rgba(255, 255, 255, 0.8)" />
                    </View>
                  ) : (
                    <Button testID="TransferConfirmButton" title="Confirm" onPress={handleConfirm} disabled={!isReady} style={styles.confirmButton} />
                  )}
                </View>
              </>
            )}
          </Animated.View>
        </GestureDetector>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  overlayTouchable: {
    flex: 1,
  },
  cardWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  cardSpacer: {
    flex: 1,
  },
  card: {
    backgroundColor: 'rgba(50, 50, 50, 0.95)',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  grabber: {
    width: 46,
    height: 5,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  preparingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  preparingText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  scrollView: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  container: {
    marginHorizontal: 20,
  },
  amountBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  sendBlock: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  receiveBlock: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  amountTextContainer: {
    flex: 1,
  },
  amountValue: {
    fontSize: 22,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  amountFiat: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 4,
  },
  arrowContainer: {
    alignItems: 'center',
    marginVertical: 1,
  },
  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(50, 50, 50, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -16,
    marginBottom: -16,
    zIndex: 1,
  },
  detailsContainer: {
    borderRadius: 16,
    marginTop: 24,
    gap: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  detailRowFirst: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  detailRowLast: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  claimContainer: {
    gap: 0,
  },
  claimOptionRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'Inter',
    color: 'rgba(255, 255, 255, 1)',
    letterSpacing: -0.26,
  },
  detailValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'Inter',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: -0.26,
  },
  claimOptionText: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'Inter',
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: -0.26,
  },
  expiryWarning: {
    color: '#FF9500',
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    textAlign: 'center',
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  confirmButton: {
    height: 56,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
});
