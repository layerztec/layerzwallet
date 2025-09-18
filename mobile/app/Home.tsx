import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext, useEffect, useState } from 'react';
import { Alert, LayoutAnimation, StyleSheet, TouchableOpacity, View } from 'react-native';

import { OnrampProps } from '@/app/Onramp';
import { ActionPopupButton } from '@/components/ActionPopupButton';
import Button from '@/components/Button';
import GradientScreen from '@/components/GradientScreen';
import LiquidTokensView from '@/components/LiquidTokensView';
import { ThemedText } from '@/components/ThemedText';
import TokensView from '@/components/TokensView';
import SwapList from '@/components/SwapList';
import { DappBrowserProps } from '@/app/DAppBrowser';

import Transaction from '@/components/Transaction';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { useAppLock } from '@/src/hooks/useAppLock';
import { getNetworkImageAsset } from '@/utils/networkAssets';
import { AccountNumberContext, accountItems } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useAccountBalance } from '@shared/hooks/useAccountBalance';
import { useAvailableNetworks } from '@shared/hooks/useAvailableNetworks';
import { useBalance } from '@shared/hooks/useBalance';
import { useExchangeRate } from '@shared/hooks/useExchangeRate';
import { useTransactions } from '@shared/hooks/useTransactions';
import { fiatOnRamp } from '@shared/models/fiat-on-ramp';
import { getDecimalsByNetwork, getExplorerUrlByNetwork, getIsEVM, getIsTestnet, getTickerByNetwork } from '@shared/models/network-getters';
import { getSwapPairs } from '@shared/models/swap-providers-list';
import { capitalizeFirstLetter, formatBalance, formatFiatBalance } from '@shared/modules/string-utils';
import { NETWORK_ARK, NETWORK_ARK_MUTINYNET, NETWORK_BITCOIN, NETWORK_LIGHTNING, NETWORK_LIGHTNING_TESTNET, NETWORK_LIQUID, NETWORK_LIQUID_TESTNET, NETWORK_SPARK } from '@shared/types/networks';
import { SwapPlatform } from '@shared/types/swap';
import { CommonTransaction } from '@shared/types/common-transaction';

