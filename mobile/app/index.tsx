import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useContext, useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import '../src/modules/breeze-adapter'; // needed to be imported before we can use BreezWallet
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
import { getAvailableNetworks, NETWORK_ARKMUTINYNET, NETWORK_BITCOIN, NETWORK_BREEZ, NETWORK_BREEZTESTNET } from '@shared/types/networks';
import { SwapPair } from '@shared/types/swap';
import { useExchangeRate } from '@shared/hooks/useExchangeRate';
import { OnrampProps } from '@/app/Onramp';
import BreezTokensView from '@/components/BreezTokensView';
import { fiatOnRamp } from '@shared/models/fiat-on-ramp';

export default function IndexScreen() {
  const { network, setNetwork } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { balance } = useBalance(network, accountNumber, BackgroundExecutor);
  const { exchangeRate } = useExchangeRate(network, 'USD');
  const router = useRouter();
  const [swapPairs, setSwapPairs] = useState<SwapPair[]>([]);
  const [showSwapInterface, setShowSwapInterface] = useState<boolean>(false);
  const networks = getAvailableNetworks();

  useEffect(() => {
    setSwapPairs(getSwapPairs(network));
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
    if (network === NETWORK_BREEZ || network === NETWORK_BREEZTESTNET) {
      router.push('/ReceiveBreez');
      return;
    }

    router.push('/Receive');
  };

  const goToSend = () => {
    switch (network) {
      case NETWORK_BITCOIN:
        router.push('/SendBtc');
        break;
      case NETWORK_ARKMUTINYNET:
        router.push('/SendArk');
        break;
      case NETWORK_BREEZ:
      case NETWORK_BREEZTESTNET:
        router.push('/SendBreez');
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
          {networks.map((availableNetwork) => (
            <TouchableOpacity
              key={availableNetwork}
              testID={network === availableNetwork ? `selectedNetwork-${availableNetwork}` : `network-${availableNetwork}`}
              style={[styles.networkButton, network === availableNetwork && styles.selectedNetworkButton]}
              onPress={() => setNetwork(availableNetwork)}
            >
              <ThemedText style={[styles.networkButtonText, network === availableNetwork && styles.selectedNetworkButtonText]}>{availableNetwork.toUpperCase()}</ThemedText>
            </TouchableOpacity>
          ))}
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
          <ThemedText style={styles.balanceText} adjustsFontSizeToFit numberOfLines={1}>
            {balance ? formatBalance(balance, getDecimalsByNetwork(network)) + ' ' + getTickerByNetwork(network) : '???'}
          </ThemedText>
          <ThemedText adjustsFontSizeToFit numberOfLines={1}>
            {balance && +balance > 0 && exchangeRate ? '$' + formatFiatBalance(balance, getDecimalsByNetwork(network), exchangeRate) : ''}
          </ThemedText>
        </ThemedView>

        {showSwapInterface ? <SwapInterfaceView /> : <ThemedView>{network === NETWORK_BREEZ || network === NETWORK_BREEZTESTNET ? <BreezTokensView /> : <TokensView />}</ThemedView>}

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
    paddingVertical: 30,
    marginTop: 0,
    marginBottom: 0,
    paddingHorizontal: 20,
  },
  balanceText: {
    fontSize: 25,
    fontWeight: 'bold',
    textAlign: 'center',
    width: '100%',
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    padding: 10,
    gap: 8,
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
