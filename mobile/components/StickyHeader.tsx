import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { ThemedText } from './ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountItem, AccountNumberContext, accountItems } from '@shared/hooks/AccountNumberContext';
import { Ionicons, Foundation } from '@expo/vector-icons';
import PlatformBlurView from './PlatformBlurView';
import Animated, { useAnimatedStyle, interpolate, SharedValue } from 'react-native-reanimated';

interface StickyHeaderProps {
  scrollY: SharedValue<number>;
  onSettingsPress: () => void;
  onPocketPress?: () => void;
  onCameraPress?: () => void;
  useAbsolutePosition?: boolean;
  applySafeAreaPadding?: boolean;
}

const StickyHeader: React.FC<StickyHeaderProps> = ({ scrollY, onSettingsPress, onPocketPress, onCameraPress, useAbsolutePosition = true, applySafeAreaPadding = true }) => {
  const insets = useSafeAreaInsets();
  const { accountNumber } = React.useContext(AccountNumberContext);
  const accountItem: AccountItem = accountItems[accountNumber];

  // Animated border opacity based on scroll position
  const borderAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, 50], [0, 1], 'clamp');
    return { opacity };
  });

  // Animated blur opacity - starts at 0, becomes visible when scrolling
  const blurAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, 50], [0, 1], 'clamp');
    return { opacity };
  });

  const IconComponent = accountItem.iconCollection === 'ion' ? Ionicons : Foundation;

  const topPadding = applySafeAreaPadding ? insets.top : 0;

  return (
    <View style={[styles.container, useAbsolutePosition ? styles.absoluteContainer : null, { paddingTop: topPadding }]}>
      {/* Platform-aware Blur Background */}
      <Animated.View style={[styles.blurBackground, blurAnimatedStyle]}>
        <PlatformBlurView intensity={50} tint="dark" style={styles.blurView} />
      </Animated.View>

      {/* Animated Border */}
      <Animated.View style={[styles.border, borderAnimatedStyle]} />

      {/* Header Content */}
      <View style={styles.header}>
        {/* Left Side: Pocket */}
        <TouchableOpacity style={styles.pocket} onPress={onPocketPress}>
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
          <TouchableOpacity style={styles.iconButton} onPress={onCameraPress} testID="CameraButton">
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
    width: '100%',
  },
  absoluteContainer: {
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
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
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
