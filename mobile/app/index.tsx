import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useContext, useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';

import '../src/modules/breeze-adapter'; // needed to be imported before we can use BreezWallet
import '../src/modules/spark-adapter'; // needed to be imported before we can use SparkWallet
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import TokensView from '@/components/TokensView';
import SwapInterfaceView from '@/components/SwapInterfaceView';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { Hello } from '@shared/class/hello';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useBalance } from '@shared/hooks/useBalance';
import { getDecimalsByNetwork, getIsTestnet, getTickerByNetwork } from '@shared/models/network-getters';
import { getSwapPairs } from '@shared/models/swap-providers-list';
import { formatBalance, formatFiatBalance } from '@shared/modules/string-utils';
import { NETWORK_ARKMUTINYNET, NETWORK_BITCOIN, NETWORK_LIGHTNING, NETWORK_LIGHTNINGTESTNET, NETWORK_LIQUID, NETWORK_LIQUIDTESTNET, NETWORK_SPARK } from '@shared/types/networks';
import { SwapPair, SwapPlatform } from '@shared/types/swap';
import { useExchangeRate } from '@shared/hooks/useExchangeRate';
import { OnrampProps } from '@/app/Onramp';
import LiquidTokensView from '@/components/LiquidTokensView';
import { fiatOnRamp } from '@shared/models/fiat-on-ramp';
import { getNetworkGradient, getNetworkIcon } from '@shared/constants/Colors';

