import React, { useContext } from 'react';
import { StyleSheet, View, TouchableOpacity, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from './ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountItem, AccountNumberContext, accountItems } from '@shared/hooks/AccountNumberContext';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { Ionicons, Foundation } from '@expo/vector-icons';
import PlatformBlurView from './PlatformBlurView';

interface StickyHeaderProps {
  scrollY: Animated.Value;
  onSettingsPress: () => void;
}

const StickyHeader: React.FC<StickyHeaderProps> = ({ scrollY, onSettingsPress }) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { accountNumber } = React.useContext(AccountNumberContext);
  const accountItem: AccountItem = accountItems[accountNumber];
  const { scanQr } = useContext(ScanQrContext);

  // Animated border opacity based on scroll position
  const borderOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, 1],
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

  const handleCameraPress = async () => {
    await scanQr();
  };

  const IconComponent = accountItem.iconCollection === 'ion' ? Ionicons : Foundation;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Platform-aware Blur Background */}
      <Animated.View style={[styles.blurBackground, { opacity: blurOpacity }]}>
        <PlatformBlurView intensity={50} tint="dark" style={styles.blurView} />
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
        {/* Left Side: Pocket */}
        <TouchableOpacity style={styles.pocket} onPress={handlePocketPress}>
          <View style={styles.pocketIconContainer}>
            <IconComponent name={accountItem.icon as any} size={22} color="white" />
          </View>
          <ThemedText style={styles.pocketLabel} numberOfLines={1}>
            {accountItem.name.length > 10 ? accountItem.name.substring(0, 10) + '...' : accountItem.name}
          </ThemedText>
          <Ionicons name="chevron-down" size={16} color="rgba(255, 255, 255, 0.8)" />
        </TouchableOpacity>

        {/* Right Side: Camera and Settings Icons */}
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconButton} onPress={handleCameraPress} testID="CameraButton">
            <Ionicons name="scan-outline" size={24} color="rgba(255, 255, 255, 0.8)" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={onSettingsPress} testID="SettingsButton">
            <Ionicons name="settings-outline" size={24} color="rgba(255, 255, 255, 0.8)" />
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 56,
  },
  pocket: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  pocketIconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pocketLabel: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: 'SF Pro Text',
    fontWeight: '500',
    letterSpacing: -0.264,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default StickyHeader;
