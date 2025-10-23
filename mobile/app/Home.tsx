import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { Alert, Dimensions, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import PagerView from 'react-native-pager-view';
import { scheduleOnRN } from 'react-native-worklets';
import Rive, { RiveRef } from 'rive-react-native';

import { DappBrowserProps } from '@/app/DAppBrowser';
import { ActionPopupButton } from '@/components/ActionPopupButton';
import Balance from '@/components/Balance';
import Button from '@/components/Button';
import DashboardTiles, { LayerCard } from '@/components/DashboardTiles';
import GradientScreen from '@/components/GradientScreen';
import PlatformBlurView from '@/components/PlatformBlurView';
import StickyHeader from '@/components/StickyHeader';
import SwapList from '@/components/SwapList';
import { ThemedText } from '@/components/ThemedText';
import TokensView from '@/components/TokensView';
import Transaction from '@/components/Transaction';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { getNetworkImageAsset } from '@/utils/networkAssets';
import { getNetworkGradient } from '@shared/constants/Colors';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useAvailableNetworks } from '@shared/hooks/useAvailableNetworks';
import { useTransactions } from '@shared/hooks/useTransactions';
import { getExplorerUrlByNetwork, getIsEVM, getIsTestnet, getTickerByNetwork } from '@shared/models/network-getters';
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
import { SO_LIQUID_USDT, SO_ROOTSTOCK_USDT, SwapPlatform } from '@shared/types/swap';
import { ReceiveTokenProps } from './Receive';
import { SendLightningProps } from './SendLightning';
import { SendLiquidParams } from './SendLiquid';
import { SendTokenEvmProps } from './SendTokenEvm';
import { SwapParams } from './Swap';

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

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_MIN_HEIGHT = 120; // Height when dragged down (header + some content)
const MODAL_MAX_HEIGHT = SCREEN_HEIGHT; // Full height modal

export type HomeProps = {
  showSwapInterface?: string;
  fromNetwork?: string;
  toNetwork?: string;
  amount?: string;
  fromOnboarding?: string;
};

