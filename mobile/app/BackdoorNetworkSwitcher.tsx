import React, { useContext } from 'react';
import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useAvailableNetworks } from '@shared/hooks/useAvailableNetworks';
import { Networks } from '@shared/types/networks';

const BackdoorNetworkSwitcher: React.FC = () => {
  const router = useRouter();
  const { network: currentNetwork, setNetwork } = useContext(NetworkContext);
  const networks = useAvailableNetworks();

  const handleNetworkSelect = (networkId: string) => {
    setNetwork(networkId as any);
    router.back();
  };

  const renderNetworkItem = ({ item }: { item: Networks }) => {
    const name = item.charAt(0).toUpperCase() + item.slice(1);
    const isSelected = currentNetwork === item;

    return (
      <TouchableOpacity testID={`backdoor-network-${item}`} style={[styles.networkItem, isSelected && styles.selectedNetworkItem]} onPress={() => handleNetworkSelect(item)} activeOpacity={0.7}>
        <View style={styles.networkItemContent}>
          <Text>{name}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList data={networks} renderItem={renderNetworkItem} keyExtractor={(item) => item} contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  networkItem: {
    marginBottom: 4,
    padding: 8,
  },
  selectedNetworkItem: {
    backgroundColor: '#e3f2fd',
  },
  networkItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

export default BackdoorNetworkSwitcher;
