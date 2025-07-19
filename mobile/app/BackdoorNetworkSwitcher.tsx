import React, { useContext } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useAvailableNetworks } from '@shared/hooks/useAvailableNetworks';

const BackdoorNetworkSwitcher: React.FC = () => {
  const router = useRouter();
  const { network: currentNetwork, setNetwork } = useContext(NetworkContext);
  const networks = useAvailableNetworks();

  const handleNetworkSelect = (networkId: string) => {
    setNetwork(networkId as any);
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      {networks.map((network) => (
        <TouchableOpacity
          key={network}
          testID={`backdoor-network-${network}`}
          style={[styles.networkItem, currentNetwork === network && styles.selectedNetworkItem]}
          onPress={() => handleNetworkSelect(network)}
          activeOpacity={0.7}
        >
          <View style={styles.networkItemContent}>
            <Text>{network}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
