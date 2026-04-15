import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Dimensions, RefreshControl, RefreshControlProps, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import ActionButtons, { Action } from '@/components/ActionButtons';
import BackupWarning from '@/components/BackupWarning';
import Balance from '@/components/Balance';
import DashboardTiles, { LayerCard } from '@/components/DashboardTiles';
import NftsView from '@/components/NftsView';
import RadialGradientScreen from '@/components/RadialGradientScreen';
import StickyHeader from '@/components/StickyHeader';
import { LayerzStorage } from '@/src/class/layerz-storage';
import { setNativeDepositSwapsFetcher, useTransferService } from '@shared/hooks/useTransferService';
import { swapFetcher } from '@shared/hooks/useSwaps';

import { ThemedText } from '@/components/ThemedText';
import TokensView from '@/components/TokensView';
import YieldView from '@/components/YieldView';
import TransactionsList from '@/components/TransactionsList';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { getNetworkImageAsset } from '@/utils/networkAssets';
import { getNetworkGradient } from '@shared/constants/Colors';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useAvailableNetworks } from '@shared/hooks/useAvailableNetworks';
import { useSettings } from '@shared/hooks/useSettings';
import { useTransactionHistory } from '@shared/hooks/useTransactionHistory';
import { getIsTestnet, getTickerByNetwork } from '@shared/models/network-getters';
import { sleep } from '@shared/modules/sleep';
import { capitalizeFirstLetter } from '@shared/modules/string-utils';
import { CommonTransaction } from '@shared/types/common-transaction';
import { NETWORK_ARK, NETWORK_LIGHTNING_TESTNET, NETWORK_LIQUID, NETWORK_LIQUID_TESTNET, NETWORK_SPARK } from '@shared/types/networks';
import { CachedTokenInfo } from '@shared/types/token-info';
import { YieldBearingCachedTokenInfo } from '@shared/hooks/useYieldDiscovery';
import { OnrampProps } from './Onramp';
import Pressable from '../components/Pressable';
import { homeBlurTargetRef } from '@/src/hooks/homeBlurTargetRef';

const { height: SCREEN_HEIGHT } = Dimensions.get('screen');
const MODAL_MIN_HEIGHT = 120; // Height when dragged down (header + some content)
const MODAL_MAX_HEIGHT = SCREEN_HEIGHT; // Full height modal

export type HomeProps = {
  fromOnboarding?: string;
};

