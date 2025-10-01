import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext, useEffect, useRef } from 'react';
import { Alert, Animated, StyleSheet, TouchableOpacity, View } from 'react-native';

import { DappBrowserProps } from '@/app/DAppBrowser';
import { OnrampProps } from '@/app/Onramp';
import { ActionPopupButton } from '@/components/ActionPopupButton';
import Balance from '@/components/Balance';
import Button from '@/components/Button';
import GradientScreen from '@/components/GradientScreen';
import PlatformBlurView from '@/components/PlatformBlurView';
import StickyHeader from '@/components/StickyHeader';
import SwapList from '@/components/SwapList';
import { ThemedText } from '@/components/ThemedText';
import TokensView from '@/components/TokensView';
import Transaction from '@/components/Transaction';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { getNetworkImageAsset } from '@/utils/networkAssets';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useTransactions } from '@shared/hooks/useTransactions';
import { getExplorerUrlByNetwork, getIsEVM, getIsTestnet } from '@shared/models/network-getters';
import { getSwapPairs } from '@shared/models/swap-providers-list';
import { USDT_TOKENS } from '@shared/models/token-list';
import { capitalizeFirstLetter } from '@shared/modules/string-utils';
import { CommonTransaction } from '@shared/types/common-transaction';
import {
  NETWORK_ARK,
  NETWORK_ARK_MUTINYNET,
  NETWORK_BITCOIN,
  NETWORK_LIGHTNING,
  NETWORK_LIGHTNING_TESTNET,
  NETWORK_LIQUID,
  NETWORK_LIQUID_TESTNET,
  NETWORK_ROOTSTOCK,
  NETWORK_SPARK,
  NETWORK_USDT,
  Networks,
} from '@shared/types/networks';
import { SwapPlatform } from '@shared/types/swap';
import { ReceiveTokenProps } from './Receive';
import { SendLiquidParams } from './SendLiquid';
import { SendTokenEvmProps } from './SendTokenEvm';

const Action = ({ network, text }: { network?: Networks; text: string }) => {
  const networkImage = network ? getNetworkImageAsset(network) : null;
  const networkIconContent = networkImage ? <Image source={networkImage} style={styles.actionIconImage} contentFit="contain" /> : null;
  return (
    <View style={styles.action}>
      {networkIconContent && <View style={styles.actionIcon}>{networkIconContent}</View>}
      <ThemedText style={styles.actionText}>{text}</ThemedText>
    </View>
  );
};

