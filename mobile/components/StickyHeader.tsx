import React from 'react';
import { StyleSheet, View, TouchableOpacity, Animated } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { ThemedText } from './ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountNumberContext, accountItems } from '@shared/hooks/AccountNumberContext';
import { formatBalance } from '@shared/modules/string-utils';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { NETWORK_BITCOIN } from '@shared/types/networks';

const logo = require('@/assets/images/ui/logo-main-screen.svg');

interface StickyHeaderProps {
  scrollY: Animated.Value;
  onSettingsPress: () => void;
  accountBalance?: number;
}

const StickyHeader: React.FC<StickyHeaderProps> = ({ scrollY, onSettingsPress, accountBalance }) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { accountNumber } = React.useContext(AccountNumberContext);
  const accountItem = accountItems[accountNumber];

  // Animated border opacity based on scroll position
  const borderOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Animated blur intensity based on scroll position
  const blurIntensity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, 50],
    extrapolate: 'clamp',
  });

  // Animated blur opacity - starts at 0, becomes visible when scrolling
  const blurOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const handlePocketPress = () => {
    router.push('/PocketSwitch');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Blur Background */}
      <Animated.View style={[styles.blurBackground, { opacity: blurOpacity }]}>
        <BlurView intensity={50} tint="dark" style={styles.blurView} />
      </Animated.View>

      {/* Animated Border */}
      <Animated.View
        style={[
          styles.border,
          {
            opacity: borderOpacity,
            borderBottomColor: 'rgba(255, 255, 255, 0.1)',
          },
        ]}
      />

      {/* Header Content */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.logoContainer} onPress={onSettingsPress} testID="SettingsButton" activeOpacity={0.8}>
          <Image source={logo} style={styles.logo} contentFit="contain" />
        </TouchableOpacity>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.pocket} onPress={handlePocketPress}>
            <ThemedText style={styles.pocketLabel}>{accountItem.name} pocket</ThemedText>
            <ThemedText style={styles.pocketAmount}>
              {accountBalance ? formatBalance(accountBalance.toString(), Number(getDecimalsByNetwork(NETWORK_BITCOIN)), 8) : '0'} {getTickerByNetwork(NETWORK_BITCOIN)}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  blurBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  blurView: {
    flex: 1,
  },
  border: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    borderBottomWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    minHeight: 56,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -5,
  },
  logo: {
    width: 130,
    height: 50,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pocket: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  pocketLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: -6,
  },
  pocketAmount: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
});

export default StickyHeader;