export default function Home() {
  const { network, setNetwork } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const router = useRouter();
  const params = useLocalSearchParams<HomeProps>();
  const transferService = useTransferService(LayerzStorage);
  useEffect(() => {
    setNativeDepositSwapsFetcher((n, acc) => swapFetcher({ cacheKey: 'ndSwapFetcher', accountNumber: acc, network: n, backgroundCaller: BackgroundExecutor }));
  }, []);
  const { transactions, error: transactionsError, mutate: mutateTransactions } = useTransactionHistory(network, accountNumber, BackgroundExecutor, transferService);
  const scrollY = useSharedValue(0); // Scroll animation for sticky header
  const modalTranslateY = useSharedValue(0); // Modal state and animations
  const currentModalPosition = useSharedValue(0); // Track current modal position using shared value
  const gestureStartPosition = useSharedValue(0); // Track gesture start position using shared value
  const whiteFlashAnim = useSharedValue(0); // Animation for white flash transition
  const balanceRef = useRef<{ refresh: () => void }>(null);
  const yieldViewRef = useRef<{ refresh: () => void }>(null);
  const tokensViewRef = useRef<{ refresh: () => void }>(null);
  const nftsViewRef = useRef<{ refresh: () => void }>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshOptions, setRefreshOptions] = useState<Partial<RefreshControlProps>>({});
  const settingsContext = useSettings();
  const hasBackedUpSeed = settingsContext.settings.seedBackedUp === 'ON';

  const handleFund = useCallback(() => {
    BackgroundExecutor.getAddress(network, accountNumber).then((address) => {
      const onrampParams: OnrampProps = { address, network };
      router.push({ pathname: '/Onramp', params: onrampParams });
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

  const handleYieldPress = (token: YieldBearingCachedTokenInfo) => {
    router.push('/YieldList');
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

  const handleTransactionDetails = (transaction: CommonTransaction) => {
    const transferExecution = (transaction as any).transferExecution;
    if (transferExecution) {
      router.push({
        pathname: '/TransferDetails',
        params: { execution: JSON.stringify(transferExecution) },
      });
      return;
    }

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
      yieldViewRef.current?.refresh();
      tokensViewRef.current?.refresh();
      nftsViewRef.current?.refresh();
      mutateTransactions();
      await sleep(3000); // wait for 3 seconds to simulate a refresh
    } finally {
      setRefreshing(false);
    }
  }, [mutateTransactions]);

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

      {/* Modal: scroll + BlurTarget FIRST (Expo: BlurView that uses blurTarget must mount after the target). Header overlays on top. */}
      <Animated.View style={[styles.modalContainer, { height: MODAL_MAX_HEIGHT }, modalAnimatedStyle]}>
        <View ref={homeBlurTargetRef} style={styles.blurScrollTarget} collapsable={false}>
          <RadialGradientScreen network={network} scroll={true} onScroll={handleScroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} {...refreshOptions} />}>
            <View style={[styles.root, styles.contentWithHeader]}>
              {/* Network Selector */}
              <View style={styles.networkSelectorContainer}>
                <Pressable testID="NetworkSwitcherTrigger" onPress={handleNetworkSelect} activeOpacity={0.8}>
                  <View style={styles.networkSelectorSurface}>
                    <View style={styles.networkSelector}>
                      <View testID={`selectedNetwork-${network}`} style={styles.networkIcon}>
                        {networkIconContent}
                      </View>
                      <ThemedText style={styles.networkName}>{capitalizeFirstLetter(network)}</ThemedText>
                      <Pressable onPress={handleNetworkSelect} onLongPress={() => router.push('/BackdoorNetworkSwitcher')} testID="BackdoorNetworkSwitcher">
                        <Ionicons name="chevron-down" size={20} color="rgba(255, 255, 255, 0.8)" />
                      </Pressable>
                    </View>
                  </View>
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

              {/* Yield Section */}
              <YieldView ref={yieldViewRef} onYieldPress={handleYieldPress} />

              {/* Tokens Section */}
              <TokensView ref={tokensViewRef} onTokenPress={handleTokenPress} />

              {/* NFTs Section */}
              <NftsView ref={nftsViewRef} />

              {/* Transactions Section */}
              <TransactionsList transactions={latestTransactions} error={transactionsError} onTransactionPress={handleTransactionDetails} onViewHistory={handleTransactionHistory} />
            </View>
          </RadialGradientScreen>
        </View>

        {/* Invisible Settings Button for Maestro Testing */}
        <Pressable style={styles.maestroSettingsButton} onPress={goToSettings} testID="SettingsButton" accessibilityLabel="Settings" />

        <GestureDetector gesture={panGesture}>
          <Animated.View style={styles.modalHeaderOverlay}>
            <StickyHeader scrollY={scrollY} onSettingsPress={goToSettings} />
          </Animated.View>
        </GestureDetector>

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
  modalHeaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    bottom: undefined,
    zIndex: 20,
  },
  root: {
    flex: 1,
    paddingHorizontal: 18,
    paddingBottom: 100, // Safe area + extra scroll space
  },
  contentWithHeader: {
    paddingTop: 80,
  },
  networkSelectorContainer: {
    alignSelf: 'flex-start',
    marginTop: 0,
    marginBottom: 16,
  },
  networkSelectorSurface: {
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  networkSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 56,
    backgroundColor: 'transparent',
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
    width: 20,
    height: 20,
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
  blurScrollTarget: {
    flex: 1,
    minHeight: 0,
  },
  whiteFlashOverlayAnimated: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'white',
    zIndex: 9998,
    pointerEvents: 'none',
  },
});
