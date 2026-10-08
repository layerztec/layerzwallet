import { Ionicons } from '@expo/vector-icons';
import assert from 'assert';
import BigNumber from 'bignumber.js';
import { Redirect, Stack, useRouter } from 'expo-router';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Alignment, Fit, RiveView, useRiveFile } from '@rive-app/react-native';
import Pressable from '../../components/Pressable';
import successRiv from '../../assets/animations/success.riv';

import RadialGradientScreen from '@/components/RadialGradientScreen';
import ScreenSendHeader from '@/components/navigation/ScreenSendHeader';
import { ThemedText } from '@/components/ThemedText';
import { SendAssetProps, withAsset } from '@/hooks/withAsset';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { walletCanHaveTokens } from '@/src/shared-link/class/wallets/interface-can-have-tokens';
import * as BlueElectrum from '@shared/blue_modules/BlueElectrum';
import { EvmWallet } from '@shared/class/evm-wallet';
import { ArkWallet } from '@shared/class/wallets/ark-wallet';
import { BreezWallet } from '@shared/class/wallets/breez-wallet';
import { RgbWallet } from '@shared/class/wallets/rgb-wallet';
import { SparkWallet } from '@shared/class/wallets/spark-wallet';
import { StacksWallet } from '@shared/class/wallets/stacks-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useCachedExchangeRate } from '@shared/hooks/useCachedExchangeRate';
import { getDecimalsByNetwork, getIsAccountBased, getIsEVM, getTickerByNetwork } from '@shared/models/network-getters';
import { formatBalance } from '@shared/modules/string-utils';
import {
  NETWORK_ARK,
  NETWORK_ARK_MUTINYNET,
  NETWORK_BITCOIN,
  NETWORK_LIQUID,
  NETWORK_LIQUID_TESTNET,
  NETWORK_RGB,
  NETWORK_RGB_TESTNET,
  NETWORK_SPARK,
  NETWORK_STACKS,
  NETWORK_USDT,
} from '@shared/types/networks';
import { useSendFlow } from './_layout';

const SuccessRiveAnimation = () => {
  const { riveFile } = useRiveFile(successRiv);
  if (!riveFile) return <View style={styles.riveAnimation} />;
  return <RiveView autoPlay={true} alignment={Alignment.Center} fit={Fit.Contain} file={riveFile} onError={(error) => console.log('Rive error:', error.message)} style={styles.riveAnimation} />;
};