export default function IndexScreen() {
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { balance } = useBalance(network, accountNumber, BackgroundExecutor);
  const { exchangeRate } = useExchangeRate(network, 'USD');
  const router = useRouter();
  const [swapPairs, setSwapPairs] = useState<SwapPair[]>([]);
  const [showSwapInterface, setShowSwapInterface] = useState<boolean>(false);

  useEffect(() => {
    setSwapPairs(getSwapPairs(network, SwapPlatform.MOBILE));
    setShowSwapInterface(false);
  }, [network]);

  useEffect(() => {
    const checkMnemonic = async () => {
      try {
        const hasMnemonic = await BackgroundExecutor.hasMnemonic();
        const hasAcceptedTermsOfService = await BackgroundExecutor.hasAcceptedTermsOfService();
        const hasEncryptedMnemonic = await BackgroundExecutor.hasEncryptedMnemonic();
        if (!hasMnemonic) {
          router.replace('/onboarding/intro');
          return;
        }

        if (!hasEncryptedMnemonic) {
          router.replace('/onboarding/create-password');
          return;
        }

        if (!hasAcceptedTermsOfService) {
          router.replace('/onboarding/tos');
          return;
        }
      } catch (error) {
        console.error('Error:', error);
      }
    };

    checkMnemonic();
  }, [router]);

  const goToSettings = () => {
    router.push('/settings');
  };

  const goToReceive = () => {
    switch (network) {
      case NETWORK_LIGHTNING:
      case NETWORK_LIGHTNINGTESTNET:
        router.push('/ReceiveLightning');
        break;
      default:
        router.push('/Receive');
    }
  };

  const goToSend = () => {
    switch (network) {
      case NETWORK_BITCOIN:
        router.push('/SendBtc');
        break;
      case NETWORK_SPARK:
      case NETWORK_ARKMUTINYNET:
        router.push('/SendArk');
        break;
      case NETWORK_LIQUID:
      case NETWORK_LIQUIDTESTNET:
        router.push('/SendLiquid');
        break;
      case NETWORK_LIGHTNING:
      case NETWORK_LIGHTNINGTESTNET:
        router.push('/SendLightning');
        break;
      default:
        router.push('/SendEvm');
    }
  };

  const goToBuyBitcoin = () => {
    BackgroundExecutor.getAddress(network, accountNumber).then((address) => {
      router.push('/Onramp');

      router.replace({
        pathname: '/Onramp',
        params: {
          address,
          network,
        } as OnrampProps,
      });
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.headerContainer}>
          <ThemedView style={styles.header}>
            <ThemedText style={styles.title}>{Hello.world()}</ThemedText>
          </ThemedView>
          <TouchableOpacity style={styles.settingsButton} onPress={goToSettings} testID="SettingsButton">
            <Ionicons name="settings-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        </ThemedView>

        <ThemedView style={styles.networkContainer}>
          <TouchableOpacity onPress={() => router.push('/NetworkSelector')} testID="NetworkSwitcherTrigger" activeOpacity={0.6}>
            <Animated.View style={styles.networkCard} testID={`selectedNetwork-${network}`}>
              <ThemedView style={styles.networkCardTouchable}>
                <ThemedView
                  style={[
                    styles.networkIconContainer,
                    {
                      backgroundColor: getNetworkGradient(network)[0],
                    },
                  ]}
                >
                  <Ionicons name={getNetworkIcon(network)} size={24} color="white" />
                </ThemedView>

                <ThemedView style={styles.networkInfo}>
                  <ThemedText style={styles.networkCardTitle}>{network.charAt(0).toUpperCase() + network.slice(1)}</ThemedText>
                  <ThemedView style={styles.networkStatus}>
                    <ThemedView
                      style={[
                        styles.statusIndicator,
                        {
                          backgroundColor: getIsTestnet(network) ? '#F59E0B' : '#059669',
                        },
                      ]}
                    />
                    <ThemedText style={styles.networkCardSubtitle}>{getIsTestnet(network) ? 'Testnet' : 'Mainnet'}</ThemedText>
                  </ThemedView>
                </ThemedView>

                <ThemedView style={styles.actionButton}>
                  <Ionicons name="chevron-forward" size={20} color="#6B7280" />
                </ThemedView>
              </ThemedView>
            </Animated.View>
          </TouchableOpacity>
        </ThemedView>

        {getIsTestnet(network) && (
          <ThemedView
            style={{
              backgroundColor: 'rgba(255, 0, 0, 0.1)',
              padding: 10,
              borderRadius: 5,
              marginHorizontal: 20,
              marginVertical: 10,
            }}
          >
            <ThemedText
              style={{
                color: 'red',
                fontSize: 10,
                textAlign: 'center',
                fontWeight: 'bold',
              }}
            >
              Warning: You are using a testnet, coins have no value
            </ThemedText>
          </ThemedView>
        )}

        <ThemedView style={styles.balanceContainer}>
          <ThemedText style={styles.balanceLabel}>Pocket Balance:</ThemedText>
          <ThemedText style={styles.balanceText} adjustsFontSizeToFit numberOfLines={1}>
            {balance ? formatBalance(balance, getDecimalsByNetwork(network)) + ' ' + getTickerByNetwork(network) : '???'}
          </ThemedText>
          <ThemedText style={styles.balanceLabel} testID="LayerBalance">
            Layer Balance:
          </ThemedText>
          <ThemedText style={styles.balanceText} adjustsFontSizeToFit numberOfLines={1}>
            {balance ? formatBalance(balance, getDecimalsByNetwork(network)) + ' ' + getTickerByNetwork(network) : '???'}
          </ThemedText>
          <ThemedText adjustsFontSizeToFit numberOfLines={1}>
            {balance && +balance > 0 && exchangeRate ? '$' + formatFiatBalance(balance, getDecimalsByNetwork(network), exchangeRate) : ''}
          </ThemedText>
        </ThemedView>

        {showSwapInterface ? <SwapInterfaceView /> : <ThemedView>{network === NETWORK_LIQUID || network === NETWORK_LIQUIDTESTNET ? <LiquidTokensView /> : <TokensView />}</ThemedView>}

        <ThemedView style={styles.contentContainer}>
          <ThemedView style={styles.buttonContainer}>
            <ThemedView style={styles.buttonRow}>
              <TouchableOpacity style={[styles.button, styles.receiveButton]} onPress={goToReceive}>
                <ThemedText style={styles.buttonText}>Receive</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.button, styles.sendButton]} onPress={goToSend}>
                <ThemedText style={styles.buttonText}>Send</ThemedText>
              </TouchableOpacity>

              {fiatOnRamp?.[network]?.canBuyWithFiat ? (
                <TouchableOpacity style={[styles.button]} onPress={goToBuyBitcoin}>
                  <ThemedText style={styles.buttonText}> $ Buy </ThemedText>
                </TouchableOpacity>
              ) : null}

              {swapPairs.length > 0 ? (
                <TouchableOpacity style={[styles.button]} onPress={() => setShowSwapInterface(true)}>
                  <ThemedText style={styles.buttonText}>
                    <Ionicons name="refresh" size={16} color="white" /> Swap
                  </ThemedText>
                </TouchableOpacity>
              ) : null}
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 20,
  },
  header: {
    padding: 20,
    alignItems: 'center',
    flex: 1,
  },
  settingsButton: {
    padding: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
  },
  balanceContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    marginTop: 0,
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  balanceLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    opacity: 0.8,
  },
  balanceText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    width: '100%',
    marginBottom: 4,
  },
  contentContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContainer: {
    marginTop: 20,
    width: '100%',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  receiveButton: {
    backgroundColor: '#34C759',
  },
  sendButton: {
    backgroundColor: '#FF3B30',
  },
  networkContainer: {
    marginHorizontal: 20,
    marginVertical: 10,
  },
  networkCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  networkCardTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  networkIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  networkInfo: {
    flex: 1,
    gap: 4,
  },
  networkCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  networkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  networkCardSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  actionButton: {
    padding: 4,
  },
  currentNetworkText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
    flex: 1,
  },
  networkButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 4,
    marginVertical: 4,
  },
  selectedNetworkButton: {
    backgroundColor: '#007AFF',
  },
  networkButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  selectedNetworkButtonText: {
    color: 'white',
  },
  scrollContent: {
    flexGrow: 1,
  },
});
