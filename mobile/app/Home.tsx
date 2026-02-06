import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Dimensions, Platform, RefreshControl, RefreshControlProps, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Pressable from '../components/Pressable';

import ActionButtons from '@/components/ActionButtons';

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
import BackupWarning from '@/components/BackupWarning';
import Balance from '@/components/Balance';
import Button from '@/components/Button';
import DashboardTiles, { LayerCard } from '@/components/DashboardTiles';
import NftsView from '@/components/NftsView';
import PlatformBlurView from '@/components/PlatformBlurView';
import LiquidGlassView from '@/components/LiquidGlassView';
import RadialGradientScreen from '@/components/RadialGradientScreen';
import StickyHeader from '@/components/StickyHeader';
import SwapList from '@/components/SwapList';
import { ThemedText } from '@/components/ThemedText';
import TokensView from '@/components/TokensView';
import TransactionsList from '@/components/TransactionsList';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { getNetworkImageAsset } from '@/utils/networkAssets';
import { getNetworkGradient } from '@shared/constants/Colors';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useAvailableNetworks } from '@shared/hooks/useAvailableNetworks';
import { useSettings } from '@shared/hooks/useSettings';
import { useTransactions } from '@shared/hooks/useTransactions';
import { getIsTestnet, getTickerByNetwork } from '@shared/models/network-getters';
import { fiatOnRamp } from '@shared/models/fiat-on-ramp';
import { getSwapPairs } from '@shared/models/swap-providers-list';
import { USDT_TOKENS } from '@shared/models/token-list';
import { sleep } from '@shared/modules/sleep';
import { capitalizeFirstLetter } from '@shared/modules/string-utils';
import { CommonTransaction } from '@shared/types/common-transaction';
import { NETWORK_ARK, NETWORK_LIGHTNING, NETWORK_LIGHTNING_TESTNET, NETWORK_LIQUID, NETWORK_LIQUID_TESTNET, NETWORK_ROOTSTOCK, NETWORK_SPARK, NETWORK_USDT, Networks } from '@shared/types/networks';
import { SO_LIQUID_USDT, SO_ROOTSTOCK_USDT, SwapPlatform } from '@shared/types/swap';
import { CachedTokenInfo } from '@shared/types/token-info';
import { OnrampProps } from './Onramp';
import { SwapParams } from './Swap';


