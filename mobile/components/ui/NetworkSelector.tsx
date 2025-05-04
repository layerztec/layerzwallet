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
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        padding: 10,
        gap: 8,
        borderRadius: 12,
        marginBottom: 16,
        backgroundColor: getColor('surfaceBackground'),
      }}
    >
      {networks.map((network) => {
        const isSelected = network === selectedNetwork;
        return (
          <Pressable
            key={network}
            testID={isSelected ? `selectedNetwork-${network}` : `network-${network}`}
            onPress={() => onNetworkChange(network)}
            style={({ pressed }) => [
              {
                backgroundColor: isSelected ? getColor('selectedNetworkBackground') : getColor('surfaceBackground'),
                borderRadius: 16,
                margin: 4,
                paddingVertical: 8,
                paddingHorizontal: 16,
                minWidth: 60,
                borderWidth: 0,
                justifyContent: 'center',
                alignItems: 'center',
                shadowColor: isSelected ? '#000' : undefined,
                shadowOffset: isSelected ? { width: 0, height: 2 } : undefined,
                shadowOpacity: isSelected ? 0.08 : 0,
                shadowRadius: isSelected ? 8 : 0,
                elevation: isSelected ? 2 : 0,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <ThemedText
              style={{
                color: isSelected ? getColor('selectedNetworkText') : getColor('networkButtonText'),
                fontSize: 13,
                fontWeight: '600',
                letterSpacing: 0.5,
              }}
            >
              {network.toUpperCase()}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
};
