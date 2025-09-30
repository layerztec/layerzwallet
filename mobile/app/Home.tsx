import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import PlatformBlurView from '@/components/PlatformBlurView';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext, useEffect, useState, useRef, useMemo } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View, Animated, Dimensions } from 'react-native';
import { PanGestureHandler, GestureHandlerRootView } from 'react-native-gesture-handler';

import { OnrampProps } from '@/app/Onramp';
import { ActionPopupButton } from '@/components/ActionPopupButton';
import Button from '@/components/Button';
import DashboardTiles, { LayerCard } from '@/components/DashboardTiles';
import GradientScreen from '@/components/GradientScreen';
import LiquidTokensView from '@/components/LiquidTokensView';
import { ThemedText } from '@/components/ThemedText';
import TokensView from '@/components/TokensView';
import SwapList from '@/components/SwapList';
import StickyHeader from '@/components/StickyHeader';
import { DappBrowserProps } from '@/app/DAppBrowser';

import Transaction from '@/components/Transaction';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { getNetworkImageAsset } from '@/utils/networkAssets';
import { AccountNumberContext, accountItems } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useAvailableNetworks } from '@shared/hooks/useAvailableNetworks';
import { useAccountBalance } from '@shared/hooks/useAccountBalance';
import { useBalance } from '@shared/hooks/useBalance';
import { useExchangeRate } from '@shared/hooks/useExchangeRate';
import { useTransactions } from '@shared/hooks/useTransactions';
import { fiatOnRamp } from '@shared/models/fiat-on-ramp';
import { getDecimalsByNetwork, getExplorerUrlByNetwork, getIsEVM, getIsTestnet, getTickerByNetwork } from '@shared/models/network-getters';
import { getNetworkGradient } from '@shared/constants/Colors';
import { getSwapPairs } from '@shared/models/swap-providers-list';
import { capitalizeFirstLetter, formatBalance, formatFiatBalance } from '@shared/modules/string-utils';
import { NETWORK_ARK, NETWORK_ARK_MUTINYNET, NETWORK_BITCOIN, NETWORK_LIGHTNING, NETWORK_LIGHTNING_TESTNET, NETWORK_LIQUID, NETWORK_LIQUID_TESTNET, NETWORK_SPARK } from '@shared/types/networks';
import { SwapPlatform } from '@shared/types/swap';
import { CommonTransaction } from '@shared/types/common-transaction';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_MIN_HEIGHT = 120; // Height when dragged down (header + some content)
const MODAL_MAX_HEIGHT = SCREEN_HEIGHT; // Full height modal

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

  // URL parameter handling
  useEffect(() => {
    if (params.showSwapInterface === 'true') {
      router.push('/Swap');
    }
  }, [params.showSwapInterface, router]);

  // Get balance data
  const { balance } = useBalance(network, accountNumber, BackgroundExecutor);
  const { exchangeRate } = useExchangeRate(network, 'USD');
  const availableNetworks = useAvailableNetworks();
  const { accountBalance } = useAccountBalance(accountNumber, availableNetworks);
  const { transactions, error: transactionsError } = useTransactions(network, accountNumber, BackgroundExecutor);
  const accountItem = accountItems[accountNumber];

  // Scroll animation for sticky header
  const scrollY = useRef(new Animated.Value(0)).current;

  // Modal state and animations
  const [modalHeight, setModalHeight] = useState(MODAL_MAX_HEIGHT);
  const modalTranslateY = useRef(new Animated.Value(0)).current;

  // Lightning network specific balance logic
  const isLightningNetwork = network === NETWORK_LIGHTNING || network === NETWORK_LIGHTNING_TESTNET;
  const sparkNetwork = isLightningNetwork ? NETWORK_SPARK : network;
  const arkNetwork = isLightningNetwork ? NETWORK_ARK : network;
  const liquidNetwork = isLightningNetwork ? (network === NETWORK_LIGHTNING_TESTNET ? NETWORK_LIQUID_TESTNET : NETWORK_LIQUID) : network;

  // Get additional balances for Lightning networks
  const { balance: sparkBalance } = useBalance(sparkNetwork, accountNumber, BackgroundExecutor);
  const { balance: arkBalance } = useBalance(arkNetwork, accountNumber, BackgroundExecutor);
  const { balance: liquidBalance } = useBalance(liquidNetwork, accountNumber, BackgroundExecutor);
  const { exchangeRate: sparkExchangeRate } = useExchangeRate(sparkNetwork, 'USD');
  const { exchangeRate: arkExchangeRate } = useExchangeRate(arkNetwork, 'USD');
  const { exchangeRate: liquidExchangeRate } = useExchangeRate(liquidNetwork, 'USD');

  const ticker = getTickerByNetwork(network);
  const decimals = getDecimalsByNetwork(network);
  const isEVM = getIsEVM(network);
  const networkImage = getNetworkImageAsset(network);
  const networkIconContent = networkImage ? <Image source={networkImage} style={styles.networkImage} contentFit="contain" /> : null;
  const swapPairs = getSwapPairs(network, SwapPlatform.MOBILE);
  const canBuyWithFiat = fiatOnRamp?.[network]?.canBuyWithFiat;

  // Balance display logic
  const formattedBalance = formatBalance(balance || '0', decimals);
  const usdValue = exchangeRate ? formatFiatBalance(balance || '0', decimals, exchangeRate) : '0.00';

  // Always show native token balance as main balance, USD as sub-balance
  const displayBalance = `${formattedBalance} ${ticker}`;
  const displaySubBalance = `${usdValue} USD`;

  const latestTransactions = transactions?.slice(0, 3) || [];

  // Network cards for the black background area
  const networks = useAvailableNetworks();
  const { setNetwork } = useContext(NetworkContext);

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

  // Handle network card selection in black background area
  const handleNetworkCardPress = (index: number) => {
    if (index >= 0 && index < networks.length) {
      const selectedNetwork = networks[index];

      // Create white flash transition effect
      const flashDuration = 150;

      // Flash to white
      Animated.timing(whiteFlashAnim, {
        toValue: 1,
        duration: flashDuration,
        useNativeDriver: true, // Better performance for opacity
      }).start(() => {
        // Change network during white flash
        setNetwork(selectedNetwork);

        // Flash back to transparent
        Animated.timing(whiteFlashAnim, {
          toValue: 0,
          duration: flashDuration,
          useNativeDriver: true, // Better performance for opacity
        }).start(() => {
          // After flash animation completes, expand modal to full height
          currentModalPosition.current = 0;
          Animated.timing(modalTranslateY, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true, // Better performance for transform
          }).start();
          setModalHeight(MODAL_MAX_HEIGHT);
        });
      });
    }
  };

  const handleBuyClick = () => {
    BackgroundExecutor.getAddress(network, accountNumber).then((address) => {
      const params: OnrampProps = { address, network };
      router.push({ pathname: '/Onramp', params });
    });
  };

  const handleNetworkSelect = () => {
    // Minimize modal to show network tiles in black background area
    const maxTranslate = MODAL_MAX_HEIGHT - MODAL_MIN_HEIGHT;
    currentModalPosition.current = maxTranslate;
    Animated.timing(modalTranslateY, {
      toValue: maxTranslate,
      duration: 300,
      useNativeDriver: true, // Better performance for transform
    }).start();
    setModalHeight(MODAL_MIN_HEIGHT);
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
    if (network === NETWORK_LIGHTNING_TESTNET) {
      router.push({ pathname: '/ReceiveLightning', params: { network: NETWORK_LIQUID_TESTNET } });
    } else {
      router.push({ pathname: '/ReceiveLightning', params: { network: NETWORK_LIQUID } });
    }
  };

  const handleReceiveOnArk = () => {
    if (network === NETWORK_LIGHTNING_TESTNET) {
      Alert.alert('Ark lightning does not have a testnet');
    } else {
      router.push({ pathname: '/ReceiveLightning', params: { network: NETWORK_ARK } });
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
      label: 'Receive on Ark',
      onClick: handleReceiveOnArk,
    },
    {
      label: 'Cancel',
      onClick: () => {},
    },
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
    if (network === NETWORK_LIGHTNING_TESTNET) {
      router.push({ pathname: '/SendLightning', params: { network: NETWORK_LIQUID_TESTNET } });
    } else {
      router.push({ pathname: '/SendLightning', params: { network: NETWORK_LIQUID } });
    }
  };

  const handleTransactionDetails = (transaction: CommonTransaction) => {
    router.push({ pathname: '/TransactionDetails', params: { transaction: JSON.stringify(transaction) } });
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
      label: 'Send via Ark',
      onClick: handleSendViaArk,
    },
    {
      label: 'Cancel',
      onClick: () => {},
    },
  ];

  // Handle scroll events for sticky header animation
  const handleScroll = (event: any) => {
    scrollY.setValue(event.nativeEvent.contentOffset.y);
  };

  // Track current modal position
  const currentModalPosition = useRef(0);

  // Animation for white flash transition
  const whiteFlashAnim = useRef(new Animated.Value(0)).current;

  // Modal gesture handling with bounds
  const onPanGestureEvent = (event: any) => {
    const { translationY } = event.nativeEvent;
    const maxTranslate = MODAL_MAX_HEIGHT - MODAL_MIN_HEIGHT;

    // Calculate new position based on current position + translation
    const newPosition = currentModalPosition.current + translationY;

    // Constrain position between 0 and maxTranslate
    let constrainedPosition = newPosition;
    if (newPosition < 0) {
      constrainedPosition = 0;
    } else if (newPosition > maxTranslate) {
      constrainedPosition = maxTranslate;
    }

    modalTranslateY.setValue(constrainedPosition);
  };

  const onPanHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === 5) {
      // END
      const { translationY, velocityY } = event.nativeEvent;
      const maxTranslate = MODAL_MAX_HEIGHT - MODAL_MIN_HEIGHT;

      // Update current position
      currentModalPosition.current = Math.max(0, Math.min(maxTranslate, currentModalPosition.current + translationY));

      // Determine if we should snap to min or max based on velocity and position
      const shouldSnapToMin = translationY > 100 || velocityY > 500;

      if (shouldSnapToMin) {
        // Snap to minimized state (translate down so only header is visible)
        currentModalPosition.current = maxTranslate;
        Animated.timing(modalTranslateY, {
          toValue: maxTranslate,
          duration: 300,
          useNativeDriver: true, // Better performance for transform
        }).start();
        setModalHeight(MODAL_MIN_HEIGHT);
      } else {
        // Snap to expanded state (translate back to original position)
        currentModalPosition.current = 0;
        Animated.timing(modalTranslateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true, // Better performance for transform
        }).start();
        setModalHeight(MODAL_MAX_HEIGHT);
      }
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Black Background with Network Tiles */}
      <View style={styles.blackBackground}>
        <DashboardTiles cards={networkCards} onCardPress={handleNetworkCardPress} showTitle={false} showLogo={true} />
      </View>

      {/* Modal Container */}
      <Animated.View
        style={[
          styles.modalContainer,
          {
            height: MODAL_MAX_HEIGHT,
            transform: [{ translateY: modalTranslateY }],
          },
        ]}
      >
        {/* Draggable Header */}
        <PanGestureHandler onGestureEvent={onPanGestureEvent} onHandlerStateChange={onPanHandlerStateChange} activeOffsetY={[-10, 10]} failOffsetX={[-50, 50]}>
          <Animated.View style={styles.draggableHeader}>
            <StickyHeader scrollY={scrollY} onSettingsPress={goToSettings} />
          </Animated.View>
        </PanGestureHandler>

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
            {isLightningNetwork ? (
              <View style={styles.lightningBalanceContainer}>
                <View style={styles.lightningBalanceRow}>
                  <ThemedText style={styles.lightningBalanceLabel}>Spark</ThemedText>
                  <View style={styles.lightningBalanceValues}>
                    <ThemedText style={styles.lightningBalanceAmount}>
                      {network === NETWORK_LIGHTNING_TESTNET ? '0' : sparkBalance ? formatBalance(sparkBalance, Number(getDecimalsByNetwork(NETWORK_SPARK)), 8) : '0'}{' '}
                      {getTickerByNetwork(NETWORK_SPARK)}
                    </ThemedText>
                    <ThemedText style={styles.lightningBalanceFiat}>
                      {network === NETWORK_LIGHTNING_TESTNET
                        ? '-'
                        : sparkBalance && +sparkBalance > 0 && sparkExchangeRate
                          ? '$' + formatFiatBalance(sparkBalance, Number(getDecimalsByNetwork(NETWORK_SPARK)), Number(sparkExchangeRate))
                          : '-'}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.lightningBalanceRow}>
                  <ThemedText style={styles.lightningBalanceLabel}>Ark</ThemedText>
                  <View style={styles.lightningBalanceValues}>
                    <ThemedText style={styles.lightningBalanceAmount}>
                      {network === NETWORK_LIGHTNING_TESTNET ? '0' : arkBalance ? formatBalance(arkBalance, Number(getDecimalsByNetwork(NETWORK_ARK)), 8) : '0'} {getTickerByNetwork(NETWORK_ARK)}
                    </ThemedText>
                    <ThemedText style={styles.lightningBalanceFiat}>
                      {network === NETWORK_LIGHTNING_TESTNET
                        ? '-'
                        : arkBalance && +arkBalance > 0 && arkExchangeRate
                          ? '$' + formatFiatBalance(arkBalance, Number(getDecimalsByNetwork(NETWORK_ARK)), Number(arkExchangeRate))
                          : '-'}
                    </ThemedText>
                  </View>
                </View>
                <View style={[styles.lightningBalanceRow, { borderBottomWidth: 0 }]}>
                  <ThemedText style={styles.lightningBalanceLabel}>Liquid</ThemedText>
                  <View style={styles.lightningBalanceValues}>
                    <ThemedText style={styles.lightningBalanceAmount}>
                      {liquidBalance ? formatBalance(liquidBalance, Number(getDecimalsByNetwork(NETWORK_LIQUID)), 8) : '0'} {getTickerByNetwork(NETWORK_LIQUID)}
                    </ThemedText>
                    <ThemedText style={styles.lightningBalanceFiat}>
                      {liquidBalance && +liquidBalance > 0 && liquidExchangeRate
                        ? '$' + formatFiatBalance(liquidBalance, Number(getDecimalsByNetwork(NETWORK_LIQUID)), Number(liquidExchangeRate))
                        : '-'}
                    </ThemedText>
                  </View>
                </View>
                {canBuyWithFiat && (
                  <View style={styles.lightningBuyButtonContainer}>
                    <TouchableOpacity style={styles.lightningBuyButton} onPress={handleBuyClick} activeOpacity={0.8}>
                      <Ionicons name="cart-outline" size={16} color="white" />
                      <ThemedText style={styles.lightningBuyButtonText}>Buy</ThemedText>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.balanceSection} testID="LayerBalance">
                <View style={styles.balanceContainer}>
                  <ThemedText style={styles.balanceAmount} adjustsFontSizeToFit={true} numberOfLines={1} testID="LayerActualBalance">
                    {balance ? displayBalance : '???'}
                  </ThemedText>
                  <ThemedText style={styles.balanceUsd}>{displaySubBalance}</ThemedText>
                </View>

                {canBuyWithFiat && (
                  <TouchableOpacity style={styles.buyButton} onPress={handleBuyClick} activeOpacity={0.8}>
                    <ThemedText style={styles.buyButtonText}>Buy Bitcoin</ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Explorer Button for EVM networks */}
            {isEVM && <Button title="🔍 Explore" onPress={handleExplorer} variant="dark" style={styles.explorerButton} testID="ExplorerButton" />}

            {/* Swap List Section */}
            <SwapList />

            {/* Tokens Section */}
            <View style={styles.tokensSection}>{network === NETWORK_LIQUID || network === NETWORK_LIQUID_TESTNET ? <LiquidTokensView /> : <TokensView />}</View>

            {/* Transactions Section */}
            <View style={styles.transactionsContainer}>
              <ThemedText style={styles.transactionsTitle}>Latest Transactions</ThemedText>

              {latestTransactions.length > 0 ? (
                <View style={styles.transactionsList}>
                  {latestTransactions.map((transaction) => (
                    <Transaction key={transaction.txid} network={network} transaction={transaction} onPress={() => handleTransactionDetails(transaction)} />
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
          </View>
        </GradientScreen>

        {/* White Flash Overlay for Network Transition */}
        <Animated.View style={[styles.whiteFlashOverlay, { opacity: whiteFlashAnim }]} pointerEvents="none" />

        {/* Bottom Navigation - Fixed to modal bottom */}
        <View style={styles.bottomNavigationContainer}>
          <View style={styles.bottomNavigation}>
            <View style={styles.navContainer}>
              <PlatformBlurView intensity={20} tint="dark" style={styles.navBlur} />

              {network === NETWORK_LIGHTNING || network === NETWORK_LIGHTNING_TESTNET ? (
                <ActionPopupButton actions={getLightningSendActions()}>
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
                <ActionPopupButton actions={getLightningReceiveActions()}>
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
        </View>
      </Animated.View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  blackBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
  whiteFlashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
    zIndex: 1000,
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
    fontWeight: '500',
    marginHorizontal: 16,
  },
  networkImage: {
    width: 24,
    height: 24,
  },
  balanceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  balanceContainer: {
    flex: 1,
  },
  balanceAmount: {
    fontSize: 36,
    lineHeight: 40, // Add proper line height for better text rendering
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
    marginRight: 4,
  },
  balanceUsd: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  explorerButton: {
    marginBottom: 20,
  },
  tokensSection: {
    marginBottom: 20,
  },
  buyButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buyButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
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
    color: 'rgba(255, 255, 255, 0.8)',
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
  lightningBalanceContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    marginBottom: 32,
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
    fontSize: 16,
    flex: 1,
    fontWeight: '500',
  },
  lightningBalanceValues: {
    alignItems: 'flex-end',
    flex: 1,
  },
  lightningBalanceAmount: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    textAlign: 'right',
    fontWeight: '500',
  },
  lightningBalanceFiat: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'right',
  },
  lightningBuyButtonContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  lightningBuyButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  lightningBuyButtonText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
});
