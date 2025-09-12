import assert from 'assert';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import GradientScreen from '@/components/GradientScreen';
import { ThemedText } from '@/components/ThemedText';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { SparkWallet, StaticDepositQuoteOutput } from '@shared/class/wallets/spark-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { NETWORK_BITCOIN, NETWORK_SPARK } from '@shared/types/networks';
import { formatBalance } from '@shared/modules/string-utils';
import { getDecimalsByNetwork } from '@shared/models/network-getters';

const decimals = getDecimalsByNetwork(NETWORK_SPARK);

export type SwapSparkClaimParams = {
  swapId: string;
  amountIn: string;
};

const SwapSparkClaim = () => {
  const router = useRouter();
  const wallet = useRef<SparkWallet>(null);
  const { network } = useContext(NetworkContext);
  const params = useLocalSearchParams<SwapSparkClaimParams>();
  const { accountNumber } = useContext(AccountNumberContext);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [quote, setQuote] = useState<StaticDepositQuoteOutput | undefined>(undefined);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [refundSuccess, setRefundSuccess] = useState(false);

  // get the Spark deposit address and redirect to SendBtc
  useEffect(() => {
    const getQuote = async () => {
      try {
        const w = await BackgroundExecutor.lazyInitWallet(NETWORK_SPARK, accountNumber);
        assert(w instanceof SparkWallet);
        wallet.current = w;
        const quote = await w.getDepositQuote(params.swapId);
        setQuote(quote);
      } catch (error: any) {
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };
    getQuote();
  }, [router, params.swapId, accountNumber]);

  const handleClaim = async () => {
    if (!wallet.current || !quote) return;
    setIsClaiming(true);
    try {
      await wallet.current.claimDeposit(quote);
      setClaimSuccess(true);
      //   router.back();
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
      await wallet.current.refundDeposit(quote.transactionId, destinationAddress);
      setRefundSuccess(true);
      //   router.back();
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

  const networkFee = quote ? parseInt(params.amountIn) - quote.creditAmountSats : 0;

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
              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <ThemedText style={styles.backButtonText}>Back to Wallet</ThemedText>
              </TouchableOpacity>
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
              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <ThemedText style={styles.backButtonText}>Back to Wallet</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </GradientScreen>
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

          {quote && !isLoading && (
            <>
              <View style={styles.quoteContainer}>
                <ThemedText style={styles.quoteTitle}>Swap Details</ThemedText>
                <View style={styles.detailsCard}>
                  <View style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel}>Amount In:</ThemedText>
                    <ThemedText style={styles.detailValue}>{formatBalance(params.amountIn, decimals)} BTC</ThemedText>
                  </View>

                  <View style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel}>Network Fee:</ThemedText>
                    <ThemedText style={styles.detailValue}>{formatBalance(networkFee.toString(), decimals)} BTC</ThemedText>
                  </View>

                  <View style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel}>You will receive:</ThemedText>
                    <ThemedText style={styles.detailValue}>{formatBalance(quote.creditAmountSats.toString(), decimals)} BTC</ThemedText>
                  </View>

                  <View style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel}>Destination:</ThemedText>
                    <ThemedText style={styles.detailValue}>Spark Balance</ThemedText>
                  </View>
                </View>
                <ThemedText style={styles.infoText}>You can claim this swap to receive Bitcoin on your Spark balance, or refund it to get your sats back to your Bitcoin wallet.</ThemedText>
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity style={[styles.primaryButton, disabled && styles.disabledButton]} onPress={handleClaim} disabled={disabled}>
                  {isClaiming && <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.9)" />}
                  <ThemedText style={styles.primaryButtonText}>{isClaiming ? 'Claiming...' : 'Claim Swap'}</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.secondaryButton, disabled && styles.disabledButton]} onPress={handleRefund} disabled={disabled}>
                  {isRefunding && <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.7)" />}
                  <ThemedText style={styles.secondaryButtonText}>{isRefunding ? 'Refunding...' : 'Refund Swap'}</ThemedText>
                </TouchableOpacity>
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

export default SwapSparkClaim;

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
