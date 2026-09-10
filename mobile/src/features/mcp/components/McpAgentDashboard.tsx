import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useContext, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ReceiveTokenProps } from '@/app/Receive';
import { SendParams } from '@/app/send';
import { SendTokenEvmProps } from '@/app/SendTokenEvm';
import { ActionPopupButton } from '@/components/ActionPopupButton';
import { Action } from '@/components/ActionButtons';
import Pressable from '@/components/Pressable';
import { ThemedText } from '@/components/ThemedText';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useAccountBalance } from '@shared/hooks/useAccountBalance';
import { useAvailableNetworks } from '@shared/hooks/useAvailableNetworks';
import { useExchangeRate } from '@shared/hooks/useExchangeRate';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { USDT_TOKENS } from '@shared/models/token-list';
import { formatBalance, formatFiatBalance } from '@shared/modules/string-utils';
import { NETWORK_BITCOIN, NETWORK_LIGHTNING, NETWORK_LIGHTNING_TESTNET, NETWORK_LIQUID, NETWORK_ROOTSTOCK, NETWORK_SPARK, NETWORK_USDT } from '@shared/types/networks';

/**
 * Dashboard shown on the MCP automation account beneath the tunnel/activity log row.
 * Contains a "Tools" card with quick-action buttons and a right column with
 * "Budget" and "Permissions" cards
 */
