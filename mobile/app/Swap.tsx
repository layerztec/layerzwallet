import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useContext, useState, useEffect } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, ActivityIndicator, Alert } from 'react-native';
import assert from 'assert';
import BigNumber from 'bignumber.js';

import Button from '@/components/Button';
import GradientScreen from '@/components/GradientScreen';
import { ThemedText } from '@/components/ThemedText';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useBalance } from '@shared/hooks/useBalance';
import { useCachedExchangeRate } from '@shared/hooks/useCachedExchangeRate';
import { getTickerByNetwork, getDecimalsByNetwork } from '@shared/models/network-getters';
import { formatBalance, formatFiatBalance, capitalizeFirstLetter } from '@shared/modules/string-utils';
import { getSwapPairs, getSwapProvidersList } from '@shared/models/swap-providers-list';
import { SwapPlatform, SwapPair, DoSwapResponse } from '@shared/types/swap';
import { Networks } from '@shared/types/networks';
import * as Linking from 'expo-linking';

export default function Swap() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    amount?: string;
    toNetwork?: Networks;
    showSwapInterface?: string;
    fromNetwork?: string;
  }>();

  const { network, setNetwork } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);

  // Use router params for state management
  const [internalAmount, setInternalAmount] = useState('0');
  const amount = params.amount || internalAmount;
  const targetNetwork = params.toNetwork;

  const { balance } = useBalance(network, accountNumber, BackgroundExecutor);
  const { exchangeRate } = useCachedExchangeRate(network, 'USD');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [swapPairs, setSwapPairs] = useState<SwapPair[]>([]);

  const ticker = getTickerByNetwork(network);
  const decimals = getDecimalsByNetwork(network);

  // Update swap pairs when network changes
  useEffect(() => {
    setSwapPairs(getSwapPairs(network, SwapPlatform.MOBILE));
  }, [network]);

  // Format balance for display
  const formattedBalance = formatBalance(balance || '0', decimals);
  const usdValue = exchangeRate && typeof exchangeRate === 'number' ? formatFiatBalance(balance || '0', decimals, exchangeRate) : '0.00';

  const handleClose = () => {
    router.back();
  };

  const handleAmountChange = (text: string) => {
    setInternalAmount(text);
    router.setParams({ amount: text });
  };

  const handleToTokenSelect = () => {
    router.push({ pathname: '/SwapTarget' });
  };

  const handleMaxPress = () => {
    const maxAmount = formattedBalance;
    setInternalAmount(maxAmount);
    router.setParams({ amount: maxAmount });
  };

  const handleSwap = async (): Promise<DoSwapResponse> => {
    setError('');
    assert(balance, 'Balance not loaded');
    assert(targetNetwork, 'Target network not selected');
    const amt = parseFloat(amount);
    assert(!isNaN(amt), 'Invalid amount');
    assert(amt > 0, 'Amount should be > 0');

    const satValueBN = new BigNumber(amt);
    const satValue = satValueBN.multipliedBy(new BigNumber(10).pow(decimals)).toString(10);
    assert(new BigNumber(balance).gte(satValue), 'Not enough balance');

    const providers = getSwapProvidersList(network);
    const provider = providers.find((p) => p.getSupportedPairs().some((pair) => pair.from === network && pair.to === targetNetwork && pair.platform === SwapPlatform.MOBILE));

    assert(provider, 'No provider found for the selected networks');

    const destinationAddress = await BackgroundExecutor.getAddress(targetNetwork, accountNumber);
    assert(destinationAddress, 'No destination address');

    return provider.swap(network, setNetwork, targetNetwork, parseInt(satValue), destinationAddress);
  };

  const handleExecuteSwap = async () => {
    setIsLoading(true);
    try {
      const swapResponse = await handleSwap();

      switch (true) {
        case swapResponse.action === 'DAPP_BROWSER':
          router.push({ pathname: '/DAppBrowser', params: { url: swapResponse.uri } });
          break;
        case swapResponse.action === 'EXTERNAL_BROWSER':
          await Linking.openURL(swapResponse.uri);
          break;
        default:
          Alert.alert('Internal error', 'Unhandled swap action (this should never happen)');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const canSwap = targetNetwork && parseFloat(amount) > 0 && !isLoading;

  let buttonTitle = '';
  if (!targetNetwork) {
    buttonTitle = 'Select target network';
  } else if (internalAmount === '0') {
    buttonTitle = 'Enter amount';
  } else {
    buttonTitle = `Swap ${ticker} to ${targetNetwork ? capitalizeFirstLetter(targetNetwork) : '...'}`;
  }

  return (
    <GradientScreen variant={network} scroll={true}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={styles.title}>Swap</ThemedText>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={20} color="rgba(255, 255, 255, 0.8)" />
          </TouchableOpacity>
        </View>

        {/* From Token Input */}
        <View style={styles.tokenCard}>
          <View style={styles.tokenInputHeader}>
            <TouchableOpacity style={styles.maxButton} onPress={handleMaxPress}>
              <ThemedText style={styles.maxButtonText}>max</ThemedText>
            </TouchableOpacity>
          </View>
          <View style={styles.tokenInputRow}>
            <View style={styles.amountContainer}>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={handleAmountChange}
                placeholder="0.0"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                keyboardType="numeric"
                testID="AmountInput"
              />
            </View>
          </View>
          <View style={styles.balanceRow}>
            <ThemedText style={styles.usdText}>{usdValue} USD</ThemedText>
            <ThemedText style={styles.balanceText}>
              Balance {formattedBalance} {ticker}
            </ThemedText>
          </View>
        </View>

        {/* To Token Selection */}
        <View style={styles.toSection}>
          <ThemedText style={styles.toLabel} testID="ToLabel">
            To
          </ThemedText>
          <TouchableOpacity style={styles.targetButton} onPress={handleToTokenSelect} testID="ToNetworkButton">
            <ThemedText style={styles.targetButtonText}>{targetNetwork ? capitalizeFirstLetter(targetNetwork) : 'Select target network'}</ThemedText>
            <Ionicons name="chevron-down" size={20} color="rgba(255, 255, 255, 0.6)" />
          </TouchableOpacity>
        </View>

        {/* Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        )}

        {/* Swap Button */}
        <View style={styles.swapButtonContainer}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="rgba(255, 255, 255, 0.8)" />
              <ThemedText style={styles.loadingText}>Preparing swap...</ThemedText>
            </View>
          ) : (
            <Button testID="SwapButton" title={buttonTitle} onPress={handleExecuteSwap} style={[styles.swapButton, ...(canSwap ? [] : [styles.swapButtonDisabled])]} disabled={!canSwap} />
          )}
        </View>
      </View>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginTop: 16,
    marginBottom: 24,
  },
  title: {
    paddingTop: 4,
    fontSize: 22,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    fontWeight: '500',
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
    padding: 16,
    height: 86,
    position: 'relative',
    marginBottom: 20,
  },
  tokenInputHeader: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
  },
  maxButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    paddingHorizontal: 10,
  },
  maxButtonText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  tokenInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 2,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flex: 1,
  },
  amountInput: {
    fontSize: 24,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    fontFamily: 'Inter',
    padding: 0,
    margin: 0,
    minWidth: '50%',
  },
  balanceRow: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  usdText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '400',
  },
  balanceText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '600',
  },
  toSection: {
    marginBottom: 20,
  },
  toLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
    textAlign: 'center',
  },
  targetButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 56,
  },
  targetButtonText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    textAlign: 'center',
  },
  swapButtonContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 40,
  },
  swapButton: {
    height: 56,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  swapButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    opacity: 0.6,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 12,
    fontSize: 16,
  },
});
