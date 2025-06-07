import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useContext, useRef, useEffect } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { getNetworkIcon, getNetworkGradient, Colors } from '@/constants/Colors';
import { getAvailableNetworks, Networks } from '@shared/types/networks';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { getIsTestnet } from '@shared/models/network-getters';

const NetworkSelectorModal: React.FC = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { network: currentNetwork, setNetwork } = useContext(NetworkContext);
  const networks = getAvailableNetworks();
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to selected network when modal appears
  useEffect(() => {
    const scrollToSelectedNetwork = () => {
      const selectedIndex = networks.findIndex((network) => network === currentNetwork);

      if (selectedIndex !== -1 && scrollViewRef.current) {
        const cardHeight = 84;
        const headerOffset = 100;
        const targetPosition = selectedIndex * cardHeight;

        scrollViewRef.current?.scrollTo({
          y: Math.max(0, targetPosition - headerOffset),
        });
      }
    };

    scrollToSelectedNetwork();
  }, [currentNetwork, networks]);

  const handleNetworkSelect = (network: Networks) => {
    setNetwork(network);
    router.back();
  };

  const handleClose = () => {
    router.back();
  };

  const AnimatedNetworkCard: React.FC<{ network: Networks }> = ({ network: availableNetwork }) => {
    const scale = useSharedValue(1);
    const isSelected = currentNetwork === availableNetwork;
    const isTestnet = getIsTestnet(availableNetwork);
    const gradientColors = getNetworkGradient(availableNetwork);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
      scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
    };

    const handlePressOut = () => {
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    };

    const handlePress = () => {
      handleNetworkSelect(availableNetwork);
    };

    return (
      <Animated.View entering={FadeIn.delay(100).duration(300)} exiting={FadeOut.duration(200)} style={animatedStyle}>
        <TouchableOpacity
          testID={isSelected ? `selectedNetwork-${availableNetwork}` : `network-${availableNetwork}`}
          style={[styles.networkCard, isSelected && styles.selectedNetworkCard]}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.7}
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
              <Animated.View style={styles.selectedIndicator} entering={FadeIn.duration(200).springify()} exiting={FadeOut.duration(150)}>
                <ThemedView style={styles.checkmarkContainer}>
                  <Ionicons name="checkmark" size={16} color="white" />
                </ThemedView>
              </Animated.View>
            )}
          </ThemedView>

          {isSelected && <Animated.View style={[styles.selectionLine, { backgroundColor: gradientColors[0] }]} entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} />}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      <Animated.View style={StyleSheet.absoluteFillObject} entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
        <BlurView intensity={80} style={StyleSheet.absoluteFillObject}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={handleClose} activeOpacity={1} />
        </BlurView>
      </Animated.View>

      <Animated.View style={styles.modalContainer} entering={SlideInDown.duration(300).springify().damping(15)} exiting={SlideOutDown.duration(250).springify().damping(20)}>
        <ThemedView style={styles.contentContainer}>
          {/* Header */}
          <ThemedView style={styles.header}>
            <ThemedView style={styles.headerContent}>
              <Ionicons name="grid" size={24} color={Colors.light.icon} />
              <ThemedText style={styles.title}>Select Network</ThemedText>
            </ThemedView>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <ThemedView style={styles.closeButtonContainer}>
                <Ionicons name="close" size={20} color="#374151" />
              </ThemedView>
            </TouchableOpacity>
          </ThemedView>

          <ScrollView ref={scrollViewRef} style={styles.networkList} showsVerticalScrollIndicator={false} contentContainerStyle={styles.networkListContent}>
            {networks.map((availableNetwork) => (
              <AnimatedNetworkCard key={availableNetwork} network={availableNetwork} />
            ))}
          </ScrollView>

          <ThemedView style={styles.footer}>
            <ThemedText style={styles.footerText}>Choose your preferred network to interact with</ThemedText>
          </ThemedView>
        </ThemedView>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  contentContainer: {
    minHeight: '66%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
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
  closeButtonContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  networkList: {
    flex: 1,
  },
  networkListContent: {
    padding: 24,
    gap: 12,
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

export default NetworkSelectorModal;
