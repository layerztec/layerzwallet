import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useContext, useEffect } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import TokensView from '@/components/tokens-view';
import PartnersView from '@/components/partners-view';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { Hello } from '@shared/class/hello';
import { DEFAULT_NETWORK } from '@shared/config';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useBalance } from '@shared/hooks/useBalance';
import { getDecimalsByNetwork, getIsTestnet, getTickerByNetwork } from '@shared/models/network-getters';
import { formatBalance } from '@shared/modules/string-utils';
import { getAvailableNetworks, NETWORK_ARKMUTINYNET, NETWORK_BITCOIN, NETWORK_LIQUIDTESTNET, NETWORK_LIQUID } from '@shared/types/networks';
import { useExchangeRate } from '@shared/hooks/useExchangeRate';
import { OnrampProps } from '@/app/Onramp';

export default function IndexScreen() {
  const { network, setNetwork } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { balance } = useBalance(network ?? DEFAULT_NETWORK, accountNumber, BackgroundExecutor);
  const { exchangeRate } = useExchangeRate(network ?? DEFAULT_NETWORK, 'USD');
  const router = useRouter();

  // Liquid is not available on mobile yet
  const networks = getAvailableNetworks().filter((n) => n !== NETWORK_LIQUIDTESTNET && n !== NETWORK_LIQUID);

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
    router.push('/receive');
  };

  const goToSend = () => {
    switch (network) {
      case NETWORK_BITCOIN:
        router.push('/SendBtc');
        break;
      case NETWORK_ARKMUTINYNET:
        router.push('/SendArk');
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
        } as OnrampProps,
      });
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.headerContainer}>
        <ThemedView style={styles.header}>
          <ThemedText style={styles.title}>Welcome to LZW Mobile</ThemedText>
          <ThemedText style={styles.title}>{Hello.world()}</ThemedText>
          <ThemedText style={styles.subtitle}>Explore Bitcoin Layer 2</ThemedText>
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
          {balance && +balance > 0 && exchangeRate ? '$' + (+formatBalance(balance, getDecimalsByNetwork(network), 8) * exchangeRate).toPrecision(2) : ''}
        </ThemedText>
      </ThemedView>

      <TokensView />

      <ThemedView style={styles.partnersSection} testID="PartnersView">
        <PartnersView />
      </ThemedView>

      <ThemedView style={styles.contentContainer}>
        <ThemedView style={styles.buttonContainer}>
          <ThemedView style={styles.buttonRow}>
            <TouchableOpacity style={[styles.button, styles.receiveButton]} onPress={goToReceive}>
              <ThemedText style={styles.buttonText}>Receive</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.button, styles.sendButton]} onPress={goToSend}>
              <ThemedText style={styles.buttonText}>Send</ThemedText>
            </TouchableOpacity>

            {network === NETWORK_BITCOIN ? (
              <TouchableOpacity style={[styles.button]} onPress={goToBuyBitcoin}>
                <ThemedText style={styles.buttonText}> $ Buy </ThemedText>
              </TouchableOpacity>
            ) : null}
          </ThemedView>
        </ThemedView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
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
  partnersSection: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
});
