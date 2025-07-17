import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { useBalance } from '@/src/shared-link/hooks/useBalance';
import { useAccountBalance } from '@/src/shared-link/hooks/useAccountBalance';
import { useExchangeRate } from '@/src/shared-link/hooks/useExchangeRate';
import { fiatOnRamp } from '@/src/shared-link/models/fiat-on-ramp';
import { getDecimalsByNetwork, getIsTestnet, getTickerByNetwork } from '@/src/shared-link/models/network-getters';
import { formatBalance, formatFiatBalance } from '@/src/shared-link/modules/string-utils';
import { useAvailableNetworks } from '@/src/shared-link/hooks/useAvailableNetworks';
import { NETWORK_BITCOIN, NETWORK_LIGHTNING, NETWORK_LIGHTNINGTESTNET, NETWORK_LIQUID, NETWORK_LIQUIDTESTNET, NETWORK_SPARK, Networks } from '@/src/shared-link/types/networks';
import { IBackgroundCaller } from '@/src/shared-link/types/IBackgroundCaller';
import { router } from 'expo-router';
import { OnrampProps } from '@/app/Onramp';

interface BalanceViewProps {
  network: Networks;
  accountNumber: number;
  BackgroundCaller: IBackgroundCaller;
}

const BalanceView: React.FC<BalanceViewProps> = ({ network, accountNumber, BackgroundCaller }) => {
  const { balance } = useBalance(network, accountNumber, BackgroundCaller);
  const { exchangeRate } = useExchangeRate(network, 'USD');
  const availableNetworks = useAvailableNetworks();
  const { accountBalance } = useAccountBalance(accountNumber, availableNetworks);

  // Always call hooks but use the same network if not NETWORK_LIGHTNING, so the deduplication will work and
  // no extra requests to backend will be made
  const isLightningNetwork = network === NETWORK_LIGHTNING || network === NETWORK_LIGHTNINGTESTNET;
  const sparkNetwork = isLightningNetwork ? NETWORK_SPARK : network;
  const liquidNetwork = isLightningNetwork ? (network === NETWORK_LIGHTNINGTESTNET ? NETWORK_LIQUIDTESTNET : NETWORK_LIQUID) : network;
  const { balance: sparkBalance } = useBalance(sparkNetwork, accountNumber, BackgroundCaller);
  const { balance: liquidBalance } = useBalance(liquidNetwork, accountNumber, BackgroundCaller);
  const { exchangeRate: sparkExchangeRate } = useExchangeRate(sparkNetwork, 'USD');
  const { exchangeRate: liquidExchangeRate } = useExchangeRate(liquidNetwork, 'USD');

  const handleBuyClick = () => {
    BackgroundCaller.getAddress(network, accountNumber).then((address) => {
      router.push('/Onramp');
      const params: OnrampProps = { address, network };
      router.replace({ pathname: '/Onramp', params });
    });
  };

  return (
    <>
      {getIsTestnet(network) && (
        <View style={styles.testnetWarningContainer}>
          <ThemedText style={styles.testnetWarningText}>Warning: You are using a testnet, coins have no value</ThemedText>
        </View>
      )}

      {network === NETWORK_LIGHTNING || network === NETWORK_LIGHTNINGTESTNET ? (
        <View>
          <View style={styles.lightningBalanceContainer}>
            <View style={styles.lightningBalanceRow}>
              <ThemedText style={styles.lightningBalanceLabel}>Spark</ThemedText>
              <View style={styles.lightningBalanceValues}>
                <ThemedText style={styles.lightningBalanceAmount}>
                  {network === NETWORK_LIGHTNINGTESTNET ? '0' : sparkBalance ? formatBalance(sparkBalance, getDecimalsByNetwork(NETWORK_SPARK), 8) : '0'} {getTickerByNetwork(NETWORK_SPARK)}
                </ThemedText>
                <ThemedText style={styles.lightningBalanceFiat}>
                  {network === NETWORK_LIGHTNINGTESTNET
                    ? '-'
                    : sparkBalance && +sparkBalance > 0 && sparkExchangeRate
                      ? '$' + formatFiatBalance(sparkBalance, getDecimalsByNetwork(NETWORK_SPARK), sparkExchangeRate)
                      : '-'}
                </ThemedText>
              </View>
            </View>
            <View style={styles.lightningBalanceRow}>
              <ThemedText style={styles.lightningBalanceLabel}>Liquid</ThemedText>
              <View style={styles.lightningBalanceValues}>
                <ThemedText style={styles.lightningBalanceAmount}>
                  {liquidBalance ? formatBalance(liquidBalance, getDecimalsByNetwork(NETWORK_LIQUID), 8) : '0'} {getTickerByNetwork(NETWORK_LIQUID)}
                </ThemedText>
                <ThemedText style={styles.lightningBalanceFiat}>
                  {liquidBalance && +liquidBalance > 0 && liquidExchangeRate ? '$' + formatFiatBalance(liquidBalance, getDecimalsByNetwork(NETWORK_LIQUID), liquidExchangeRate) : '-'}
                </ThemedText>
              </View>
            </View>
          </View>
          {fiatOnRamp?.[network]?.canBuyWithFiat ? (
            <View style={styles.buyButtonContainer}>
              <TouchableOpacity style={styles.buyButton} onPress={handleBuyClick}>
                <Ionicons name="cart-outline" size={16} color="white" />
                <ThemedText style={styles.buyButtonText}> Buy</ThemedText>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.balanceContainer}>
          <ThemedText style={styles.balanceLabel} testID="LayerBalance">
            Layer Balance:
          </ThemedText>
          <ThemedText style={styles.balanceText} adjustsFontSizeToFit numberOfLines={1} testID="LayerActualBalance">
            {balance ? formatBalance(balance, getDecimalsByNetwork(network)) + ' ' + getTickerByNetwork(network) : '???'}
          </ThemedText>
          <ThemedText adjustsFontSizeToFit numberOfLines={1}>
            {balance && +balance > 0 && exchangeRate ? '$' + formatFiatBalance(balance, getDecimalsByNetwork(network), exchangeRate) : ''}
          </ThemedText>
          {fiatOnRamp?.[network]?.canBuyWithFiat ? (
            <View style={styles.buyButtonInlineContainer}>
              <TouchableOpacity style={styles.buyButtonInline} onPress={handleBuyClick}>
                <Ionicons name="cart-outline" size={16} color="white" />
                <ThemedText style={styles.buyButtonText}> Buy</ThemedText>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      )}

      <View style={styles.pocketBalanceContainer}>
        <ThemedText style={styles.pocketBalanceLabel}>
          Pocket balance: {accountBalance ? formatBalance(accountBalance, getDecimalsByNetwork(NETWORK_BITCOIN), 8) : ''} {getTickerByNetwork(NETWORK_BITCOIN)}
        </ThemedText>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  balanceContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    marginBottom: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    marginHorizontal: 4,
  },
  balanceLabel: {
    marginTop: 8,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  balanceText: {
    textAlign: 'center',
    width: '100%',
    marginBottom: 4,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  testnetWarningContainer: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    padding: 12,
    borderRadius: 16,
    marginVertical: 10,
    marginHorizontal: 4,
  },
  testnetWarningText: {
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  lightningBalanceContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    marginHorizontal: 4,
    marginBottom: 20,
    padding: 16,
  },
  lightningBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  lightningBalanceLabel: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    flex: 1,
  },
  lightningBalanceValues: {
    alignItems: 'flex-end',
    flex: 1,
  },
  lightningBalanceAmount: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    textAlign: 'right',
  },
  lightningBalanceFiat: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    textAlign: 'right',
  },
  buyButtonContainer: {
    marginBottom: 15,
    alignItems: 'center',
  },
  buyButton: {
    backgroundColor: 'rgba(52, 199, 89, 0.8)',
    borderRadius: 16,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 20,
  },
  buyButtonInlineContainer: {
    marginTop: 15,
    alignItems: 'center',
  },
  buyButtonInline: {
    backgroundColor: 'rgba(52, 199, 89, 0.8)',
    borderRadius: 16,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  buyButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 4,
  },
  pocketBalanceContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  pocketBalanceLabel: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
  },
});

export default BalanceView;
