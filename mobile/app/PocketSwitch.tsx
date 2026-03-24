import { Foundation, Ionicons } from '@expo/vector-icons';
import Pressable from '../components/Pressable';
import { useRouter } from 'expo-router';
import React, { useContext, useMemo } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DetachedSheet from '@/components/DetachedSheet';
import { ThemedText } from '@/components/ThemedText';
import { AccountItem, AccountNumberContext, accountItems } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useAccountBalance } from '@shared/hooks/useAccountBalance';
import { useAvailableNetworks } from '@shared/hooks/useAvailableNetworks';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { formatBalance, formatFiatBalance } from '@shared/modules/string-utils';
import { NETWORK_BITCOIN } from '@shared/types/networks';
import { useExchangeRate } from '@shared/hooks/useExchangeRate';
import { useSelectedFiat } from '@shared/hooks/useSelectedFiat';
import { formatFiatDisplay } from '@shared/modules/fiat-utils';
import { overlayBackgroundSections } from '@shared/constants/Colors';

const TotalBalanceSection = () => {
  const availableNetworks = useAvailableNetworks();
  const fiat = useSelectedFiat();
  const { exchangeRate } = useExchangeRate(NETWORK_BITCOIN, fiat);

  // Get balances for all accounts (hooks must be called unconditionally)
  const { accountBalance: balance0 } = useAccountBalance(0, availableNetworks);
  const { accountBalance: balance1 } = useAccountBalance(1, availableNetworks);
  const { accountBalance: balance2 } = useAccountBalance(2, availableNetworks);
  const { accountBalance: balance3 } = useAccountBalance(3, availableNetworks);
  const { accountBalance: balance4 } = useAccountBalance(4, availableNetworks);

  const totalBalance = useMemo(() => {
    const balances = [balance0, balance1, balance2, balance3, balance4].slice(0, accountItems.length);
    return balances.reduce((sum, bal) => sum + (parseInt(bal) || 0), 0).toString();
  }, [balance0, balance1, balance2, balance3, balance4]);

  const totalUsd = totalBalance && exchangeRate ? formatFiatBalance(totalBalance, getDecimalsByNetwork(NETWORK_BITCOIN), exchangeRate) : '—';

  return (
    <View style={styles.totalBalanceSection}>
      <ThemedText style={styles.totalBalanceLabel}>Total balance</ThemedText>
      <ThemedText type="sfProRounded" style={styles.totalBalanceAmount}>
        {formatFiatDisplay(totalUsd, fiat)}
      </ThemedText>
    </View>
  );
};
const ListItem = ({ item, onPress, accountNumber, currentAccountNumber }: { item: AccountItem; onPress: () => void; accountNumber: number; currentAccountNumber: number }) => {
  const availableNetworks = useAvailableNetworks();
  const IconComponent = item.iconCollection === 'ion' ? Ionicons : Foundation;
  const { accountBalance } = useAccountBalance(accountNumber, availableNetworks);
  const fiat = useSelectedFiat();
  const { exchangeRate } = useExchangeRate(NETWORK_BITCOIN, fiat);

  const active = accountNumber === currentAccountNumber;

  const usdBalance = accountBalance && exchangeRate ? formatFiatBalance(accountBalance, getDecimalsByNetwork(NETWORK_BITCOIN), exchangeRate) : '—';

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
        <ThemedText style={styles.usdBalance}>{formatFiatDisplay(usdBalance, fiat)}</ThemedText>
      </View>
    </Pressable>
  );
};

export default function PocketSwitch() {
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const { accountNumber: currentAccountNumber, setAccountNumber } = useContext(AccountNumberContext);

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
          {/* Total Balance Section */}
          <TotalBalanceSection />

          {/* Header */}
          <View style={styles.header}>
            <ThemedText style={styles.title}>Pockets</ThemedText>
          </View>
          {/* Target Networks List */}
          <View style={styles.listContainer}>
            {accountItems.map((item, index) => (
              <ListItem key={index} accountNumber={index} currentAccountNumber={currentAccountNumber} item={item} onPress={() => handleSelect(index)} />
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
