import assert from 'assert';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import GradientScreen from '@/components/GradientScreen';
import { ThemedText } from '@/components/ThemedText';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { SparkWallet, StaticDepositQuoteOutput } from '@shared/class/wallets/spark-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { NETWORK_ARK, NETWORK_ARK_MUTINYNET, NETWORK_BITCOIN, NETWORK_SPARK } from '@shared/types/networks';
import { formatBalance } from '@shared/modules/string-utils';
import { getDecimalsByNetwork } from '@shared/models/network-getters';
import { CommonSwap } from '@shared/types/common-swap';
import { ArkWallet } from '@shared/class/wallets/ark-wallet';
import Pressable from '@/components/Pressable';

const decimals = getDecimalsByNetwork(NETWORK_SPARK);

export type SwapXArkClaimParams = {
  swapJson: string;
};

// for BTC -> Spark swap we can get a quote.
// but for BTC -> Ark we can not, so we just show the confirmation.

const SwapXArkClaim = () => {
  const router = useRouter();
  const wallet = useRef<SparkWallet | ArkWallet>(null);
  const { network } = useContext(NetworkContext);
  const params = useLocalSearchParams<SwapXArkClaimParams>();
  const { accountNumber } = useContext(AccountNumberContext);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [quote, setQuote] = useState<StaticDepositQuoteOutput | undefined>(undefined);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [refundSuccess, setRefundSuccess] = useState(false);

  const swap = useMemo(() => JSON.parse(params.swapJson) as CommonSwap, [params.swapJson]);

  useEffect(() => {
    const getQuote = async () => {
      try {
        const w = await BackgroundExecutor.lazyInitWallet(swap.network as any, accountNumber);
        assert(w instanceof SparkWallet || w instanceof ArkWallet, 'Not a XArk wallet');
        wallet.current = w;
        if (w instanceof SparkWallet) {
          const quote = await w.getDepositQuote(swap.id);
          setQuote(quote);
        }
      } catch (error: any) {
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };
    getQuote();
  }, [router, swap, accountNumber]);

  const handleClaimArk = async () => {
    assert(wallet.current instanceof ArkWallet, 'Not an Ark wallet');
    setIsClaiming(true);
    try {
      await wallet.current.claimDepositArk(swap.id);
      setClaimSuccess(true);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsClaiming(false);
    }
  };

  const handleClaimSpark = async () => {
    if (!quote) return;
    assert(wallet.current instanceof SparkWallet, 'Not a Spark wallet');
    setIsClaiming(true);
    try {
      await wallet.current.claimDepositSpark(quote);
      setClaimSuccess(true);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsClaiming(false);
    }
  };

  const handleRefund = async () => {
    if (!wallet.current || !quote) return;
    setIsRefunding(true);
    try {
      const destinationAddress = await BackgroundExecutor.getAddress(NETWORK_BITCOIN, accountNumber);
      assert(wallet.current instanceof SparkWallet, 'Not a Spark wallet');
      await wallet.current.refundDeposit(quote.transactionId, destinationAddress);
      setRefundSuccess(true);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsRefunding(false);
    }
  };

  const handleBack = () => {
    router.replace('/Home');
  };

  const disabled = isClaiming || isRefunding;

  // Success screen for claim
  if (claimSuccess) {
    return (
      <GradientScreen variant={network}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.contentContainer}>
            <View style={styles.successContainer}>
              <Ionicons name="checkmark-circle" size={80} color="white" />
              <ThemedText style={styles.successMessage}>Swap Claimed Successfully!</ThemedText>
              {quote && <ThemedText style={styles.successSubMessage}>{formatBalance(quote.creditAmountSats.toString(), decimals)} BTC has been added to your Spark balance</ThemedText>}
              <Pressable style={styles.backButton} onPress={handleBack}>
                <ThemedText style={styles.backButtonText}>Back to Wallet</ThemedText>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </GradientScreen>
    );
  }

  // Success screen for refund
  if (refundSuccess) {
    return (
      <GradientScreen variant={network}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.contentContainer}>
            <View style={styles.successContainer}>
              <Ionicons name="checkmark-circle" size={80} color="white" />
              <ThemedText style={styles.successMessage}>Swap Refunded Successfully!</ThemedText>
              <ThemedText style={styles.successSubMessage}>Your Bitcoin has been sent back to your wallet</ThemedText>
              <Pressable style={styles.backButton} onPress={handleBack}>
                <ThemedText style={styles.backButtonText}>Back to Wallet</ThemedText>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </GradientScreen>
    );
  }

  let quote2;
  if (!isLoading && quote) {
    const networkFee = swap.amount - quote.creditAmountSats;

    quote2 = (
      <>
        <View style={styles.detailRow}>
          <ThemedText style={styles.detailLabel}>Network Fee:</ThemedText>
          <ThemedText style={styles.detailValue}>{formatBalance(networkFee.toString(), decimals)} BTC</ThemedText>
        </View>

        <View style={styles.detailRow}>
          <ThemedText style={styles.detailLabel}>You will receive:</ThemedText>
          <ThemedText style={styles.detailValue}>{formatBalance(quote.creditAmountSats.toString(), decimals)} BTC</ThemedText>
        </View>
      </>
    );
  }

  return (
    <GradientScreen variant={network}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentContainer}>
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="rgba(255, 255, 255, 0.8)" />
              <ThemedText style={styles.loadingText}>Loading swap details...</ThemedText>
            </View>
          )}

          {!isLoading && (
            <>
              <View style={styles.quoteContainer}>
                <ThemedText style={styles.quoteTitle}>Swap Details</ThemedText>
                <View style={styles.detailsCard}>
                  <View style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel}>Amount In:</ThemedText>
                    <ThemedText style={styles.detailValue}>{formatBalance(swap.amount.toString(), decimals)} BTC</ThemedText>
                  </View>

                  {quote2}

                  <View style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel}>Destination:</ThemedText>
                    <ThemedText style={styles.detailValue}>{swap.network === NETWORK_SPARK ? 'Spark Balance' : 'Ark Balance'}</ThemedText>
                  </View>
                </View>
                <ThemedText style={styles.infoText}>
                  You can claim this swap to receive Bitcoin on your {swap.network === NETWORK_SPARK ? 'Spark' : 'Ark'} balance, or refund it to get your sats back to your Bitcoin wallet.
                </ThemedText>
              </View>

              <View style={styles.buttonContainer}>
                <Pressable style={[styles.primaryButton, disabled && styles.disabledButton]} onPress={swap.network === NETWORK_SPARK ? handleClaimSpark : handleClaimArk} disabled={disabled}>
                  {isClaiming && <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.9)" />}
                  <ThemedText style={styles.primaryButtonText}>{isClaiming ? 'Claiming...' : 'Claim Swap'}</ThemedText>
                </Pressable>

                <Pressable style={[styles.secondaryButton, disabled && styles.disabledButton]} onPress={handleRefund} disabled={disabled}>
                  {isRefunding && <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.7)" />}
                  <ThemedText style={styles.secondaryButtonText}>{isRefunding ? 'Refunding...' : 'Refund Swap'}</ThemedText>
                </Pressable>
              </View>
            </>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={24} color="#FF6B6B" />
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            </View>
          )}
        </View>
      </ScrollView>
    </GradientScreen>
  );
};

export default SwapXArkClaim;

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
  },
  quoteContainer: {
    flex: 1,
    paddingTop: 20,
  },
  quoteTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 24,
    textAlign: 'center',
  },
  detailsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    paddingBottom: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
  },
  detailValue: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: '600',
  },
  infoText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  buttonContainer: {
    gap: 12,
    paddingBottom: 20,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  primaryButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  secondaryButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.5,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  errorText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    flex: 1,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  successMessage: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  successSubMessage: {
    fontSize: 16,
    marginBottom: 40,
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.7)',
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  backButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '80%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  backButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: '600',
  },
});
