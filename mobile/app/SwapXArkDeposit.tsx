import assert from 'assert';
import BigNumber from 'bignumber.js';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import GradientScreen from '@/components/GradientScreen';
import { ThemedText } from '@/components/ThemedText';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { SparkWallet } from '@shared/class/wallets/spark-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { NETWORK_ARK, NETWORK_ARK_MUTINYNET, NETWORK_SPARK, Networks } from '@shared/types/networks';
import { getDecimalsByNetwork } from '@shared/models/network-getters';
import { ArkWallet } from '@shared/class/wallets/ark-wallet';
import { SendBtcParams } from './SendBtc';

export type SwapXArkDepositParams = {
  amountIn: string;
  to: typeof NETWORK_ARK | typeof NETWORK_ARK_MUTINYNET | typeof NETWORK_SPARK;
};

export default function SwapXArkDeposit() {
  const router = useRouter();
  const network = useContext(NetworkContext).network as typeof NETWORK_ARK | typeof NETWORK_ARK_MUTINYNET | typeof NETWORK_SPARK;
  const { amountIn, to } = useLocalSearchParams<SwapXArkDepositParams>();
  const { accountNumber } = useContext(AccountNumberContext);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // get the Spark deposit address and redirect to SendBtc
  useEffect(() => {
    const redirect = async () => {
      try {
        const wallet = await BackgroundExecutor.lazyInitWallet(to, accountNumber);
        assert(wallet instanceof SparkWallet || wallet instanceof ArkWallet, 'Not a XArk wallet');
        const toAddress = await wallet.getOnchainDepositAddress();
        const amount = new BigNumber(amountIn).dividedBy(10 ** getDecimalsByNetwork(network)).toString(10);
        const newParams: SendBtcParams = { toAddress, amount, xArkSwapTo: to };
        router.replace({ pathname: '/SendBtc', params: newParams });
      } catch (error: any) {
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };
    redirect();
  }, [router, amountIn, accountNumber, network, to]);

  return (
    <GradientScreen variant={network} scroll={true}>
      <View style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle}>Spark Swap</ThemedText>
        </View>

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="rgba(255, 255, 255, 0.8)" />
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        )}
      </View>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    marginTop: 32,
    padding: 16,
  },
  headerTitle: {
    fontSize: 32,
    paddingTop: 8,
    color: 'white',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
  },
  errorContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
