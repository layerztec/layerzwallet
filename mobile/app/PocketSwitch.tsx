import { Foundation, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Pressable from '../components/Pressable';
import { useRouter } from 'expo-router';
import React, { useContext, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/ThemedText';
import { AccountItem, AccountNumberContext, accountItems } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useAccountBalance } from '@shared/hooks/useAccountBalance';
import { useAvailableNetworks } from '@shared/hooks/useAvailableNetworks';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { formatBalance, formatFiatBalance } from '@shared/modules/string-utils';
import { NETWORK_BITCOIN } from '@shared/types/networks';
import { useExchangeRate } from '@shared/hooks/useExchangeRate';
import { getNetworkGradient, overlayBackgroundSections } from '@shared/constants/Colors';

const TotalBalanceSection = () => {
  const availableNetworks = useAvailableNetworks();
  const { exchangeRate } = useExchangeRate(NETWORK_BITCOIN, 'USD');

  // Get balances for all accounts (hooks must be called unconditionally)
  const { accountBalance: balance0 } = useAccountBalance(accountItems[0].accountNumber, availableNetworks);
  const { accountBalance: balance1 } = useAccountBalance(accountItems[1].accountNumber, availableNetworks);
  const { accountBalance: balance2 } = useAccountBalance(accountItems[2].accountNumber, availableNetworks);
  const { accountBalance: balance3 } = useAccountBalance(accountItems[3].accountNumber, availableNetworks);
  const { accountBalance: balanceMcp } = useAccountBalance(accountItems[4].accountNumber, availableNetworks);

  const totalBalance = useMemo(() => {
    const balances = [balance0, balance1, balance2, balance3, balanceMcp].slice(0, accountItems.length);
    return balances.reduce((sum, bal) => sum + (parseInt(bal) || 0), 0).toString();
  }, [balance0, balance1, balance2, balance3, balanceMcp]);

  const totalUsd = totalBalance && exchangeRate ? formatFiatBalance(totalBalance, getDecimalsByNetwork(NETWORK_BITCOIN), exchangeRate) : '—';

  return (
    <View style={styles.totalBalanceSection}>
      <ThemedText style={styles.totalBalanceLabel}>Total balance</ThemedText>
      <ThemedText type="sfProRounded" style={styles.totalBalanceAmount}>
        ${totalUsd}
      </ThemedText>
    </View>
  );
};
const ListItem = ({ item, onPress, currentAccountNumber }: { item: AccountItem; onPress: () => void; currentAccountNumber: number }) => {
  const availableNetworks = useAvailableNetworks();
  const IconComponent = item.iconCollection === 'ion' ? Ionicons : item.iconCollection === 'material-community' ? MaterialCommunityIcons : Foundation;
  const { accountBalance } = useAccountBalance(item.accountNumber, availableNetworks);
  const { exchangeRate } = useExchangeRate(NETWORK_BITCOIN, 'USD');

  const active = item.accountNumber === currentAccountNumber;

  const usdBalance = accountBalance && exchangeRate ? formatFiatBalance(accountBalance, getDecimalsByNetwork(NETWORK_BITCOIN), exchangeRate) : '—';

  return (
    <Pressable style={[styles.item, active && styles.activeItem]} onPress={onPress} scaleOnPress={0.97}>
      <View style={styles.icon}>
        <IconComponent name={item.icon as any} size={24} color="white" style={item.iconCollection === 'material-community' ? styles.materialIconNudge : undefined} />
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
  const insets = useSafeAreaInsets();
  const { network } = useContext(NetworkContext);
  const { accountNumber: currentAccountNumber, setAccountNumber } = useContext(AccountNumberContext);
  const gradient = getNetworkGradient(network);

  const handleClose = () => {
    router.back();
  };

  const handleSelect = (accountNumber: number) => {
    setAccountNumber(accountNumber);
    router.back();
  };

  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} noFeedback accessibilityLabel="Close pocket switcher" />
      <LinearGradient colors={[gradient[0], '#050505']} locations={[0, 0.82]} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.handle} />
        <ScrollView contentContainerStyle={styles.container} testID="AccountSwitcherModal" showsVerticalScrollIndicator={false}>
          {/* Total Balance Section */}
          <TotalBalanceSection />

          {/* Header */}
          <View style={styles.header}>
            <ThemedText style={styles.title}>Pockets</ThemedText>
          </View>
          {/* Target Networks List */}
          <View style={styles.listContainer}>
            {accountItems.map((item) => (
              <ListItem key={item.accountNumber} item={item} currentAccountNumber={currentAccountNumber} onPress={() => handleSelect(item.accountNumber)} />
            ))}
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  sheet: {
    maxHeight: '88%',
    minHeight: 560,
    marginHorizontal: 12,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    marginTop: 10,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  container: {
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
  materialIconNudge: {
    marginTop: -3,
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
