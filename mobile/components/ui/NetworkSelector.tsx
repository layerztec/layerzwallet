import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { ThemedText } from '../ThemedText';
import { useTheme } from '@/hooks/ThemeContext';
import { getAvailableNetworks, Networks } from '@shared/types/networks';

interface NetworkSelectorProps {
  selectedNetwork: Networks;
  onNetworkChange: (network: Networks) => void;
  filterLiquid?: boolean;
}

export const NetworkSelector: React.FC<NetworkSelectorProps> = ({ selectedNetwork, onNetworkChange, filterLiquid = true }) => {
  const { getColor } = useTheme();
  const networks = getAvailableNetworks().filter((n) => !filterLiquid || !n.includes('liquid'));

  return (
    <View style={styles.networkContainer}>
      {networks.map((network) => (
        <Pressable
          key={network}
          testID={network === selectedNetwork ? `selectedNetwork-${network}` : `network-${network}`}
          style={({ pressed }) => [
            styles.networkButton,
            { backgroundColor: getColor('surfaceBackground') },
            network === selectedNetwork && { backgroundColor: getColor('selectedNetworkBackground') },
            pressed && { opacity: 0.8 },
          ]}
          onPress={() => onNetworkChange(network)}
        >
          <ThemedText style={[styles.networkButtonText, { color: getColor('networkButtonText') }, network === selectedNetwork && { color: getColor('selectedNetworkText') }]}>
            {network.toUpperCase()}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  networkContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    padding: 10,
    gap: 8,
  },
  networkButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginHorizontal: 4,
    marginVertical: 4,
  },
  networkButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
