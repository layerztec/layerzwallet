import { Foundation, Ionicons } from '@expo/vector-icons';
import Pressable from '../components/Pressable';
import { useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DetachedSheet from '@/components/DetachedSheet';
import { ThemedText } from '@/components/ThemedText';
import { AccountItem, AccountNumberContext, accountItems } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useAccountBalance } from '@shared/hooks/useAccountBalance';
import { useAvailableNetworks } from '@shared/hooks/useAvailableNetworks';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { formatBalance } from '@shared/modules/string-utils';
import { NETWORK_BITCOIN } from '@shared/types/networks';
import { overlayBackgroundSections } from '@shared/constants/Colors';

const ListItem = ({ item, onPress, accountNumber, currentAccountNumber }: { item: AccountItem; onPress: () => void; accountNumber: number; currentAccountNumber: number }) => {
  const availableNetworks = useAvailableNetworks();
  const IconComponent = item.iconCollection === 'ion' ? Ionicons : Foundation;
  const { accountBalance } = useAccountBalance(accountNumber, availableNetworks);

  const active = accountNumber === currentAccountNumber;
  const first = accountNumber === 0;
  const last = accountNumber === accountItems.length - 1;

  return (
    <Pressable style={[styles.item, active && styles.activeItem, first && styles.firstItem, last && styles.lastItem]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.icon}>
        <IconComponent name={item.icon as any} size={24} color="white" />
      </View>
      <View style={styles.info}>
        <ThemedText style={styles.name}>{item.name}</ThemedText>
        <ThemedText style={styles.balance}>
          {accountBalance ? formatBalance(accountBalance, getDecimalsByNetwork(NETWORK_BITCOIN), 8) : '0'} {getTickerByNetwork(NETWORK_BITCOIN)}
        </ThemedText>
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
          {/* Header */}
          <View style={styles.header}>
            <ThemedText style={styles.title}>Your pockets</ThemedText>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginTop: 8,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    fontWeight: '500',
  },
  listContainer: {
    gap: 2,
  },
  item: {
    backgroundColor: overlayBackgroundSections,
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
    backgroundColor: overlayBackgroundSections,
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
    color: 'rgba(255, 255, 255, 0.5)',
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
