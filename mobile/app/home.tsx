import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import React, { useContext, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';

import BalanceView from '@/components/BalanceView';
import GradientScreen from '@/components/GradientScreen';
import LiquidTokensView from '@/components/LiquidTokensView';
import SwapInterfaceView from '@/components/SwapInterfaceView';
import { ThemedText } from '@/components/ThemedText';
import TokensView from '@/components/TokensView';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { Hello } from '@shared/class/hello';
import { getNetworkGradient, getNetworkIcon } from '@shared/constants/Colors';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getIsEVM, getIsTestnet } from '@shared/models/network-getters';
import { getSwapPairs } from '@shared/models/swap-providers-list';
import { NETWORK_ARKMUTINYNET, NETWORK_BITCOIN, NETWORK_LIGHTNING, NETWORK_LIGHTNINGTESTNET, NETWORK_LIQUID, NETWORK_LIQUIDTESTNET, NETWORK_SPARK } from '@shared/types/networks';
import { SwapPair, SwapPlatform } from '@shared/types/swap';
import { ActionPopupButton } from '@/components/ActionPopupButton';

export default function HomeScreen() {
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const router = useRouter();
  const params = useLocalSearchParams<{
    showSwapInterface?: string;
    fromNetwork?: string;
    toNetwork?: string;
    amount?: string;
  }>();
  const [swapPairs, setSwapPairs] = useState<SwapPair[]>([]);
  const [showSwapInterface, setShowSwapInterface] = useState<boolean>(false);

  useEffect(() => {
    if (params.showSwapInterface === 'true') {
      setShowSwapInterface(true);
    }
  }, [params.showSwapInterface]);

  useEffect(() => {
    setShowSwapInterface(false);
  }, [network]);

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
    router.push('/Receive');
  };

  const handleSwapClick = () => {
    setShowSwapInterface(true);
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

  const goToDAppBrowser = () => {
    router.push('/DAppBrowser');
  };

  const handleReceiveOnSpark = () => {
    if (network === NETWORK_LIGHTNINGTESTNET) {
      Alert.alert('Spark does not have a testnet');
    } else {
      router.push({ pathname: '/ReceiveLightning', params: { network: NETWORK_SPARK } });
    }
  };

  const handleReceiveOnLiquid = () => {
    if (network === NETWORK_LIGHTNINGTESTNET) {
      router.push({ pathname: '/ReceiveLightning', params: { network: NETWORK_LIQUIDTESTNET } });
    } else {
      router.push({ pathname: '/ReceiveLightning', params: { network: NETWORK_LIQUID } });
    }
  };

  const getLightningReceiveActions = () => [
    {
      label: 'Receive on Spark',
      onClick: handleReceiveOnSpark,
    },
    {
      label: 'Receive on Liquid',
      onClick: handleReceiveOnLiquid,
    },
    {
      label: 'Cancel',
      onClick: () => {},
    },
  ];

  const handleSendViaSpark = () => {
    if (network === NETWORK_LIGHTNINGTESTNET) {
      Alert.alert('Spark does not have a testnet');
    } else {
      router.push({ pathname: '/SendLightning', params: { network: NETWORK_SPARK } });
    }
  };

  const handleSendViaLiquid = () => {
    if (network === NETWORK_LIGHTNINGTESTNET) {
      router.push({ pathname: '/SendLightning', params: { network: NETWORK_LIQUIDTESTNET } });
    } else {
      router.push({ pathname: '/SendLightning', params: { network: NETWORK_LIQUID } });
    }
  };

  const getLightningSendActions = () => [
    {
      label: 'Send via Spark',
      onClick: handleSendViaSpark,
    },
    {
      label: 'Send via Liquid',
      onClick: handleSendViaLiquid,
    },
    {
      label: 'Cancel',
      onClick: () => {},
    },
  ];

  return (
    <GradientScreen variant={network}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerContainer}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>{Hello.world()}</ThemedText>
          </View>
          <TouchableOpacity style={styles.settingsButton} onPress={goToSettings} testID="SettingsButton">
            <Ionicons name="settings-outline" size={24} color="rgba(255, 255, 255, 0.8)" />
          </TouchableOpacity>
        </View>

        <View style={styles.networkContainer}>
          <TouchableOpacity onPress={() => router.push('/NetworkSelector')} testID="NetworkSwitcherTrigger" activeOpacity={0.6}>
            <Animated.View style={styles.networkCard} testID={`selectedNetwork-${network}`}>
              <View style={styles.networkCardTouchable}>
                <View
                  style={[
                    styles.networkIconContainer,
                    {
                      backgroundColor: getNetworkGradient(network)[0],
                    },
                  ]}
                >
                  <Ionicons name={getNetworkIcon(network)} size={24} color="white" />
                </View>

                <View style={styles.networkInfo}>
                  <ThemedText style={styles.networkCardTitle}>{network.charAt(0).toUpperCase() + network.slice(1)}</ThemedText>
                  <View style={styles.networkStatus}>
                    <View
                      style={[
                        styles.statusIndicator,
                        {
                          backgroundColor: getIsTestnet(network) ? '#F59E0B' : '#059669',
                        },
                      ]}
                    />
                    <ThemedText style={styles.networkCardSubtitle}>{getIsTestnet(network) ? 'Testnet' : 'Mainnet'}</ThemedText>
                  </View>
                </View>

                <TouchableOpacity onPress={() => router.push('/NetworkSelector')} onLongPress={() => router.push('/BackdoorNetworkSwitcher')} testID="BackdoorNetworkSwitcher">
                  <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.6)" />
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableOpacity>
        </View>

        <BalanceView network={network} accountNumber={accountNumber} BackgroundCaller={BackgroundExecutor} />

        {showSwapInterface ? (
          <SwapInterfaceView useRouterParams={false} initialAmount={params.amount} initialTargetNetwork={params.toNetwork as any} onClose={() => setShowSwapInterface(false)} />
        ) : (
          <>
            <View>{network === NETWORK_LIQUID || network === NETWORK_LIQUIDTESTNET ? <LiquidTokensView /> : <TokensView />}</View>

            <View style={styles.contentContainer}>
              <View style={styles.buttonContainer}>
                <View style={styles.buttonRow}>
                  {network === NETWORK_LIGHTNING || network === NETWORK_LIGHTNINGTESTNET ? (
                    <ActionPopupButton actions={getLightningReceiveActions()} testID="ReceiveButton" style={[styles.button, styles.receiveButton]}>
                      <ThemedText style={styles.buttonText}>
                        <Ionicons name="arrow-down" size={16} color="white" /> Receive
                      </ThemedText>
                    </ActionPopupButton>
                  ) : (
                    <TouchableOpacity style={[styles.button, styles.receiveButton]} onPress={goToReceive}>
                      <ThemedText style={styles.buttonText}>Receive</ThemedText>
                    </TouchableOpacity>
                  )}

                  {network === NETWORK_LIGHTNING || network === NETWORK_LIGHTNINGTESTNET ? (
                    <ActionPopupButton actions={getLightningSendActions()} testID="SendButton" style={[styles.button, styles.sendButton]}>
                      <ThemedText style={styles.buttonText}>
                        <Ionicons name="arrow-up" size={16} color="white" /> Send
                      </ThemedText>
                    </ActionPopupButton>
                  ) : (
                    <TouchableOpacity style={[styles.button, styles.sendButton]} onPress={goToSend}>
                      <ThemedText style={styles.buttonText}>Send</ThemedText>
                    </TouchableOpacity>
                  )}

                  {swapPairs.length > 0 ? (
                    <TouchableOpacity style={styles.button} onPress={handleSwapClick}>
                      <ThemedText style={styles.buttonText}>
                        <Ionicons name="refresh" size={16} color="white" /> Swap
                      </ThemedText>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <View style={styles.buttonRowWithGap}>
                  {getIsEVM(network) && (
                    <TouchableOpacity style={styles.button} onPress={goToDAppBrowser}>
                      <ThemedText style={styles.buttonText}>Browser</ThemedText>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingTop: 16,
    paddingBottom: 12,
  },
  header: {
    alignItems: 'flex-start',
    flex: 1,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 4,
    paddingBottom: 20,
  },
  buttonContainer: {
    marginTop: 20,
    width: '100%',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 8,
  },
  buttonRowWithGap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 8,
    marginTop: 8,
  },
  button: {
    backgroundColor: '#000000',
    borderRadius: 16,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  buttonText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  receiveButton: {
    backgroundColor: 'rgba(52, 199, 89, 0.8)',
  },
  sendButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
  },
  networkContainer: {
    marginVertical: 20,
  },
  networkCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
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
    color: 'rgba(255, 255, 255, 0.9)',
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
    color: 'rgba(255, 255, 255, 0.7)',
  },
  actionButton: {
    padding: 4,
  },
});
