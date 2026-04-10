import { Foundation, Ionicons } from '@expo/vector-icons';
import Pressable from '../components/Pressable';
import { useRouter } from 'expo-router';
import React, { useContext, useMemo } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DetachedSheet from '@/components/DetachedSheet';
import { ThemedText } from '@/components/ThemedText';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { AccountItem, AccountNumberContext, accountItems } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useAccountBalance } from '@shared/hooks/useAccountBalance';
import { useAvailableNetworks } from '@shared/hooks/useAvailableNetworks';
import { useSparkUsdbEarnMetrics } from '@shared/hooks/useSparkUsdbEarnMetrics';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { formatBalance, formatFiatBalance } from '@shared/modules/string-utils';
import { NETWORK_BITCOIN } from '@shared/types/networks';
import { useExchangeRate } from '@shared/hooks/useExchangeRate';
import { overlayBackgroundSections } from '@shared/constants/Colors';

const TotalBalanceSection = ({ totalUsdDisplay }: { totalUsdDisplay: string }) => {
  return (
    <View style={styles.totalBalanceSection}>
      <ThemedText style={styles.totalBalanceLabel}>Total balance</ThemedText>
      <ThemedText type="sfProRounded" style={styles.totalBalanceAmount}>
        ${totalUsdDisplay}
      </ThemedText>
    </View>
  );
};

const ListItem = ({
  item,
  onPress,
  accountNumber,
  currentAccountNumber,
  sparkUsdbAllocatedUsd,
}: {
  item: AccountItem;
  onPress: () => void;
  accountNumber: number;
  currentAccountNumber: number;
  /** Spark USDB allocated position in USD (token balance not in native pocket sum). BTC yield is already in Spark native balance. */
  sparkUsdbAllocatedUsd: number;
}) => {
  const availableNetworks = useAvailableNetworks();
  const IconComponent = item.iconCollection === 'ion' ? Ionicons : Foundation;
  const { accountBalance } = useAccountBalance(accountNumber, availableNetworks);
  const { exchangeRate } = useExchangeRate(NETWORK_BITCOIN, 'USD');

  const active = accountNumber === currentAccountNumber;

  const usdBalance = useMemo(() => {
    if (!exchangeRate) return '—';
    const btcUsd = accountBalance ? parseFloat(formatFiatBalance(accountBalance, getDecimalsByNetwork(NETWORK_BITCOIN), exchangeRate)) : 0;
    return (btcUsd + sparkUsdbAllocatedUsd).toFixed(2);
  }, [accountBalance, exchangeRate, sparkUsdbAllocatedUsd]);

  return (
    <Pressable style={[styles.item, active && styles.activeItem]} onPress={onPress} scaleOnPress={0.97}>
      <View style={styles.icon}>
        <IconComponent name={item.icon as any} size={24} color="white" />
      </View>
      <View style={styles.info}>
        <ThemedText style={styles.name}>{item.name}</ThemedText>
        <ThemedText style={styles.balance}>
          {accountBalance ? formatBalance(accountBalance, getDecimalsByNetwork(NETWORK_BITCOIN), 8) : '0'} {getTickerByNetwork(NETWORK_BITCOIN)}
        </ThemedText>
      </View>
      <View style={styles.usdContainer}>
        <ThemedText style={styles.usdBalance}>${usdBalance}</ThemedText>
      </View>
    </Pressable>
  );
};

