import { useRouter } from 'expo-router';
import React, { useContext, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import PlatformBlurView from '@/components/PlatformBlurView';
import { Networks } from '@shared/types/networks';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getIsTestnet, getTickerByNetwork } from '@shared/models/network-getters';
import { useAvailableNetworks } from '@shared/hooks/useAvailableNetworks';
import { getNetworkGradient } from '@shared/constants/Colors';
import DashboardTiles, { LayerCard } from '@/components/DashboardTiles';
import { capitalizeFirstLetter } from '@shared/modules/string-utils';
import { getNetworkImageAsset } from '@/utils/networkAssets';

const NetworkSelector: React.FC = () => {
  const router = useRouter();
  const { network: currentNetwork, setNetwork } = useContext(NetworkContext);
  const networks = useAvailableNetworks();

  const handleNetworkSelect = (network: Networks) => {
    setNetwork(network);
    router.back();
  };

  // Transform network data into the format DashboardTiles expects
  const networkCards: (LayerCard & { isSelected: boolean })[] = useMemo(() => {
    return networks.map((network) => {
      const isTestnet = getIsTestnet(network);
      const gradientColors = getNetworkGradient(network);
      const networkIcon = getNetworkImageAsset(network);

      return {
        name: capitalizeFirstLetter(network),
        ticker: getTickerByNetwork(network),
        balance: currentNetwork === network ? 'Selected' : 'Available',
        usdValue: isTestnet ? 'Testnet' : 'Mainnet',
        color: gradientColors[0],
        icon: networkIcon,
        tags: isTestnet ? ['Testnet'] : [],
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
      <PlatformBlurView intensity={30} tint="dark" style={styles.backgroundBlur}/>
      <DashboardTiles cards={networkCards} onCardPress={handleCardPress} onClose={handleClose} />
    </View>

  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundBlur: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
});

export default NetworkSelector;