const SendConfirm: React.FC<SendAssetProps> = ({ ticker, token }) => {
  const router = useRouter();
  const { network: contextNetwork } = useContext(NetworkContext);
  const { network, address, amount, createdTransaction, memo, liquidPrepareResult } = useSendFlow();
  const { accountNumber } = useContext(AccountNumberContext);
  const { exchangeRate } = useCachedExchangeRate(network, 'USD');

  const displayNetwork = contextNetwork === NETWORK_USDT ? contextNetwork : network;

  const [error, setError] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  // RGB only: the tx IS broadcast but the critical VSS backup failed.
  // Restoring from the stale backup would permanently lose this send's
  // change allocation (see tasks/rgb-test-plan.md X10), so this state keeps
  // the txid visible and funnels the user into retrying the backup —
  // never back into the confirm button.
  const [sentNotBackedUp, setSentNotBackedUp] = useState<{ txid: string } | null>(null);
  const [isRetryingBackup, setIsRetryingBackup] = useState(false);
  // RGB only: before enabling Send, run a REAL backup as a liveness probe of
  // the VSS server (a plain ping lies — the server can answer while
  // putObjects 500s, seen live 2026-09-09). Side benefit: a fresh backup
  // right before the send shrinks the worst-case loss window to just this
  // send's change. 'checking' keeps the Send button disabled; a failure or
  // timeout re-enables it behind an explicit warning.
  const [vssProbe, setVssProbe] = useState<'checking' | 'ok' | 'failed' | null>(null);

  useEffect(() => {
    if (network !== NETWORK_RGB && network !== NETWORK_RGB_TESTNET) return;
    let cancelled = false;
    setVssProbe('checking');
    (async () => {
      try {
        const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
        if (!(wallet instanceof RgbWallet)) return cancelled || setVssProbe('ok');
        const ok = await Promise.race([wallet.retryBackup(), new Promise<false>((r) => setTimeout(() => r(false), 15_000))]);
        if (!cancelled) setVssProbe(ok ? 'ok' : 'failed');
      } catch {
        if (!cancelled) setVssProbe('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network, accountNumber]);
  const [showRiveAnimation, setShowRiveAnimation] = useState(false);
  const [hideHeader, setHideHeader] = useState(false);

  // Animation values
  const detailsOpacity = useSharedValue(1);
  const sendToOpacity = useSharedValue(1);
  const totalTop = useSharedValue(32); // Initial top position for total section

  // Animated styles
  const detailsAnimatedStyle = useAnimatedStyle(() => ({ opacity: detailsOpacity.value }));
  const sendToAnimatedStyle = useAnimatedStyle(() => ({ opacity: sendToOpacity.value }));
  const totalAnimatedStyle = useAnimatedStyle(() => ({ top: totalTop.value }));

  // Animate sections when success - sequential animations
  useEffect(() => {
    let timeout1: ReturnType<typeof setTimeout>;
    let timeout2: ReturnType<typeof setTimeout>;

    if (isSuccess) {
      // Step 1: Animate details and send to sections out using only opacity (600ms)
      detailsOpacity.value = withTiming(0, { duration: 600 });
      sendToOpacity.value = withTiming(0, { duration: 600 });

      // Step 2: After sections fade out, move total section down smoothly
      timeout1 = setTimeout(() => {
        setHideHeader(true);
        totalTop.value = withTiming(480, {
          duration: 800,
          easing: Easing.out(Easing.ease),
        });
      }, 600);

      // Step 3: After total section finishes moving, show Rive animation
      timeout2 = setTimeout(() => {
        setShowRiveAnimation(true);
      }, 1400);
    } else {
      // Reset animations if not success
      detailsOpacity.value = 1;
      sendToOpacity.value = 1;
      totalTop.value = 32;
      setShowRiveAnimation(false);
      setHideHeader(false);
    }

    // Cleanup timeouts on unmount or when isSuccess changes
    return () => {
      if (timeout1) clearTimeout(timeout1);
      if (timeout2) clearTimeout(timeout2);
    };
  }, [isSuccess, detailsOpacity, sendToOpacity, totalTop]);

  // Redirect back in case no transaction is available
  const isLiquid = network === NETWORK_LIQUID || network === NETWORK_LIQUID_TESTNET;
  if (!getIsAccountBased(network) && !createdTransaction && !liquidPrepareResult) {
    Alert.alert('No transaction available');
    return <Redirect href="/Home" />;
  }

  // For Liquid, use prepare result; for others, use created transaction
  const { txhex, actualFee } = createdTransaction ?? { txhex: undefined, actualFee: 0 };
  const networkDecimals = getDecimalsByNetwork(network);
  const nativeTicker = getTickerByNetwork(network);

  // For Liquid, get fee from prepare result
  const liquidFee = liquidPrepareResult?.feesSat ?? 0;
  const feeToUse = isLiquid ? liquidFee : actualFee;

  const feeInNative = formatBalance(String(feeToUse), networkDecimals, 8);
  const feeInNativeUnits = BigNumber(feeToUse).dividedBy(new BigNumber(10).pow(networkDecimals));

  // For token sends, amount is in token units, fee is in native units
  // For native sends, both are in native units
  const isTokenSend = !!token;

  // USD conversions
  const amountUsdValue = exchangeRate && !isTokenSend ? `$${BigNumber(amount).multipliedBy(Number(exchangeRate)).toFixed(2)}` : '';
  const usdFee = exchangeRate ? `$${feeInNativeUnits.multipliedBy(Number(exchangeRate)).toFixed(2)}` : '';

  // Total calculation
  let totalUsd: string;
  let totalDisplay: string;

  if (isTokenSend) {
    // For token sends, only show token amount in total (fee shown separately in details)
    totalUsd = '';
    totalDisplay = `${amount} ${ticker}`;
  } else {
    const totalAmount = BigNumber(amount).plus(feeInNativeUnits);
    totalUsd = exchangeRate ? `$${totalAmount.multipliedBy(Number(exchangeRate)).toFixed(2)}` : '';
    totalDisplay = `${totalAmount.toFixed()} ${ticker}`;
  }

  const broadcast = async () => {
    setIsBroadcasting(true);
    setError('');

    try {
      if (network === NETWORK_ARK || network === NETWORK_ARK_MUTINYNET || network === NETWORK_SPARK || network === NETWORK_STACKS || network === NETWORK_RGB || network === NETWORK_RGB_TESTNET) {
        const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
        assert(wallet instanceof ArkWallet || wallet instanceof SparkWallet || wallet instanceof StacksWallet || wallet instanceof RgbWallet, 'Internal error: incorrect wallet instance');

        // Check if we're sending a token and the wallet supports tokens
        if (token && walletCanHaveTokens(wallet)) {
          const tokenDecimals = token.decimals;
          const amountInBase = BigInt(new BigNumber(amount).multipliedBy(new BigNumber(10).pow(tokenDecimals)).toString(10));
          const transactionId = await wallet.transferToken(token.id, amountInBase, address, memo || undefined);
          if (!transactionId) {
            throw new Error('Transaction failed');
          }
        } else {
          // Native coin transfer
          const networkDecimals = getDecimalsByNetwork(network);
          const amountInBase = new BigNumber(amount).multipliedBy(new BigNumber(10).pow(networkDecimals)).toString(10);
          const transactionId = await wallet.pay(address, Number(amountInBase));
          if (!transactionId) {
            throw new Error('Transaction failed');
          }
        }
      } else if (network === NETWORK_BITCOIN) {
        assert(txhex, 'Transaction hex is required');
        if (!BlueElectrum.mainConnected) {
          await BlueElectrum.connectMain();
        }
        const result = await BlueElectrum.broadcastV2(txhex);
        if (!result) {
          throw new Error('Transaction broadcast failed');
        }
      } else if (getIsEVM(network)) {
        assert(txhex, 'Transaction hex is required');
        const e = new EvmWallet();
        const txid = await e.broadcastTransaction(network, txhex);
        if (!txid || typeof txid !== 'string') {
          throw new Error('Transaction broadcast failed');
        }
      } else if (network === NETWORK_LIQUID || network === NETWORK_LIQUID_TESTNET) {
        assert(liquidPrepareResult, 'Liquid prepare result is required');
        const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
        assert(wallet instanceof BreezWallet);
        const result = await wallet.sendPayment({ prepareResponse: liquidPrepareResult });
        if (!result) {
          throw new Error('Transaction failed');
        }
      } else {
        throw new Error('Unsupported network for broadcasting');
      }

      setIsSuccess(true);
    } catch (error: any) {
      console.error('Failed to broadcast transaction:', error);
      // RgbWallet attaches the already-broadcast txid to post-broadcast
      // backup failures — funds ARE sent; only the backup is missing.
      if (typeof error?.txid === 'string' && error.txid) {
        setSentNotBackedUp({ txid: error.txid });
      } else {
        setError(error.message || 'Failed to broadcast transaction');
      }
    } finally {
      setIsBroadcasting(false);
    }
  };

  const retryRgbBackup = async () => {
    if (network !== NETWORK_RGB && network !== NETWORK_RGB_TESTNET) return;
    setIsRetryingBackup(true);
    try {
      const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
      if (wallet instanceof RgbWallet && (await wallet.retryBackup())) {
        setSentNotBackedUp(null);
        setIsSuccess(true);
      }
    } catch (e) {
      console.error('RGB backup retry failed:', e);
    } finally {
      setIsRetryingBackup(false);
    }
  };

  const handleHome = () => {
    router.replace('/(tabs)/home');
  };

  const formatAddressWithOpacity = (addr: string) => {
    if (!addr) return null;
    if (addr.length < 8) return <ThemedText style={styles.addressDisplay}>{addr}</ThemedText>;

    // Split address in half
    const midpoint = Math.floor(addr.length / 2);
    const firstHalf = addr.substring(0, midpoint);
    const secondHalf = addr.substring(midpoint);

    // Highlight first 4 and last 4 characters
    const first4 = addr.substring(0, 4);
    const last4 = addr.substring(addr.length - 4);

    const nonBreakingSpace = '\u00A0';

    return (
      <View style={styles.addressContainer}>
        <ThemedText style={styles.addressDisplay} allowFontScaling={false}>
          <ThemedText style={[styles.addressHighlight, styles.addressLetterSpacing]} allowFontScaling={false}>
            {first4}
          </ThemedText>
          <ThemedText style={[styles.addressDisplay, styles.addressLetterSpacing]} allowFontScaling={false}>
            {nonBreakingSpace}
            {firstHalf.substring(4)}
          </ThemedText>
        </ThemedText>
        <ThemedText style={styles.addressDisplay} allowFontScaling={false}>
          <ThemedText style={[styles.addressDisplay, styles.addressLetterSpacing]} allowFontScaling={false}>
            {secondHalf.substring(0, secondHalf.length - 4)}
            {nonBreakingSpace}
          </ThemedText>
          <ThemedText style={[styles.addressHighlight, styles.addressLetterSpacing]} allowFontScaling={false}>
            {last4}
          </ThemedText>
        </ThemedText>
      </View>
    );
  };

  return (
    <RadialGradientScreen network={displayNetwork} scroll={false}>
      <Stack.Screen options={{ headerShown: false }} />
      {!hideHeader && <ScreenSendHeader network={displayNetwork} title={`Send ${getTickerByNetwork(displayNetwork)}`} />}

      <View style={styles.fixedContainer}>
        <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.container}>
              {showRiveAnimation && (
                <View style={styles.riveContainer}>
                  <SuccessRiveAnimation />
                </View>
              )}

              {sentNotBackedUp ? (
                <View style={styles.errorContainer} testID="sent-not-backed-up">
                  <Ionicons name="checkmark-circle" size={40} color="#FFCC00" />
                  <ThemedText style={styles.errorTitle}>Sent — backup pending</ThemedText>
                  <ThemedText style={styles.errorText}>
                    Your transfer WAS sent (txid {sentNotBackedUp.txid.substring(0, 8)}…{sentNotBackedUp.txid.substring(sentNotBackedUp.txid.length - 8)}), but saving the wallet backup failed. Retry until it
                    succeeds — do not delete or reinstall the app before then, or the change from this transfer can be lost.
                  </ThemedText>
                  <Pressable style={styles.backButton} onPress={retryRgbBackup} disabled={isRetryingBackup}>
                    <ThemedText style={styles.backButtonText}>{isRetryingBackup ? 'Retrying backup…' : 'Retry backup'}</ThemedText>
                  </Pressable>
                  <Pressable style={styles.backButton} onPress={handleHome}>
                    <ThemedText style={styles.backButtonText}>Back to Wallet</ThemedText>
                  </Pressable>
                </View>
              ) : error ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={40} color="#FF3B30" />
                  <ThemedText style={styles.errorTitle}>Error</ThemedText>
                  <ThemedText style={styles.errorText}>{error}</ThemedText>
                  <Pressable style={styles.backButton} onPress={() => router.back()}>
                    <ThemedText style={styles.backButtonText}>Go Back</ThemedText>
                  </Pressable>
                </View>
              ) : (
                <>
                  {/* NOTE: no RgbBackupBanner here. This screen is laid out
                      with absolute positions (Total at a fixed top, the send
                      button docked to the bottom), so flow-inserted content
                      overlaps it. Pre-send backup state is covered by the
                      VSS probe below; stale-backup nagging lives on Home. */}

                  {/* Total Section */}
                  <Animated.View style={[styles.totalSection, totalAnimatedStyle]}>
                    <View style={styles.sectionHeader}>
                      <ThemedText style={styles.sectionHeaderText}>Total</ThemedText>
                    </View>
                    <View style={styles.totalCard}>
                      <ThemedText type="sfProRounded" style={styles.totalAmount}>
                        {totalDisplay}
                      </ThemedText>
                      {totalUsd && <ThemedText style={styles.totalUsd}>{totalUsd}</ThemedText>}
                    </View>
                  </Animated.View>

                  {/* Details Section */}
                  <Animated.View style={[styles.detailsSection, detailsAnimatedStyle]}>
                    <View style={styles.sectionHeader}>
                      <ThemedText style={styles.sectionHeaderText}>Details</ThemedText>
                    </View>
                    <View style={styles.detailsCard}>
                      <View style={styles.detailRow}>
                        <ThemedText style={styles.detailLabel}>Amount</ThemedText>
                        <View style={styles.detailValueContainer}>
                          <ThemedText style={styles.detailValue}>
                            {amount} {ticker}
                          </ThemedText>
                          {amountUsdValue && <ThemedText style={styles.detailUsd}>{amountUsdValue}</ThemedText>}
                        </View>
                      </View>

                      <View style={styles.divider} />

                      <View style={styles.detailRow}>
                        <ThemedText style={styles.detailLabel}>Network Fee</ThemedText>
                        <View style={styles.detailValueContainer}>
                          <ThemedText style={styles.detailValue}>
                            {feeInNative} {nativeTicker}
                          </ThemedText>
                          {usdFee && <ThemedText style={styles.detailUsd}>{usdFee}</ThemedText>}
                        </View>
                      </View>
                    </View>
                  </Animated.View>

                  {/* Send to Section */}
                  <Animated.View style={[styles.sendToSection, sendToAnimatedStyle]}>
                    <View style={styles.sectionHeader}>
                      <ThemedText style={styles.sectionHeaderText}>Send to</ThemedText>
                    </View>
                    <View style={styles.addressCard}>{formatAddressWithOpacity(address)}</View>
                  </Animated.View>
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        {!error && !sentNotBackedUp && (
          <View style={styles.bottomDock} pointerEvents="box-none">
            {vssProbe === 'failed' && !isSuccess && (
              <View style={styles.vssWarning} testID="vss-probe-warning">
                <ThemedText style={styles.vssWarningText}>
                  Backup service is unreachable right now. You can still send at your own risk — but if this app is deleted before a backup succeeds, the change from this transfer may be lost forever.
                  Consider waiting a few minutes instead.
                </ThemedText>
              </View>
            )}
            <Pressable
              style={[styles.sendButton, (isBroadcasting || vssProbe === 'checking') && styles.disabledButton]}
              onPress={isSuccess ? handleHome : broadcast}
              disabled={isBroadcasting || vssProbe === 'checking'}
              testID="send-confirm-button"
            >
              {vssProbe === 'checking' && !isSuccess ? (
                <View style={styles.checkingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <ThemedText style={styles.sendButtonText}> Checking backup service…</ThemedText>
                </View>
              ) : (
                <ThemedText style={styles.sendButtonText} testID={isSuccess ? 'send-success-text' : undefined}>
                  {isSuccess
                    ? 'Back to Wallet'
                    : isBroadcasting
                      ? network === NETWORK_RGB || network === NETWORK_RGB_TESTNET
                        ? 'Sending & backing up — don’t close the app'
                        : 'Sending...'
                      : vssProbe === 'failed'
                        ? 'Send anyway (at your own risk)'
                        : 'Confirm Send'}
                </ThemedText>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </RadialGradientScreen>
  );
};

const styles = StyleSheet.create({
  fixedContainer: {
    flex: 1,
    position: 'relative',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 80,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 24,
  },
  totalSection: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 18,
    padding: 2,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 4,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'left',
  },
  totalCard: {
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 0,
    alignItems: 'center',
    gap: 4,
  },
  totalAmount: {
    fontSize: 24,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  totalUsd: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
  },
  detailsSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 18,
    padding: 2,
    marginTop: 198,
    marginBottom: 32,
  },
  detailsCard: {
    borderRadius: 20,
    paddingVertical: 16,
  },
  sendToSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 18,
    padding: 2,
    marginBottom: 32,
  },
  addressCard: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 79,
    justifyContent: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 0,
    paddingHorizontal: 16,
  },
  detailLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: '400',
  },
  detailValueContainer: {
    alignItems: 'flex-end',
    gap: 2,
  },
  detailValue: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
  },
  detailUsd: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 16,
    fontWeight: '400',
  },
  addressDisplay: {
    fontFamily: 'monospace',
    lineHeight: 24,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 18,
    textAlign: 'center',
    flexShrink: 0,
  },
  addressHighlight: {
    color: 'rgb(255, 255, 255)',
  },
  addressLetterSpacing: {
    letterSpacing: 1.6,
  },
  addressContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 8,
  },
  riveContainer: {
    width: '100%',
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 160,
    marginBottom: 20,
  },
  riveAnimation: {
    width: '180%',
    height: '180%',
  },
  bottomDock: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    height: 56,
    zIndex: 1000,
  },
  vssWarning: {
    backgroundColor: 'rgba(20, 16, 0, 0.92)',
    borderColor: 'rgba(255, 204, 0, 0.5)',
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 8,
    padding: 12,
  },
  vssWarningText: {
    color: '#FFCC00',
    fontSize: 13,
    lineHeight: 18,
  },
  checkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  backButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '80%',
    alignItems: 'center',
  },
  backButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default withAsset(SendConfirm);