const { height: SCREEN_HEIGHT } = Dimensions.get('screen');
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
  const segments = useSegments();
  const params = useLocalSearchParams<HomeProps>();

  // Redirect to tabs if accessed via Stack route instead of Tabs route
  useEffect(() => {
    const isInTabs = segments.some(seg => seg === '(tabs)');
    if (!isInTabs && segments[0] === 'Home') {
      console.log('🟦 Home: Detected Stack route, redirecting to /(tabs)/home');
      router.replace('/(tabs)/home' as any);
    }
  }, [segments, router]);
  const { transactions, error: transactionsError, mutate: mutateTransactions } = useTransactions(network, accountNumber, BackgroundExecutor);
  const scrollY = useSharedValue(0); // Scroll animation for sticky header
  const modalTranslateY = useSharedValue(0); // Modal state and animations
  const currentModalPosition = useSharedValue(0); // Track current modal position using shared value
  const gestureStartPosition = useSharedValue(0); // Track gesture start position using shared value
  const whiteFlashAnim = useSharedValue(0); // Animation for white flash transition
  const balanceRef = useRef<{ refresh: () => void }>(null);
  const tokensViewRef = useRef<{ refresh: () => void }>(null);
  const nftsViewRef = useRef<{ refresh: () => void }>(null);
  const swapListRef = useRef<{ refresh: () => void }>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshOptions, setRefreshOptions] = useState<Partial<RefreshControlProps>>({});
  const settingsContext = useSettings();
  const hasBackedUpSeed = settingsContext.settings.seedBackedUp === 'ON';

  // Fund button handler (extracted from Balance component)
  const handleFund = useCallback(() => {
    BackgroundExecutor.getAddress(network, accountNumber).then((address) => {
      const params: OnrampProps = { address, network };
      router.push({ pathname: '/Onramp', params });
    });
  }, [network, accountNumber, router]);

  // Initialize modal position based on whether coming from onboarding
  useEffect(() => {
    if (params.fromOnboarding === 'true') {
      const maxTranslate = MODAL_MAX_HEIGHT - MODAL_MIN_HEIGHT;
      modalTranslateY.value = maxTranslate;
      currentModalPosition.value = maxTranslate;
    }
  }, [params.fromOnboarding, modalTranslateY, currentModalPosition]);

  // Animated styles
  const modalAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: modalTranslateY.value }] }));
  const whiteFlashAnimatedStyle = useAnimatedStyle(() => ({ opacity: whiteFlashAnim.value }));

  // URL parameter handling
  useEffect(() => {
    if (params.showSwapInterface === 'true') {
      router.push('/Swap');
    }
  }, [params.showSwapInterface, router]);

  const networkImage = getNetworkImageAsset(network);
  const networkIconContent = networkImage ? <Image source={networkImage} style={styles.networkImage} contentFit="contain" /> : null;
  const latestTransactions = transactions?.slice(0, 3) || [];

  // Network cards for the black background area
  const networks = useAvailableNetworks();
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
      case NETWORK_LIGHTNING:
      case NETWORK_LIGHTNING_TESTNET:
        router.push('/send/send-address-lightning');
        break;
      default:
        router.push('/send');
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

  const handleTokenPress = (token: CachedTokenInfo) => {
    router.push({
      pathname: '/send',
      params: { token: token.id },
    });
  };

  const handleTransactionDetails = (transaction: CommonTransaction) => {
    // Pass the current layer network so transaction details can use the correct background color
    router.push({
      pathname: '/TransactionDetails',
      params: {
        transaction: JSON.stringify(transaction),
        layerNetwork: network, // Pass the current layer being viewed
      },
    });
  };

  const handleBackupSeed = () => {
    router.push('/SeedBackup');
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      balanceRef.current?.refresh();
      tokensViewRef.current?.refresh();
      swapListRef.current?.refresh();
      nftsViewRef.current?.refresh();
      mutateTransactions();
      await sleep(3000); // wait for 3 seconds to simulate a refresh
    } finally {
      setRefreshing(false);
    }
  }, [mutateTransactions]);

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

  // hack to set refresh options after the modal is mounted
  useFocusEffect(
    useCallback(() => {
      setTimeout(() => {
        setRefreshOptions({ progressViewOffset: 120, tintColor: 'rgba(255, 255, 255, 0.8)' });
      }, 100);
    }, [])
  );

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
        <Pressable style={styles.maestroSettingsButton} onPress={goToSettings} testID="SettingsButton" accessibilityLabel="Settings" />

        <RadialGradientScreen network={network} scroll={true} onScroll={handleScroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} {...refreshOptions} />}>
          <View style={[styles.root, styles.contentWithHeader]}>
            {/* Network Selector */}
            <View style={styles.networkSelectorContainer}>
              <Pressable testID="NetworkSwitcherTrigger" onPress={handleNetworkSelect} activeOpacity={0.8}>
                <LiquidGlassView tint="light" glassStyle="clear" intensity={1} borderIntensity={0.2} style={styles.networkSelectorGlass}>
                  <View style={styles.networkSelector}>
                    <View testID={`selectedNetwork-${network}`} style={styles.networkIcon}>
                      {networkIconContent}
                    </View>
                    <ThemedText style={styles.networkName}>{capitalizeFirstLetter(network)}</ThemedText>
                    <Pressable onPress={handleNetworkSelect} onLongPress={() => router.push('/BackdoorNetworkSwitcher')} testID="BackdoorNetworkSwitcher">
                      <Ionicons name="chevron-down" size={20} color="rgba(255, 255, 255, 0.8)" />
                    </Pressable>
                  </View>
                </LiquidGlassView>
              </Pressable>
            </View>

            {/* Testnet Warning */}
            {getIsTestnet(network) && (
              <View style={styles.testnetWarning}>
                <ThemedText style={styles.testnetWarningText}>Warning: You are using a testnet, coins have no value</ThemedText>
              </View>
            )}

            {/* Balance Section */}
            <Balance ref={balanceRef} />

            {/* Action Buttons Section */}
            <ActionButtons onFundPress={handleFund} />

            {/* Seed Backup Warning */}
            {hasBackedUpSeed === false && <BackupWarning onPress={handleBackupSeed} />}

            {/* Tokens Section */}
            <TokensView ref={tokensViewRef} onTokenPress={handleTokenPress} />

            {/* NFTs Section */}
            <NftsView ref={nftsViewRef} />

            {/* Transactions Section */}
            <TransactionsList transactions={latestTransactions} error={transactionsError} onTransactionPress={handleTransactionDetails} onViewHistory={handleTransactionHistory} />

            {/* Swap List Section */}
            <SwapList ref={swapListRef} />
          </View>
        </RadialGradientScreen>

        {/* White Flash Overlay for Network Transition */}
        <Animated.View style={[styles.whiteFlashOverlayAnimated, whiteFlashAnimatedStyle]} />
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
    paddingBottom: 100, // Account for safe area + extra scroll space
  },
  contentWithHeader: {
    paddingTop: 80,
  },
  networkSelectorContainer: {
    alignSelf: 'flex-start',
    marginTop: 0,
    marginBottom: 16,
  },
  networkSelectorGlass: {
    borderRadius: 16,
    backgroundColor: 'transparent', // Ensure transparent background for glass effect
  },
  networkSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 56,
    backgroundColor: 'transparent', // Ensure transparent background
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
});
