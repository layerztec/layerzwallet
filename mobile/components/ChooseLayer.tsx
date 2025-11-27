import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { getNetworkGradient } from '@shared/constants/Colors';
import { getTickerByNetwork } from '@shared/models/network-getters';
import { capitalizeFirstLetter } from '@shared/modules/string-utils';
import { NETWORK_ARK, NETWORK_LIQUID, NETWORK_LIQUID_TESTNET, NETWORK_SPARK } from '@shared/types/networks';
import { getNetworkImageAsset } from '@/utils/networkAssets';

export type LightningLayer = typeof NETWORK_SPARK | typeof NETWORK_LIQUID | typeof NETWORK_LIQUID_TESTNET | typeof NETWORK_ARK;

interface ChooseLayerProps {
  selectedLayer: LightningLayer | null;
  onSelectLayer: (layer: LightningLayer) => void;
  isTestnet?: boolean;
}

const ChooseLayer: React.FC<ChooseLayerProps> = ({ selectedLayer, onSelectLayer, isTestnet = false }) => {
  const availableLayers: LightningLayer[] = isTestnet ? [NETWORK_LIQUID_TESTNET] : [NETWORK_SPARK, NETWORK_LIQUID, NETWORK_ARK];

  return (
    <View style={styles.container}>
      <ThemedText style={styles.title}>Choose Layer</ThemedText>
      <View style={styles.layersContainer}>
        {availableLayers.map((layer) => {
          const isSelected = selectedLayer === layer;
          const networkImage = getNetworkImageAsset(layer);
          const gradientColors = getNetworkGradient(layer);
          const ticker = getTickerByNetwork(layer);

          return (
            <TouchableOpacity key={layer} style={[styles.layerCard, isSelected && styles.selectedLayerCard]} onPress={() => onSelectLayer(layer)} activeOpacity={0.8}>
              <View style={[styles.layerIconContainer, { backgroundColor: gradientColors[0] }]}>
                {networkImage ? <Image source={networkImage} style={styles.layerIcon} contentFit="contain" /> : null}
              </View>
              <ThemedText style={styles.layerName}>{capitalizeFirstLetter(layer)}</ThemedText>
              <ThemedText style={styles.layerTicker}>{ticker}</ThemedText>
              {isSelected && (
                <View style={styles.checkmarkContainer}>
                  <ThemedText style={styles.checkmark}>✓</ThemedText>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 12,
  },
  layersContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  layerCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  selectedLayerCard: {
    borderColor: 'rgba(255, 255, 255, 0.5)',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  layerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  layerIcon: {
    width: 28,
    height: 28,
  },
  layerName: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
  },
  layerTicker: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  checkmarkContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default ChooseLayer;
