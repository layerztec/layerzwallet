import { Foundation, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import GradientFormSheet from '@/components/GradientFormSheet';
import { ThemedText } from '@/components/ThemedText';
import { AccountItem, AccountNumberContext, accountItems } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useAccountBalance } from '@shared/hooks/useAccountBalance';
import { useAvailableNetworks } from '@shared/hooks/useAvailableNetworks';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { formatBalance } from '@shared/modules/string-utils';
import { NETWORK_BITCOIN } from '@shared/types/networks';

const ListItem = ({ item, onPress, accountNumber }: { item: AccountItem; onPress: () => void; accountNumber: number }) => {
  const availableNetworks = useAvailableNetworks();
  const IconComponent = item.iconCollection === 'ion' ? Ionicons : Foundation;
  const { accountBalance } = useAccountBalance(accountNumber, availableNetworks);

  const active = accountNumber === accountNumber;
  const first = accountNumber === 0;
  const last = accountNumber === accountItems.length - 1;

  return (
    <TouchableOpacity style={[styles.item, active && styles.activeItem, first && styles.firstItem, last && styles.lastItem]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.icon}>
        <IconComponent name={item.icon as any} size={24} color="white" />
      </View>
      <View style={styles.info}>
        <ThemedText style={styles.name}>{item.name}</ThemedText>
        <ThemedText style={styles.balance}>
          {accountBalance ? formatBalance(accountBalance, getDecimalsByNetwork(NETWORK_BITCOIN), 8) : '0'} {getTickerByNetwork(NETWORK_BITCOIN)}
        </ThemedText>
      </View>
    </TouchableOpacity>
  );
};

export default function PocketSwitch() {
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const { accountNumber, setAccountNumber } = useContext(AccountNumberContext);

  const handleClose = () => {
    router.back();
  };

  const handleSelect = (index: number) => {
    setAccountNumber(index);
    router.back();
  };

  return (
    <GradientFormSheet variant={network}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={styles.title}>Your pockets</ThemedText>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close" size={20} color="rgba(255, 255, 255, 0.8)" />
        </TouchableOpacity>

        {/* Target Networks List */}
        <View style={styles.listContainer}>
          {accountItems.map((item, index) => (
            <ListItem key={index} accountNumber={index} item={item} onPress={() => handleSelect(index)} />
          ))}
        </View>
      </View>
    </GradientFormSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginTop: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    paddingTop: 8,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    fontWeight: '400',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    flex: 1,
    gap: 2,
  },
  item: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
  },
  firstItem: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  lastItem: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  activeItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
    // justifyContent: 'center',
    // alignItems: 'flex-start',
    // gap: 1,
    // backgroundColor: 'red',
  },
  name: {
    fontSize: 16,
    color: '#ffffff',
  },
  balance: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.3)',
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