const logo = require('@/assets/images/ui/logo-main-screen.svg');

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

  // App lock functionality
  const { lockState, authenticateWithBiometrics, clearCanceled } = useAppLock();
  const [hasAutoTriggered, setHasAutoTriggered] = useState(false);

  useEffect(() => {
    LayoutAnimation.configureNext({
      duration: 300,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
  }, [lockState.isLocked, lockState.isAuthenticating, lockState.userCanceled, hasAutoTriggered]);

  useEffect(() => {
    if (lockState.isLocked && lockState.requiresAuth) {
      LayoutAnimation.configureNext({
        duration: 400,
        create: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
        },
        update: {
          type: LayoutAnimation.Types.spring,
          springDamping: 0.7,
          property: LayoutAnimation.Properties.scaleXY,
        },
      });
    }
  }, [lockState.isLocked, lockState.requiresAuth]);

  // Auto-trigger biometric authentication when lock screen first appears
  useEffect(() => {
    if (lockState.isLocked && lockState.requiresAuth && !lockState.isAuthenticating && !lockState.userCanceled && !hasAutoTriggered) {
      setHasAutoTriggered(true);
      authenticateWithBiometrics();
    }

    // Reset auto-trigger flag when app is unlocked
    if (!lockState.isLocked) {
      setHasAutoTriggered(false);
    }
  }, [lockState.isLocked, lockState.requiresAuth, lockState.isAuthenticating, lockState.userCanceled, hasAutoTriggered, authenticateWithBiometrics]);

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

  const handleSend = () => {
    switch (network) {
      case NETWORK_BITCOIN:
        router.push('/SendBtc');
        break;
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

  const handleBuyClick = () => {
    BackgroundExecutor.getAddress(network, accountNumber).then((address) => {
      const params: OnrampProps = { address, network };
      router.push({ pathname: '/Onramp', params });
    });
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

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <GradientScreen variant={network} scroll={true}>
        <View style={styles.root}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.logoContainer} onPress={goToSettings} testID="SettingsButton" activeOpacity={0.8}>
              <Image source={logo} style={styles.logo} contentFit="contain" />
            </TouchableOpacity>

            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.pocket} onPress={() => router.push('/PocketSwitch')}>
                <ThemedText style={styles.pocketLabel}>{accountItem.name} pocket</ThemedText>
                <ThemedText style={styles.pocketAmount}>
                  {accountBalance ? formatBalance(accountBalance, getDecimalsByNetwork(NETWORK_BITCOIN), 8) : '0'} {getTickerByNetwork(NETWORK_BITCOIN)}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>

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
                    {network === NETWORK_LIGHTNING_TESTNET ? '0' : sparkBalance ? formatBalance(sparkBalance, Number(getDecimalsByNetwork(NETWORK_SPARK)), 8) : '0'} {getTickerByNetwork(NETWORK_SPARK)}
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
                    {liquidBalance && +liquidBalance > 0 && liquidExchangeRate ? '$' + formatFiatBalance(liquidBalance, Number(getDecimalsByNetwork(NETWORK_LIQUID)), Number(liquidExchangeRate)) : '-'}
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
          <BlurView intensity={25} tint="dark" style={styles.transactionsContainer}>
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
          </BlurView>

          {/* Bottom spacing for navigation */}
          <View style={styles.bottomSpacer} />
        </View>
      </GradientScreen>

      {/* Bottom Navigation */}
      <View style={styles.bottomNavigation}>
        <View style={styles.navContainer}>
          <BlurView intensity={20} tint="dark" style={styles.navBlur} />

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
            <BlurView intensity={40} tint="light" style={styles.navBlur} />
            <TouchableOpacity style={styles.swapButtonInner} onPress={handleSwap} activeOpacity={0.8} testID="SwapButton">
              <Ionicons name="swap-horizontal" size={22} color="rgba(255, 255, 255, 0.8)" />
              <ThemedText style={styles.navButtonText}>Swap</ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Biometric Authentication Lock Screen Overlay */}
      {lockState.isLocked && lockState.requiresAuth && (
        <View style={styles.lockScreenOverlay}>
          <BlurView intensity={50} tint="dark" style={styles.lockScreenBlur}>
            <View style={styles.lockScreenContent}>
              <View style={styles.lockIconContainer}>
                <MaterialIcons name="lock" size={80} color="rgba(255, 255, 255, 0.8)" />
              </View>
              <ThemedText style={styles.lockScreenTitle}>Wallet Locked</ThemedText>
              <ThemedText style={styles.lockScreenSubtitle}>
                {lockState.isAuthenticating
                  ? 'Authenticating...'
                  : lockState.userCanceled
                    ? 'Authentication was canceled. Tap unlock to try again.'
                    : hasAutoTriggered
                      ? 'Tap unlock to authenticate'
                      : 'Authenticating automatically...'}
              </ThemedText>
              {!lockState.isAuthenticating && (lockState.userCanceled || hasAutoTriggered) && (
                <TouchableOpacity
                  style={styles.unlockButton}
                  onPress={() => {
                    LayoutAnimation.configureNext({
                      duration: 200,
                      create: {
                        type: LayoutAnimation.Types.easeInEaseOut,
                        property: LayoutAnimation.Properties.opacity,
                      },
                      update: {
                        type: LayoutAnimation.Types.easeInEaseOut,
                        property: LayoutAnimation.Properties.opacity,
                      },
                    });
                    clearCanceled();
                    authenticateWithBiometrics();
                  }}
                  testID="UnlockButton"
                >
                  <MaterialIcons name="fingerprint" size={24} color="rgba(255, 255, 255, 0.8)" />
                  <ThemedText style={styles.unlockButtonText}>Unlock</ThemedText>
                </TouchableOpacity>
              )}
            </View>
          </BlurView>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 18,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 16,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -5,
  },
  logo: {
    width: 130,
    height: 50,
  },
  pocket: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  pocketLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: -6,
  },
  pocketAmount: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  networkSelectorContainer: {
    alignSelf: 'flex-start',
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
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
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
});