export default function Home() {
  const { network, setNetwork } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const router = useRouter();
  const params = useLocalSearchParams<HomeProps>();
  const { transactions, error: transactionsError } = useTransactions(network, accountNumber, BackgroundExecutor);
  const scrollY = useSharedValue(0); // Scroll animation for sticky header
  const modalTranslateY = useSharedValue(0); // Modal state and animations
  const currentModalPosition = useSharedValue(0); // Track current modal position using shared value
  const gestureStartPosition = useSharedValue(0); // Track gesture start position using shared value
  const whiteFlashAnim = useSharedValue(0); // Animation for white flash transition
  const riveRef = useRef<RiveRef>(null); // Ref for Rive animation
  const currentNetworkIndex = useRef<number>(0); // Track current network index
  const pagerRef = useRef<any>(null);

  // Initialize modal position based on whether coming from onboarding
  useEffect(() => {
    if (params.fromOnboarding === 'true') {
      const maxTranslate = MODAL_MAX_HEIGHT - MODAL_MIN_HEIGHT;
      modalTranslateY.value = maxTranslate;
      currentModalPosition.value = maxTranslate;
    }
  }, [params.fromOnboarding, modalTranslateY, currentModalPosition]);

  // Handle page selected: change network with white flash
  const onPageSelected = (e: any) => {
    const idx = e?.nativeEvent?.position;
    if (typeof idx !== 'number') return;
    const selectedNetwork = networks[idx];
    if (!selectedNetwork) return;

    // perform same transition as tapping a card
    const flashDuration = 150;
    whiteFlashAnim.value = withTiming(1, { duration: flashDuration }, () => {
      whiteFlashAnim.value = withTiming(0, { duration: flashDuration }, () => {
        currentModalPosition.value = 0;
        modalTranslateY.value = withTiming(0, { duration: 400 });
      });
      scheduleOnRN(setNetwork, selectedNetwork);
    });
    currentNetworkIndex.current = idx;
  };

  // Animated styles
  const modalAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: modalTranslateY.value }] }));
  const whiteFlashAnimatedStyle = useAnimatedStyle(() => ({ opacity: whiteFlashAnim.value }));

  // URL parameter handling
  useEffect(() => {
    if (params.showSwapInterface === 'true') {
      router.push('/Swap');
    }
  }, [params.showSwapInterface, router]);

  const isEVM = getIsEVM(network);
  const networkImage = getNetworkImageAsset(network);
  const networkIconContent = networkImage ? <Image source={networkImage} style={styles.networkImage} contentFit="contain" /> : null;
  const latestTransactions = transactions?.slice(0, 3) || [];

  // Network cards for the black background area
  const networks = useAvailableNetworks();

  useEffect(() => {
    const index = networks.findIndex((n) => n === network);
    if (index !== -1) {
      currentNetworkIndex.current = index;
    }
  }, [network, networks]);
  useEffect(() => {
    const index = networks.findIndex((n) => n === network);
    if (index !== -1 && pagerRef.current && typeof pagerRef.current.setPage === 'function') {
      try {
        pagerRef.current.setPage(index);
      } catch (e) {
        console.error('Error setting pager page:', e);
      }
    }
  }, [network, networks]);
  const networkCards: LayerCard[] = useMemo(() => {
    return networks.map((networkItem) => {
      const isTestnet = getIsTestnet(networkItem);
      const gradientColors = getNetworkGradient(networkItem);
      const networkIcon = getNetworkImageAsset(networkItem);

      return {
        networkId: networkItem,
        name: capitalizeFirstLetter(networkItem),
        ticker: getTickerByNetwork(networkItem),
        balance: network === networkItem ? 'Selected' : 'Available',
        usdValue: isTestnet ? 'Testnet' : 'Mainnet',
        color: gradientColors[0],
        icon: networkIcon,
        tags: isTestnet ? ['Testnet'] : [],
        tokenCount: 0,
      };
    });
  }, [networks, network]);

  const swapEnabled = useMemo(() => {
    if (network === NETWORK_USDT) {
      return Boolean(getSwapPairs(SO_LIQUID_USDT, SwapPlatform.MOBILE) || getSwapPairs(SO_ROOTSTOCK_USDT, SwapPlatform.MOBILE));
    }
    const swapPairs = getSwapPairs(network, SwapPlatform.MOBILE);
    return swapPairs.length > 0;
  }, [network]);

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

  const handleSwapTokenViaLiquid = useCallback(() => {
    const params: SwapParams = { fromNetwork: SO_LIQUID_USDT };
    router.push({ pathname: '/Swap', params });
  }, [router]);

  const handleSwapTokenViaRootstock = useCallback(() => {
    const params: SwapParams = { fromNetwork: SO_ROOTSTOCK_USDT };
    router.push({ pathname: '/Swap', params });
  }, [router]);

  const handleNetworkCardPress = (index: number) => {
    if (index >= 0 && index < networks.length) {
      const selectedNetwork = networks[index];
      // Create white flash transition effect
      const flashDuration = 150;
      whiteFlashAnim.value = withTiming(1, { duration: flashDuration }, () => {
        whiteFlashAnim.value = withTiming(0, { duration: flashDuration }, () => {
          // After flash animation completes, expand modal to full height
          currentModalPosition.value = 0;
          modalTranslateY.value = withTiming(0, { duration: 400 });
        });
        scheduleOnRN(setNetwork, selectedNetwork);
      });
    }
  };

  const handleNetworkSelect = () => {
    // Minimize modal to show network tiles in black background area
    const maxTranslate = MODAL_MAX_HEIGHT - MODAL_MIN_HEIGHT;
    currentModalPosition.value = maxTranslate;
    modalTranslateY.value = withTiming(maxTranslate, { duration: 300 });
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
      const params: SendLightningProps = { network: NETWORK_SPARK };
      router.push({ pathname: '/SendLightning', params });
    }
  };

  const handleSendViaArk = () => {
    if (network === NETWORK_LIGHTNING_TESTNET) {
      Alert.alert('Ark lightning does not have a testnet');
    } else {
      const params: SendLightningProps = { network: NETWORK_ARK };
      router.push({ pathname: '/SendLightning', params });
    }
  };

  const handleSendViaLiquid = () => {
    const n = network === NETWORK_LIGHTNING_TESTNET ? NETWORK_LIQUID_TESTNET : NETWORK_LIQUID;
    const params: SendLightningProps = { network: n };
    router.push({ pathname: '/SendLightning', params });
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

  const usdtSwapActions = useMemo(() => {
    const actions = [];
    if (getSwapPairs(SO_LIQUID_USDT, SwapPlatform.MOBILE).length > 0) {
      actions.push({ children: <Action network={NETWORK_LIQUID} text="Swap USDT on Liquid" />, onClick: handleSwapTokenViaLiquid });
    }
    if (getSwapPairs(SO_ROOTSTOCK_USDT, SwapPlatform.MOBILE).length > 0) {
      actions.push({ children: <Action network={NETWORK_ROOTSTOCK} text="Swap USDT on Rootstock" />, onClick: handleSwapTokenViaRootstock });
    }
    actions.push({ children: <Action text="Cancel" />, onClick: () => {} });
    return actions;
  }, [handleSwapTokenViaLiquid, handleSwapTokenViaRootstock]);

  // Handle scroll events for sticky header animation
  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Modal gesture handling with bounds using new Gesture API
  const panGesture = Gesture.Pan()
    .onStart(() => {
      // Store the current modal position when gesture starts
      gestureStartPosition.value = modalTranslateY.value;
    })
    .onUpdate((event) => {
      const { translationY } = event;
      const maxTranslate = MODAL_MAX_HEIGHT - MODAL_MIN_HEIGHT;

      // Calculate new position based on gesture start position + translation
      const newPosition = gestureStartPosition.value + translationY;

      // Constrain position between 0 and maxTranslate
      let constrainedPosition = newPosition;
      if (newPosition < 0) {
        constrainedPosition = 0;
      } else if (newPosition > maxTranslate) {
        constrainedPosition = maxTranslate;
      }

      modalTranslateY.value = constrainedPosition;
    })
    .onEnd((event) => {
      const { translationY, velocityY } = event;
      const maxTranslate = MODAL_MAX_HEIGHT - MODAL_MIN_HEIGHT;

      // Determine if we should snap to min or max based on velocity and position
      const shouldSnapToMin = translationY > 100 || velocityY > 500;

      if (shouldSnapToMin) {
        // Snap to minimized state (translate down so only header is visible)
        currentModalPosition.value = maxTranslate;
        modalTranslateY.value = withTiming(maxTranslate, { duration: 300 });
      } else {
        // Snap to expanded state (translate back to original position)
        currentModalPosition.value = 0;
        modalTranslateY.value = withTiming(0, { duration: 300 });
      }
    })
    .activeOffsetY([-10, 10])
    .failOffsetX([-50, 50]);

  return (
    <GestureHandlerRootView style={styles.gestureHandlerRoot}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Black Background with Network Tiles */}
      <View style={styles.blackBackground}>
        <DashboardTiles cards={networkCards} onCardPress={handleNetworkCardPress} showLogo={true} />
      </View>

      {/* Modal Container */}
      <Animated.View style={[styles.modalContainer, { height: MODAL_MAX_HEIGHT }, modalAnimatedStyle]}>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={styles.draggableHeader}>
            <StickyHeader scrollY={scrollY} onSettingsPress={goToSettings} />
          </Animated.View>
        </GestureDetector>

        {/* Invisible Settings Button for Maestro Testing */}
        <TouchableOpacity style={styles.maestroSettingsButton} onPress={goToSettings} testID="SettingsButton" accessibilityLabel="Settings" />

        <GradientScreen variant={network} scroll={true} onScroll={handleScroll}>
          <View style={[styles.root, styles.contentWithHeader]}>
            <PagerView ref={pagerRef} style={styles.pagerOverlay} initialPage={currentNetworkIndex.current} onPageSelected={onPageSelected} overScrollMode="never">
              {networks.map((n, i) => (
                <View key={`pager-${n}`} style={styles.pagerPage} accessible={false} importantForAccessibility="no-hide-descendants" />
              ))}
            </PagerView>
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
                  <View style={styles.emptyTransactionsContainer}>
                    <Rive
                      key={`transactions-${network}`}
                      ref={riveRef}
                      autoplay={true}
                      style={styles.emptyTransactionsAnimation}
                      resourceName="transactions"
                      onError={(error) => {
                        console.log('Rive animation error:', error);
                      }}
                    />
                    <ThemedText style={styles.transactionDate}>No transactions yet. Start by tapping receive and do your first transaction.</ThemedText>
                  </View>
                </View>
              )}

              {latestTransactions.length > 0 && <Button title="Transaction History" onPress={handleTransactionHistory} variant="dark" />}
            </View>
          </View>
        </GradientScreen>

        {/* White Flash Overlay for Network Transition */}
        <Animated.View style={[styles.whiteFlashOverlayAnimated, whiteFlashAnimatedStyle]} />

        {/* Bottom Navigation - Fixed to modal bottom */}
        <View style={styles.bottomNavigationContainer}>
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

            {swapEnabled && (
              <View style={styles.swapButton}>
                <PlatformBlurView intensity={40} tint="light" style={styles.navBlur} />
                {network === NETWORK_USDT ? (
                  <ActionPopupButton actions={usdtSwapActions} title="Choose network to swap">
                    <TouchableOpacity style={styles.swapButtonInner} activeOpacity={0.8} testID="SwapButton">
                      <Ionicons name="swap-horizontal" size={22} color="rgba(255, 255, 255, 0.8)" />
                      <ThemedText style={styles.navButtonText}>Swap</ThemedText>
                    </TouchableOpacity>
                  </ActionPopupButton>
                ) : (
                  <TouchableOpacity style={styles.swapButtonInner} onPress={handleSwap} activeOpacity={0.8} testID="SwapButton">
                    <Ionicons name="swap-horizontal" size={22} color="rgba(255, 255, 255, 0.8)" />
                    <ThemedText style={styles.navButtonText}>Swap</ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  blackBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'black',
    flex: 1,
    paddingHorizontal: 16,
  },
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  draggableHeader: {
    width: '100%',
    zIndex: 10,
  },
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
  transactionDate: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
  },
  bottomNavigationContainer: {
    position: 'absolute',
    bottom: 34, // Safe area padding
    left: 0,
    right: 0,
  },
  bottomNavigation: {
    paddingHorizontal: 18,
    flexDirection: 'row',
    gap: 8,
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
    ...StyleSheet.absoluteFillObject,
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
  maestroSettingsButton: {
    position: 'absolute',
    top: 60, // Position below the header
    right: 16,
    width: 40,
    height: 40,
    opacity: 0.01, // Nearly invisible but still detectable
    zIndex: 9999,
  },
  gestureHandlerRoot: {
    flex: 1,
  },
  whiteFlashOverlayAnimated: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'white',
    zIndex: 9998,
    pointerEvents: 'none',
  },
  pagerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9997,
    backgroundColor: 'transparent',
  },
  pagerPage: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  emptyTransactionsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 0,
    width: '100%',
  },
  emptyTransactionsAnimation: {
    width: 368,
    height: 100,
    marginBottom: 16,
  },
});