export default function Home() {
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const router = useRouter();
  const params = useLocalSearchParams<{
    showSwapInterface?: string;
    fromNetwork?: string;
    toNetwork?: string;
    amount?: string;
  }>();
  const { transactions, error: transactionsError } = useTransactions(network, accountNumber, BackgroundExecutor);

  // URL parameter handling
  useEffect(() => {
    if (params.showSwapInterface === 'true') {
      router.push('/Swap');
    }
  }, [params.showSwapInterface, router]);

  // Scroll animation for sticky header
  const scrollY = useRef(new Animated.Value(0)).current;

  const isEVM = getIsEVM(network);
  const networkImage = getNetworkImageAsset(network);
  const networkIconContent = networkImage ? <Image source={networkImage} style={styles.networkImage} contentFit="contain" /> : null;
  const swapPairs = getSwapPairs(network, SwapPlatform.MOBILE);

  const latestTransactions = transactions?.slice(0, 3) || [];

  const handleSend = () => {
    switch (network) {
      case NETWORK_BITCOIN:
        router.push('/SendBtc');
        break;
      case NETWORK_ARK:
      case NETWORK_SPARK:
      case NETWORK_ARK_MUTINYNET:
        router.push('/SendArk');
        break;
      case NETWORK_LIQUID:
      case NETWORK_LIQUID_TESTNET:
        router.push('/SendLiquid');
        break;
      case NETWORK_LIGHTNING:
      case NETWORK_LIGHTNING_TESTNET:
        router.push('/SendLightning');
        break;
      default:
        router.push('/SendEvm');
    }
  };

  const handleReceive = () => {
    router.push('/Receive');
  };

  const handleSwap = () => {
    router.push('/Swap');
  };

  const handleNetworkSelect = () => {
    router.push('/NetworkSelector');
  };

  const goToSettings = () => {
    router.push('/Settings');
  };

  const handleTransactionHistory = () => {
    router.push('/Transactions');
  };

  const handleExplorer = () => {
    if (isEVM) {
      router.push('/DAppBrowser');
    } else {
      const explorerUrl = getExplorerUrlByNetwork(network);
      if (explorerUrl) {
        const params: DappBrowserProps = { url: explorerUrl };
        router.push({ pathname: '/DAppBrowser', params });
      } else {
        Alert.alert('Explorer', 'Explorer not available for this network');
      }
    }
  };

  // Lightning Network specific handlers
  const handleReceiveOnSpark = () => {
    if (network === NETWORK_LIGHTNING_TESTNET) {
      Alert.alert('Spark does not have a testnet');
    } else {
      router.push({ pathname: '/ReceiveLightning', params: { network: NETWORK_SPARK } });
    }
  };

  const handleReceiveOnLiquid = () => {
    const n = network === NETWORK_LIGHTNING_TESTNET ? NETWORK_LIQUID_TESTNET : NETWORK_LIQUID;
    router.push({ pathname: '/ReceiveLightning', params: { network: n } });
  };

  const handleReceiveOnArk = () => {
    if (network === NETWORK_LIGHTNING_TESTNET) {
      Alert.alert('Ark lightning does not have a testnet');
    } else {
      router.push({ pathname: '/ReceiveLightning', params: { network: NETWORK_ARK } });
    }
  };

  const lightningReceiveActions = [
    { children: <Action network={NETWORK_SPARK} text="Receive on Spark" />, onClick: handleReceiveOnSpark },
    { children: <Action network={NETWORK_LIQUID} text="Receive on Liquid" />, onClick: handleReceiveOnLiquid },
    { children: <Action network={NETWORK_ARK} text="Receive on Ark" />, onClick: handleReceiveOnArk },
    { children: <Action text="Cancel" />, onClick: () => {} },
  ];

  const handleSendViaSpark = () => {
    if (network === NETWORK_LIGHTNING_TESTNET) {
      Alert.alert('Spark does not have a testnet');
    } else {
      router.push({ pathname: '/SendLightning', params: { network: NETWORK_SPARK } });
    }
  };

  const handleSendViaArk = () => {
    if (network === NETWORK_LIGHTNING_TESTNET) {
      Alert.alert('Ark lightning does not have a testnet');
    } else {
      router.push({ pathname: '/SendLightning', params: { network: NETWORK_ARK } });
    }
  };

  const handleSendViaLiquid = () => {
    const n = network === NETWORK_LIGHTNING_TESTNET ? NETWORK_LIQUID_TESTNET : NETWORK_LIQUID;
    router.push({ pathname: '/SendLightning', params: { network: n } });
  };

  const handleTransactionDetails = (transaction: CommonTransaction) => {
    router.push({ pathname: '/TransactionDetails', params: { transaction: JSON.stringify(transaction) } });
  };

  const lightningSendActions = [
    { children: <Action network={NETWORK_SPARK} text="Send via Spark" />, onClick: handleSendViaSpark },
    { children: <Action network={NETWORK_LIQUID} text="Send via Liquid" />, onClick: handleSendViaLiquid },
    { children: <Action network={NETWORK_ARK} text="Send via Ark" />, onClick: handleSendViaArk },
    { children: <Action text="Cancel" />, onClick: () => {} },
  ];

  const handleSendUSDTViaRootstock = (contractAddress: string) => () => {
    const params: SendTokenEvmProps = { contractAddress, network: NETWORK_ROOTSTOCK };
    router.push({ pathname: '/SendTokenEvm', params });
  };

  const handleSendUSDTViaLiquid = () => {
    const params: SendLiquidParams = { assetId: USDT_TOKENS[NETWORK_LIQUID][0], network: NETWORK_LIQUID };
    router.push({ pathname: '/SendLiquid', params });
  };

  // USDT send and receive actions
  const usdtSendActions = [
    { children: <Action network={NETWORK_ROOTSTOCK} text="Send USDT via Rootstock" />, onClick: handleSendUSDTViaRootstock(USDT_TOKENS[NETWORK_ROOTSTOCK][0]) },
    { children: <Action network={NETWORK_ROOTSTOCK} text="Send USDT0 via Rootstock" />, onClick: handleSendUSDTViaRootstock(USDT_TOKENS[NETWORK_ROOTSTOCK][1]) },
    { children: <Action network={NETWORK_ROOTSTOCK} text="Send rUSDT via Rootstock" />, onClick: handleSendUSDTViaRootstock(USDT_TOKENS[NETWORK_ROOTSTOCK][2]) },
    { children: <Action network={NETWORK_LIQUID} text="Send USDT via Liquid" />, onClick: handleSendUSDTViaLiquid },
    { children: <Action text="Cancel" />, onClick: () => {} },
  ];

  const handleReceiveTokenViaRootstock = () => {
    const params: ReceiveTokenProps = { network: NETWORK_ROOTSTOCK };
    router.push({ pathname: '/Receive', params });
  };

  const handleReceiveTokenViaLiquid = () => {
    const params: ReceiveTokenProps = { network: NETWORK_LIQUID };
    router.push({ pathname: '/Receive', params });
  };

  const usdtReceiveActions = [
    { children: <Action network={NETWORK_ROOTSTOCK} text="Receive via Rootstock" />, onClick: handleReceiveTokenViaRootstock },
    { children: <Action network={NETWORK_LIQUID} text="Receive via Liquid" />, onClick: handleReceiveTokenViaLiquid },
    { children: <Action text="Cancel" />, onClick: () => {} },
  ];

  // Handle scroll events for sticky header animation
  const handleScroll = (event: any) => {
    scrollY.setValue(event.nativeEvent.contentOffset.y);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Sticky Header */}
      <StickyHeader scrollY={scrollY} onSettingsPress={goToSettings} />

      <GradientScreen variant={network} scroll={true} onScroll={handleScroll}>
        <View style={[styles.root, styles.contentWithHeader]}>
          {/* Network Selector */}
          <View style={styles.networkSelectorContainer}>
            <TouchableOpacity testID="NetworkSwitcherTrigger" style={styles.networkSelector} onPress={handleNetworkSelect} activeOpacity={0.8}>
              <View testID={`selectedNetwork-${network}`} style={styles.networkIcon}>
                {networkIconContent}
              </View>
              <ThemedText style={styles.networkName}>{capitalizeFirstLetter(network)}</ThemedText>
              <TouchableOpacity onPress={handleNetworkSelect} onLongPress={() => router.push('/BackdoorNetworkSwitcher')} testID="BackdoorNetworkSwitcher">
                <Ionicons name="chevron-down" size={20} color="rgba(255, 255, 255, 0.8)" />
              </TouchableOpacity>
            </TouchableOpacity>
          </View>

          {/* Testnet Warning */}
          {getIsTestnet(network) && (
            <View style={styles.testnetWarning}>
              <ThemedText style={styles.testnetWarningText}>Warning: You are using a testnet, coins have no value</ThemedText>
            </View>
          )}

          {/* Balance Section */}
          <Balance />

          {/* Explorer Button for EVM networks */}
          {isEVM && <Button title="🔍 Explore" onPress={handleExplorer} variant="dark" style={styles.explorerButton} testID="ExplorerButton" />}

          {/* Swap List Section */}
          <SwapList />

          {/* Tokens Section */}
          <TokensView />

          {/* Transactions Section */}
          <View style={styles.transactionsContainer}>
            <ThemedText style={styles.transactionsTitle}>Latest Transactions</ThemedText>

            {latestTransactions.length > 0 ? (
              <View style={styles.transactionsList}>
                {latestTransactions.map((transaction) => (
                  <Transaction key={transaction.txid} transaction={transaction} onPress={() => handleTransactionDetails(transaction)} />
                ))}
              </View>
            ) : transactionsError ? (
              <View style={styles.transactionsList}>
                <ThemedText style={styles.transactionDate}>Error loading transactions</ThemedText>
              </View>
            ) : (
              <View style={styles.transactionsList}>
                <ThemedText style={styles.transactionDate}>No transactions yet</ThemedText>
              </View>
            )}

            <Button title="Transaction History" onPress={handleTransactionHistory} variant="dark" />
          </View>

          {/* Bottom spacing for navigation */}
          <View style={styles.bottomSpacer} />
        </View>
      </GradientScreen>

      {/* Bottom Navigation */}
      <View style={styles.bottomNavigation}>
        <View style={styles.navContainer}>
          <PlatformBlurView intensity={20} tint="dark" style={styles.navBlur} />

          {network === NETWORK_LIGHTNING || network === NETWORK_LIGHTNING_TESTNET ? (
            <ActionPopupButton actions={lightningSendActions} title="Layer to send">
              <TouchableOpacity style={styles.navButtonLarge} testID="SendButton" activeOpacity={0.8}>
                <MaterialIcons name="call-made" size={24} color="rgba(255, 255, 255, 0.8)" />
                <ThemedText style={styles.navButtonText}>Send</ThemedText>
              </TouchableOpacity>
            </ActionPopupButton>
          ) : network === NETWORK_USDT ? (
            <ActionPopupButton actions={usdtSendActions} title="Layer to send">
              <TouchableOpacity style={styles.navButtonLarge} testID="SendButton" activeOpacity={0.8}>
                <MaterialIcons name="call-made" size={24} color="rgba(255, 255, 255, 0.8)" />
                <ThemedText style={styles.navButtonText}>Send</ThemedText>
              </TouchableOpacity>
            </ActionPopupButton>
          ) : (
            <TouchableOpacity style={styles.navButtonLarge} testID="SendButton" onPress={handleSend} activeOpacity={0.8}>
              <MaterialIcons name="call-made" size={24} color="rgba(255, 255, 255, 0.8)" />
              <ThemedText style={styles.navButtonText}>Send</ThemedText>
            </TouchableOpacity>
          )}

          {network === NETWORK_LIGHTNING || network === NETWORK_LIGHTNING_TESTNET ? (
            <ActionPopupButton actions={lightningReceiveActions} title="Layer to receive">
              <TouchableOpacity style={styles.navButtonLarge} testID="ReceiveButton" activeOpacity={0.8}>
                <MaterialIcons name="call-received" size={24} color="rgba(255, 255, 255, 0.8)" />
                <ThemedText style={styles.navButtonText}>Receive</ThemedText>
              </TouchableOpacity>
            </ActionPopupButton>
          ) : network === NETWORK_USDT ? (
            <ActionPopupButton actions={usdtReceiveActions} title="Layer to receive">
              <TouchableOpacity style={styles.navButtonLarge} testID="ReceiveButton" activeOpacity={0.8}>
                <MaterialIcons name="call-received" size={24} color="rgba(255, 255, 255, 0.8)" />
                <ThemedText style={styles.navButtonText}>Receive</ThemedText>
              </TouchableOpacity>
            </ActionPopupButton>
          ) : (
            <TouchableOpacity style={styles.navButtonLarge} testID="ReceiveButton" onPress={handleReceive} activeOpacity={0.8}>
              <MaterialIcons name="call-received" size={24} color="rgba(255, 255, 255, 0.8)" />
              <ThemedText style={styles.navButtonText}>Receive</ThemedText>
            </TouchableOpacity>
          )}
        </View>

        {swapPairs.length > 0 && (
          <View style={styles.swapButton}>
            <PlatformBlurView intensity={40} tint="light" style={styles.navBlur} />
            <TouchableOpacity style={styles.swapButtonInner} onPress={handleSwap} activeOpacity={0.8} testID="SwapButton">
              <Ionicons name="swap-horizontal" size={22} color="rgba(255, 255, 255, 0.8)" />
              <ThemedText style={styles.navButtonText}>Swap</ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 18,
    paddingBottom: 100,
  },
  contentWithHeader: {
    paddingTop: 80,
  },
  networkSelectorContainer: {
    alignSelf: 'flex-start',
    marginTop: 0,
  },
  networkSelector: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 16,
    marginBottom: 16,
  },
  networkIcon: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  networkName: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    marginHorizontal: 8,
  },
  networkImage: {
    width: 24,
    height: 24,
  },
  explorerButton: {
    marginBottom: 20,
  },
  transactionsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    overflow: 'hidden',
  },
  transactionsTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: 'white',
    textAlign: 'center',
    marginBottom: 24,
  },
  transactionsList: {
    gap: 24,
    marginBottom: 24,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionIcon: {
    width: 24,
    height: 24,
  },
  transactionDetails: {
    flex: 1,
    marginLeft: 16,
  },
  transactionType: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 6,
  },
  transactionDate: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  transactionAmounts: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 6,
  },
  transactionUsd: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '500',
  },
  bottomSpacer: {
    height: 20,
  },
  bottomNavigation: {
    position: 'absolute',
    bottom: 0,
    left: 18,
    right: 18,
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 34, // Safe area padding
  },
  navContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 40,
    height: 68,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  navButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'center',
    height: '100%',
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  swapButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 40,
    height: 68,
    width: 121,
    overflow: 'hidden',
  },
  swapButtonInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  navBlur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  testnetWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  testnetWarningText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lockScreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  lockScreenBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockScreenContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  lockIconContainer: {
    marginBottom: 20,
    transform: [{ scale: 1 }],
  },
  lockScreenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 20,
    marginBottom: 12,
  },
  lockScreenSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  unlockButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    fontSize: 16,
    color: 'white',
  },
  actionIcon: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconImage: {
    width: 24,
    height: 24,
    color: 'white',
  },
});
