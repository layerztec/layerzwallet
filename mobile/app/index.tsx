import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useContext, useEffect, useState } from 'react';
import { StyleSheet, Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import Button from '@/components/ui/Button';
import { NetworkSelector } from '@/components/ui/NetworkSelector';
import TokensView from '@/components/tokens-view';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { Hello } from '@shared/class/hello';
import { DEFAULT_NETWORK } from '@shared/config';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useBalance } from '@shared/hooks/useBalance';
import { getDecimalsByNetwork, getIsTestnet, getTickerByNetwork } from '@shared/models/network-getters';
import { formatBalance } from '@shared/modules/string-utils';
import { getAvailableNetworks, NETWORK_ARKMUTINYNET, NETWORK_BITCOIN, NETWORK_LIQUIDTESTNET, NETWORK_LIQUID } from '@shared/types/networks';
import { useTheme } from '@/hooks/ThemeContext';
import PartnersView from '@/components/PartnersView';

export default function IndexScreen() {
  const { getColor } = useTheme();
  const { network, setNetwork } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { balance } = useBalance(network ?? DEFAULT_NETWORK, accountNumber, BackgroundExecutor);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
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
          router.replace('/onboarding/encrypt-key');
          return;
        }

        if (!hasAcceptedTermsOfService) {
          router.replace('/onboarding/tos');
        }
      } catch (e) {
        console.log('Error checking mnemonic:', e);
      }
    };

    checkMnemonic();

    const getExchangeRate = async () => {
      try {
        const rate = await BackgroundExecutor.getExchangeRate(network === NETWORK_BITCOIN ? 'bitcoin' : network === NETWORK_ARKMUTINYNET ? 'bitcoin' : 'ethereum');
        setExchangeRate(rate);
      } catch (e) {
        console.log('Error getting exchange rate:', e);
      }
    };

    getExchangeRate();

    const interval = setInterval(getExchangeRate, 60000);
    return () => clearInterval(interval);
  }, [network, router]);

  const goToReceive = () => {
    router.push('/receive');
  };

  const goToSettings = () => {
    router.push('/settings');
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.headerContainer}>
          <ThemedView style={styles.header}>
            <ThemedText style={styles.title}>Welcome to LZW Mobile</ThemedText>
            <ThemedText style={styles.title}>{Hello.world()}</ThemedText>
            <ThemedText style={styles.subtitle}>Explore Bitcoin Layer 2</ThemedText>
          </ThemedView>
          <Pressable style={styles.settingsButton} onPress={goToSettings} testID="SettingsButton">
            <Ionicons name="settings-outline" size={24} color={getColor('settingsIcon')} />
          </Pressable>
        </ThemedView>

        <NetworkSelector selectedNetwork={network} onNetworkChange={setNetwork} filterLiquid={true} />

        {getIsTestnet(network) && (
          <ThemedView
            style={{
              backgroundColor: getColor({ lightColor: 'rgba(255, 0, 0, 0.1)', darkColor: 'rgba(255, 0, 0, 0.2)' }),
              padding: 10,
              borderRadius: 5,
              marginHorizontal: 20,
              marginVertical: 10,
            }}
          >
            <ThemedText
              style={{
                color: getColor('error'),
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
          <ThemedText style={styles.balanceText}>{balance ? formatBalance(balance, getDecimalsByNetwork(network)) + ' ' + getTickerByNetwork(network) : '???'}</ThemedText>
          <ThemedText style={{ fontSize: 16, lineHeight: 22 }}>
            {balance && +balance > 0 && exchangeRate ? '$' + (+formatBalance(balance, getDecimalsByNetwork(network), 8) * exchangeRate).toPrecision(2) : ''}
          </ThemedText>
        </ThemedView>

        <TokensView />
        <PartnersView />

        <ThemedView style={styles.contentContainer}>
          <ThemedView style={styles.buttonContainer}>
            <ThemedView style={styles.buttonRow}>
              <Button variant="primary" onPress={goToReceive} title="Receive" testID="ReceiveButton" size="large" iconName="arrow-down-outline" style={{ flex: 1 }} />
              <Button variant="primary" onPress={goToSend} title="Send" testID="SendButton" size="large" iconName="arrow-up-outline" style={{ flex: 1 }} />
            </ThemedView>
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
    padding: 0,
    margin: 0,
  },
  balanceText: {
    fontSize: 25,
    fontWeight: 'bold',
    textAlign: 'center',
    width: '100%',
    minHeight: 40,
    paddingVertical: 4,
    lineHeight: 36,
    paddingBottom: 4,
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
  buttonStack: {
    flexDirection: 'row',
    gap: 12,
  },
  networkButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
