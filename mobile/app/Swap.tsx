import { Ionicons } from '@expo/vector-icons';
import Pressable from '../components/Pressable';
import assert from 'assert';
import BigNumber from 'bignumber.js';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useContext, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import AmountInput from '@/components/AmountInput';
import Button from '@/components/Button';
import GradientScreen from '@/components/GradientScreen';
import { ThemedText } from '@/components/ThemedText';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { useSwapBalance } from '@/src/shared-link/hooks/useSwapBalance';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useCachedExchangeRate } from '@shared/hooks/useCachedExchangeRate';
import { getSwapProvidersList, getSwapTargetName } from '@shared/models/swap-providers-list';
import { formatBalance, formatFiatBalance } from '@shared/modules/string-utils';
import { NETWORK_LIQUID, NETWORK_STACKS, Networks } from '@shared/types/networks';
import { DoSwapResponse, SO_LIQUID_USDT, SO_ROOTSTOCK_USDT, SO_STACKS_STX, SwapOptions, SwapPlatform } from '@shared/types/swap';
import { SwapTargetParams } from './SwapTarget';
import { Denomination } from './send/_layout';

export type SwapParams = {
  amount?: string;
  toNetwork?: SwapOptions;
  showSwapInterface?: string;
  fromNetwork?: SwapOptions;
};

export default function Swap() {
  const router = useRouter();
  const params = useLocalSearchParams<SwapParams>();

  const { network, setNetwork } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);

  const [internalAmount, setInternalAmount] = useState('0');
  const amount = params.amount || internalAmount;
  const option = params.toNetwork;
  const fromNetwork = params.fromNetwork || network;

  const { exchangeRate } = useCachedExchangeRate(network, 'USD');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [denomination, setDenomination] = useState<Denomination>('Native');

  const { balance, actualIsLoading, decimals, ticker } = useSwapBalance(network, fromNetwork, BackgroundExecutor);

  const formattedBalance = formatBalance(balance || '0', decimals);
  const isToken = fromNetwork === SO_LIQUID_USDT || fromNetwork === SO_ROOTSTOCK_USDT;
  const usdValue = isToken ? '' : exchangeRate ? formatFiatBalance(amount || '0', 0, Number(exchangeRate)) + ' USD' : '';

  const handleClose = () => {
    router.back();
  };

  const handleAmountChange = (text: string) => {
    const normalized = text.replace(',', '.');
    if (normalized === '' || /^\d*\.?\d*$/.test(normalized)) {
      setInternalAmount(normalized);
      router.setParams({ amount: normalized });
    }
  };

  const handleToTokenSelect = () => {
    const params: SwapTargetParams = { fromNetwork };
    router.push({ pathname: '/SwapTarget', params });
  };

  const handleMaxPress = () => {
    const maxAmount = formattedBalance;
    setInternalAmount(maxAmount);
    router.setParams({ amount: maxAmount });
  };

  const handleBalanceClick = () => {
    const balanceAmount = formattedBalance;
    setInternalAmount(balanceAmount);
    router.setParams({ amount: balanceAmount });
  };

  const handleSwap = async (): Promise<DoSwapResponse> => {
    setError('');
    assert(balance, 'Balance not loaded');
    assert(option, 'Target network not selected');
    const amt = parseFloat(amount);
    assert(!isNaN(amt), 'Invalid amount');
    assert(amt > 0, 'Amount should be > 0');

    const satValueBN = new BigNumber(amt);
    const satValue = satValueBN.multipliedBy(new BigNumber(10).pow(decimals)).toString(10);
    assert(new BigNumber(balance).gte(satValue), 'Not enough balance');

    const providers = getSwapProvidersList(fromNetwork);
    const provider = providers.find((p) =>
      p.getSupportedPairs().some((pair) => pair.from === fromNetwork && pair.to === option && (pair.platform === SwapPlatform.MOBILE || pair.platform === SwapPlatform.ALL))
    );

    assert(provider, 'No provider found for the selected networks');

    let destinationAddress = '';
    if (option === SO_LIQUID_USDT || option === SO_ROOTSTOCK_USDT) {
      destinationAddress = await BackgroundExecutor.getAddress(NETWORK_LIQUID, accountNumber);
    } else if (option === SO_STACKS_STX) {
      destinationAddress = await BackgroundExecutor.getAddress(NETWORK_STACKS, accountNumber);
    } else {
      destinationAddress = await BackgroundExecutor.getAddress(option as Networks, accountNumber);
    }

    assert(destinationAddress, 'No destination address');

    return provider.swap(fromNetwork, setNetwork, option, parseInt(satValue), destinationAddress);
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
        case swapResponse.action === 'INTERNAL_SCREEN': {
          // unfortunately, we can't type swapResponse as it is shared with ext
          const href = { pathname: swapResponse.screen, params: swapResponse.params } as Href;
          router.push(href);
          break;
        }
        default:
          Alert.alert('Internal error', 'Unhandled swap action (this should never happen)');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDenominationSwitch = () => {
    setDenomination(denomination === 'Native' ? 'Fiat' : 'Native');
  };

  const canSwap = option && parseFloat(amount) > 0 && !isLoading && !actualIsLoading;
  const targetName = option ? getSwapTargetName(option) : '';

  let buttonTitle = '';
  if (!option) {
    buttonTitle = 'Select target network';
  } else if (internalAmount === '0') {
    buttonTitle = 'Enter amount';
  } else {
    buttonTitle = `Swap ${ticker} to ${targetName}`;
  }

  return (
    <GradientScreen variant={network} scroll={true}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={styles.title}>Transfer</ThemedText>
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={20} color="rgba(255, 255, 255, 0.8)" />
          </Pressable>
        </View>

        {/* From Token Input */}
        <View style={styles.inputSection}>
          <AmountInput
            value={amount}
            onChangeText={handleAmountChange}
            ticker={ticker}
            balance={formattedBalance}
            exchangeRate={exchangeRate}
            denomination={denomination}
            decimals={decimals}
            onDenominationSwitch={handleDenominationSwitch}
            onMaxPress={handleMaxPress}
            onBalancePress={handleMaxPress}
            testID="AmountInput"
          />
        </View>

        {/* To Token Selection */}
        <View style={styles.toSection}>
          <ThemedText style={styles.toLabel} testID="ToLabel">
            To
          </ThemedText>
          <Pressable style={styles.targetButton} onPress={handleToTokenSelect} testID="ToNetworkButton">
            <ThemedText style={styles.targetButtonText}>{option ? targetName : 'Select target network'}</ThemedText>
            <Ionicons name="chevron-down" size={20} color="rgba(255, 255, 255, 0.6)" />
          </Pressable>
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
  inputSection: {
    marginBottom: 20,
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
