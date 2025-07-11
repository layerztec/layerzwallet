import { useRouter } from 'expo-router';
import React, { useContext, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Networks } from '@shared/types/networks';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getIsTestnet } from '@shared/models/network-getters';
import { useAvailableNetworks } from '@shared/hooks/useAvailableNetworks';
import { getNetworkGradient, getNetworkIcon } from '@shared/constants/Colors';
import DashboardTiles from '@/components/DashboardTiles';

const NetworkSelector: React.FC = () => {
  const router = useRouter();
  const { network: currentNetwork, setNetwork } = useContext(NetworkContext);
  const networks = useAvailableNetworks();

  const handleNetworkSelect = (network: Networks) => {
    setNetwork(network);
    router.back();
  };

  // Transform network data into the format DashboardTiles expects
  const networkCards = useMemo(() => {
    return networks.map((network) => {
      const isTestnet = getIsTestnet(network);
      const gradientColors = getNetworkGradient(network);
      const iconName = getNetworkIcon(network);

      return {
        name: network.charAt(0).toUpperCase() + network.slice(1),
        ticker: network.toUpperCase(),
        balance: currentNetwork === network ? 'Selected' : 'Available',
        usdValue: isTestnet ? 'Testnet' : 'Mainnet',
        color: gradientColors[0],
        icon: null, // We'll use Ionicons instead
        iconName: iconName,
        tags: isTestnet ? ['Testnet'] : ['Mainnet'],
        tokenCount: 0,
        networkId: network,
        isSelected: currentNetwork === network,
      };
    });
  }, [networks, currentNetwork]);

  // Custom render prop for DashboardTiles to handle network selection
  const handleCardPress = (index: number) => {
    // Add safety check to prevent crashes
    if (index >= 0 && index < networks.length) {
      const selectedNetwork = networks[index];
      handleNetworkSelect(selectedNetwork);
    }
  };

  const handleClose = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <DashboardTiles cards={networkCards} onCardPress={handleCardPress} onClose={handleClose} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // Transparent dark overlay
  },
});

export default NetworkSelector;