export default function PocketSwitch() {
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const { accountNumber: currentAccountNumber, setAccountNumber } = useContext(AccountNumberContext);

  const availableNetworks = useAvailableNetworks();
  const { exchangeRate } = useExchangeRate(NETWORK_BITCOIN, 'USD');

  const { accountBalance: balance0 } = useAccountBalance(0, availableNetworks);
  const { accountBalance: balance1 } = useAccountBalance(1, availableNetworks);
  const { accountBalance: balance2 } = useAccountBalance(2, availableNetworks);
  const { accountBalance: balance3 } = useAccountBalance(3, availableNetworks);
  const { accountBalance: balance4 } = useAccountBalance(4, availableNetworks);

  const earnMetrics0 = useSparkUsdbEarnMetrics(0, BackgroundExecutor);
  const earnMetrics1 = useSparkUsdbEarnMetrics(1, BackgroundExecutor);
  const earnMetrics2 = useSparkUsdbEarnMetrics(2, BackgroundExecutor);
  const earnMetrics3 = useSparkUsdbEarnMetrics(3, BackgroundExecutor);
  const earnMetrics4 = useSparkUsdbEarnMetrics(4, BackgroundExecutor);

  const totalUsdDisplay = useMemo(() => {
    if (!exchangeRate) return '—';
    const balances = [balance0, balance1, balance2, balance3, balance4].slice(0, accountItems.length);
    const btcSumSats = balances.reduce((sum, bal) => sum + (parseInt(bal, 10) || 0), 0);
    const btcUsd = parseFloat(formatFiatBalance(String(btcSumSats), getDecimalsByNetwork(NETWORK_BITCOIN), exchangeRate));
    const earnMetrics = [earnMetrics0, earnMetrics1, earnMetrics2, earnMetrics3, earnMetrics4].slice(0, accountItems.length);
    /** USDB only — matches token not in native balance; BTC yield already in Spark sats above. */
    const usdbEarnSum = earnMetrics.reduce((sum, m) => sum + m.allocatedUsd, 0);
    return (btcUsd + usdbEarnSum).toFixed(2);
  }, [exchangeRate, balance0, balance1, balance2, balance3, balance4, earnMetrics0, earnMetrics1, earnMetrics2, earnMetrics3, earnMetrics4]);

  const sparkUsdbAllocatedByAccount = useMemo(
    () => [earnMetrics0, earnMetrics1, earnMetrics2, earnMetrics3, earnMetrics4].slice(0, accountItems.length).map((m) => m.allocatedUsd),
    [earnMetrics0, earnMetrics1, earnMetrics2, earnMetrics3, earnMetrics4]
  );

  const handleClose = () => {
    router.back();
  };

  const handleSelect = (index: number) => {
    setAccountNumber(index);
    router.back();
  };

  return (
    <DetachedSheet variant={network} onClose={handleClose}>
      <SafeAreaView style={styles.safeArea} edges={Platform.OS === 'ios' ? ['left', 'right', 'bottom'] : ['left', 'right']}>
        <View style={styles.container}>
          <TotalBalanceSection totalUsdDisplay={totalUsdDisplay} />

          <View style={styles.header}>
            <ThemedText style={styles.title}>Pockets</ThemedText>
          </View>
          <View style={styles.listContainer}>
            {accountItems.map((item, index) => (
              <ListItem
                key={index}
                accountNumber={index}
                currentAccountNumber={currentAccountNumber}
                item={item}
                sparkUsdbAllocatedUsd={sparkUsdbAllocatedByAccount[index] ?? 0}
                onPress={() => handleSelect(index)}
              />
            ))}
          </View>
        </View>
      </SafeAreaView>
    </DetachedSheet>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    marginHorizontal: 16,
    paddingBottom: 16,
  },
  totalBalanceSection: {
    alignItems: 'flex-start',
    marginTop: 16,
    marginBottom: 24,
  },
  totalBalanceLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 4,
  },
  totalBalanceAmount: {
    fontSize: 52,
    color: '#ffffff',
    lineHeight: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
  },
  listContainer: {
    gap: 8,
  },
  item: {
    backgroundColor: overlayBackgroundSections,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    borderRadius: 24,
  },
  activeItem: {
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    color: '#ffffff',
  },
  balance: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  usdContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  usdBalance: {
    fontSize: 13,
    fontWeight: '500',
    color: '#ffffff',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 24,
  },
});
