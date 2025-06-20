import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useContext, useRef, useLayoutEffect } from 'react';
import { FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { getAvailableNetworks, Networks } from '@shared/types/networks';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { getIsTestnet } from '@shared/models/network-getters';
import { Colors, getNetworkGradient, getNetworkIcon } from '@shared/constants/Colors';

const NetworkSelector: React.FC = () => {
  const router = useRouter();
  const { network: currentNetwork, setNetwork } = useContext(NetworkContext);
  const networks = getAvailableNetworks();
  const flatListRef = useRef<FlatList>(null);

  // Auto-scroll to selected network when modal appears
  useLayoutEffect(() => {
    const scrollToSelectedNetwork = () => {
      const selectedIndex = networks.findIndex((network) => network === currentNetwork);

      if (selectedIndex !== -1 && flatListRef.current) {
        flatListRef.current?.scrollToIndex({
          index: selectedIndex,
          animated: false,
        });
      }
    };

    const timer = setTimeout(scrollToSelectedNetwork, 100);
    return () => clearTimeout(timer);
  }, [currentNetwork, networks]);

  const handleNetworkSelect = (network: Networks) => {
    setNetwork(network);
    router.back();
  };

  const AnimatedNetworkCard: React.FC<{ network: Networks }> = ({ network: availableNetwork }) => {
    const scale = useSharedValue(1);
    const isSelected = currentNetwork === availableNetwork;
    const isTestnet = getIsTestnet(availableNetwork);
    const gradientColors = getNetworkGradient(availableNetwork);

    const handlePressIn = () => {
      scale.value = withSpring(0.98, { damping: 20, stiffness: 400 });
    };

    const handlePressOut = () => {
      scale.value = withSpring(1, { damping: 20, stiffness: 400 });
    };

    const handlePress = () => {
      handleNetworkSelect(availableNetwork);
    };

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    return (
      <Animated.View style={[{ marginBottom: 12 }, animatedStyle]} testID={`network-${availableNetwork}`}>
        <TouchableOpacity
          testID={isSelected ? `selectedNetwork-${availableNetwork}` : undefined}
          style={[styles.networkCard, isSelected && styles.selectedNetworkCard]}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
        >
          <ThemedView style={styles.networkCardContent}>
            <ThemedView
              style={[
                styles.networkIconContainer,
                {
                  backgroundColor: isSelected ? gradientColors[0] : '#F3F4F6',
                },
              ]}
            >
              <Ionicons name={getNetworkIcon(availableNetwork)} size={24} color={isSelected ? 'white' : '#374151'} />
            </ThemedView>
            <ThemedView style={styles.networkInfo}>
              <ThemedText style={[styles.networkCardTitle, isSelected && styles.selectedNetworkCardTitle]}>{availableNetwork.charAt(0).toUpperCase() + availableNetwork.slice(1)}</ThemedText>
              <ThemedView style={styles.networkStatus}>
                <ThemedView
                  style={[
                    styles.statusIndicator,
                    {
                      backgroundColor: isTestnet ? '#F59E0B' : '#059669',
                    },
                  ]}
                />
                <ThemedText style={[styles.networkCardSubtitle, isSelected && styles.selectedNetworkCardSubtitle]}>{isTestnet ? 'Testnet' : 'Mainnet'}</ThemedText>
              </ThemedView>
            </ThemedView>

            {isSelected && (
              <Animated.View style={styles.selectedIndicator}>
                <ThemedView style={styles.checkmarkContainer}>
                  <Ionicons name="checkmark" size={16} color="white" />
                </ThemedView>
              </Animated.View>
            )}
          </ThemedView>

          {isSelected && <Animated.View style={[styles.selectionLine, { backgroundColor: gradientColors[0] }]} />}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <FlatList
      ref={flatListRef}
      automaticallyAdjustsScrollIndicatorInsets
      automaticallyAdjustContentInsets
      automaticallyAdjustKeyboardInsets
      contentInset={{ top: 0, left: 0, bottom: 100, right: 0 }}
      contentInsetAdjustmentBehavior="automatic"
      data={networks}
      testID="NetworkSelectorList"
      renderItem={({ item: availableNetwork }) => <AnimatedNetworkCard key={availableNetwork} network={availableNetwork} />}
      nestedScrollEnabled
      keyExtractor={(item) => item}
      style={styles.networkList}
      contentContainerStyle={styles.networkListContent}
      onScrollToIndexFailed={(info) => {
        const wait = new Promise((resolve) => setTimeout(resolve, 500));
        wait.then(() => {
          flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
        });
      }}
    />
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
  },
  closeButton: {
    padding: 4,
  },

  networkList: {
    backgroundColor: '#FFFFFF',
  },
  networkListContent: {
    padding: 24,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  networkCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  selectedNetworkCard: {
    borderColor: Colors.light.tint,
    backgroundColor: '#FFFFFF',
    shadowColor: Colors.light.tint,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    transform: [{ scale: 1.02 }],
  },
  networkCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  networkIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  networkInfo: {
    flex: 1,
    gap: 4,
  },
  networkCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  selectedNetworkCardTitle: {
    color: '#111827',
  },
  networkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  networkCardSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  selectedNetworkCardSubtitle: {
    color: '#4B5563',
  },
  selectedIndicator: {
    marginLeft: 8,
  },
  checkmarkContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});

const Header = () => (
  <ThemedView testID="NetworkSelectorHeader" style={styles.header}>
    <ThemedView style={styles.headerContent}>
      <Ionicons name="grid" size={24} color={Colors.light.icon} />
      <ThemedText style={styles.title}>Select Network</ThemedText>
    </ThemedView>
  </ThemedView>
);

export default NetworkSelector;
export { Header };