export function McpAgentDashboard() {
  const router = useRouter();
  const permissionsRoute = './McpPermissionsModal' as const;
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const availableNetworks = useAvailableNetworks();
  // Aggregated balance for the entire account across all (mainnet) networks, denominated in sats.
  const { accountBalance } = useAccountBalance(accountNumber, availableNetworks);
  const { exchangeRate } = useExchangeRate(NETWORK_BITCOIN, 'USD');
  const noop = () => {};

  const [budgetFiat, budgetSats] = useMemo<[string, string]>(() => {
    const decimals = getDecimalsByNetwork(NETWORK_BITCOIN);
    if (!accountBalance) return ['—', '— sats'];
    const nativeBtc = `${formatBalance(accountBalance, decimals, 8)} ${getTickerByNetwork(NETWORK_BITCOIN)}`;
    if (!exchangeRate) return ['—', nativeBtc];
    return [`$${formatFiatBalance(accountBalance, decimals, exchangeRate)}`, nativeBtc];
  }, [accountBalance, exchangeRate]);

  const handleAddFunds = () => {
    router.push('/Receive');
  };

  const handleReceiveOnLightningAddress = () => {
    router.push('/ReceiveOnLightningAddress');
  };

  const handlePay = () => {
    switch (network) {
      case NETWORK_LIGHTNING:
      case NETWORK_LIGHTNING_TESTNET:
        router.push('/send/send-address-lightning');
        break;
      default:
        router.push('/send');
    }
  };

  const handleTrade = () => {
    router.push('/transfer');
  };

  const handleSendUSDTViaRootstock = (contractAddress: string) => () => {
    const params: SendTokenEvmProps = { contractAddress, network: NETWORK_ROOTSTOCK };
    router.push({ pathname: '/SendTokenEvm', params });
  };

  const handleSendUSDTViaLiquid = () => {
    const params: SendParams = { token: USDT_TOKENS[NETWORK_LIQUID][0], network: NETWORK_LIQUID };
    router.push({ pathname: '/send', params });
  };

  const handleSendUSDBViaSpark = () => {
    const params: SendParams = { token: USDT_TOKENS[NETWORK_SPARK][0], network: NETWORK_SPARK };
    router.push({ pathname: '/send', params });
  };

  const usdtSendActions = [
    { children: <Action network={NETWORK_ROOTSTOCK} text="Send USDT via Rootstock" />, onClick: handleSendUSDTViaRootstock(USDT_TOKENS[NETWORK_ROOTSTOCK][0]) },
    { children: <Action network={NETWORK_ROOTSTOCK} text="Send USDT0 via Rootstock" />, onClick: handleSendUSDTViaRootstock(USDT_TOKENS[NETWORK_ROOTSTOCK][1]) },
    { children: <Action network={NETWORK_ROOTSTOCK} text="Send rUSDT via Rootstock" />, onClick: handleSendUSDTViaRootstock(USDT_TOKENS[NETWORK_ROOTSTOCK][2]) },
    { children: <Action network={NETWORK_LIQUID} text="Send USDT via Liquid" />, onClick: handleSendUSDTViaLiquid },
    { children: <Action network={NETWORK_SPARK} text="Send USDB via Spark" />, onClick: handleSendUSDBViaSpark },
    { children: <Action text="Cancel" />, onClick: noop },
  ];

  const handleReceiveTokenViaRootstock = () => {
    const params: ReceiveTokenProps = { network: NETWORK_ROOTSTOCK };
    router.push({ pathname: '/Receive', params });
  };

  const handleReceiveTokenViaLiquid = () => {
    const params: ReceiveTokenProps = { network: NETWORK_LIQUID };
    router.push({ pathname: '/Receive', params });
  };

  const handleReceiveTokenViaSpark = () => {
    const params: ReceiveTokenProps = { network: NETWORK_SPARK };
    router.push({ pathname: '/Receive', params });
  };

  const usdtReceiveActions = [
    { children: <Action network={NETWORK_ROOTSTOCK} text="Receive via Rootstock" />, onClick: handleReceiveTokenViaRootstock },
    { children: <Action network={NETWORK_LIQUID} text="Receive via Liquid" />, onClick: handleReceiveTokenViaLiquid },
    { children: <Action network={NETWORK_SPARK} text="Receive via Spark" />, onClick: handleReceiveTokenViaSpark },
    { children: <Action text="Cancel" />, onClick: noop },
  ];

  const addFundsButton = (
    <Pressable
      style={styles.toolButton}
      onPress={network === NETWORK_LIGHTNING || network === NETWORK_LIGHTNING_TESTNET ? handleReceiveOnLightningAddress : handleAddFunds}
      accessibilityRole="button"
      accessibilityLabel="Add funds"
    >
      <ThemedText style={styles.toolButtonText}>Add funds</ThemedText>
    </Pressable>
  );

  const payButton = (
    <Pressable style={styles.toolButton} onPress={handlePay} accessibilityRole="button" accessibilityLabel="Pay">
      <ThemedText style={styles.toolButtonText}>Pay</ThemedText>
    </Pressable>
  );

  return (
    <View style={styles.section}>
      <View style={styles.grid}>
        {/* Left column: Tools card */}
        <View style={styles.toolsCard}>
          <ThemedText style={styles.cardTitle}>Tools</ThemedText>
          <View style={styles.toolButtonsWrap}>
            {network === NETWORK_USDT ? (
              <ActionPopupButton actions={usdtReceiveActions} title="Layer to receive">
                {addFundsButton}
              </ActionPopupButton>
            ) : (
              addFundsButton
            )}
            {network === NETWORK_USDT ? (
              <ActionPopupButton actions={usdtSendActions} title="Choose network to send">
                {payButton}
              </ActionPopupButton>
            ) : (
              payButton
            )}
            <Pressable style={styles.toolButton} onPress={handleTrade} accessibilityRole="button" accessibilityLabel="Trade">
              <ThemedText style={styles.toolButtonText}>Trade</ThemedText>
            </Pressable>
          </View>
        </View>

        {/* Right column: Budget + Permissions */}
        <View style={styles.rightColumn}>
          <Pressable style={styles.budgetCard} onPress={noop} accessibilityRole="button" accessibilityLabel="Budget">
            <ThemedText style={styles.cardTitle}>Budget</ThemedText>
            <ThemedText style={styles.budgetAmount} numberOfLines={1} adjustsFontSizeToFit>
              {budgetFiat}
            </ThemedText>
            <ThemedText style={styles.budgetSats} numberOfLines={1}>
              {budgetSats}
            </ThemedText>
            <View style={styles.budgetDivider} />
            <View style={styles.spentRow}>
              <ThemedText style={styles.spentLabel}>Spent</ThemedText>
              <ThemedText style={styles.spentValue}>$0</ThemedText>
            </View>
          </Pressable>

          <Pressable style={styles.permissionsCard} onPress={() => router.push(permissionsRoute)} accessibilityRole="button" accessibilityLabel="Permissions">
            <View style={styles.lockIconWrap}>
              <Ionicons name="lock-closed" size={15} color="#ffffff" />
            </View>
            <View style={styles.permissionsTextWrap}>
              <ThemedText style={styles.permissionsTitle}>Permissions</ThemedText>
              <ThemedText style={styles.permissionsSubtitle}>6 out of 6</ThemedText>
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const CARD_BG = '#1a1a1a';
const INNER_BG = '#2a2a2a';

const styles = StyleSheet.create({
  section: {
    marginTop: 4,
    marginBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  toolsCard: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 18,
    padding: 12,
  },
  toolButtonsWrap: {
    flex: 1,
    marginTop: 4,
    gap: 6,
  },
  rightColumn: {
    flex: 1,
    gap: 8,
  },
  cardTitle: {
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(255, 255, 255, 0.72)',
    fontWeight: '500',
  },
  toolButton: {
    flex: 1,
    backgroundColor: INNER_BG,
    borderRadius: 12,
    paddingHorizontal: 12,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  toolButtonText: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  budgetCard: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 18,
    padding: 12,
  },
  budgetAmount: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
    marginTop: 1,
  },
  budgetSats: {
    color: 'rgba(255, 255, 255, 0.50)',
    fontSize: 11,
    lineHeight: 14,
    marginTop: 1,
  },
  budgetDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 6,
    marginBottom: 5,
  },
  spentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spentLabel: {
    color: 'rgba(255, 255, 255, 0.50)',
    fontSize: 11,
    lineHeight: 14,
  },
  spentValue: {
    color: '#ffffff',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
  },
  permissionsCard: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lockIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: INNER_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionsTextWrap: {
    flex: 1,
  },
  permissionsTitle: {
    color: '#ffffff',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  permissionsSubtitle: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 10,
    lineHeight: 13,
    marginTop: 1,
  },
});
