import React, { useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from './ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountItem, AccountNumberContext, accountItems } from '@shared/hooks/AccountNumberContext';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { handleQrIntent } from '@/src/modules/scan-routing';
import { Ionicons, Foundation, MaterialCommunityIcons } from '@expo/vector-icons';
import PlatformBlurView from './PlatformBlurView';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, interpolate, SharedValue } from 'react-native-reanimated';
import Pressable from './Pressable';

interface StickyHeaderProps {
  scrollY: SharedValue<number>;
  onSettingsPress: () => void;
}

const StickyHeader: React.FC<StickyHeaderProps> = ({ scrollY, onSettingsPress }) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { accountNumber } = React.useContext(AccountNumberContext);
  const accountItem: AccountItem = accountItems[accountNumber];
  const { scanQr } = useContext(ScanQrContext);

  // Animated border opacity based on scroll position
  const borderAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, 50], [0, 1], 'clamp');
    return { opacity };
  });

  // Blur starts at 0 (invisible); only turns on as scroll passes ~0–50px.
  const blurAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, 50], [0, 1], 'clamp');
    return { opacity };
  });

  const handlePocketPress = () => {
    router.push('/PocketSwitch');
  };

  const handleCameraPress = async () => {
    try {
      const result = await scanQr();
      if (!result) {
        return;
      }

      await handleQrIntent(result, router);
    } catch (error) {
      console.error('StickyHeader: QR scan failed', error);
    }
  };

  const IconComponent = accountItem.iconCollection === 'ion' ? Ionicons : accountItem.iconCollection === 'material-community' ? MaterialCommunityIcons : Foundation;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Blur first (under tint) so Android blur samples read; gradient on top tint only — pointerEvents none so touches reach header */}
      <Animated.View style={[styles.blurBackground, blurAnimatedStyle, { top: -insets.top, paddingTop: insets.top }]}>
        <PlatformBlurView intensity={55} tint="dark" style={styles.blurView} />
      </Animated.View>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0, 0, 0, 0.80)', 'rgba(0, 0, 0, 0.00)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.8832 }}
        style={[styles.gradientBackground, { top: -insets.top }]}
      />

      {/* Animated Border */}
      <Animated.View style={[styles.border, borderAnimatedStyle]} />

      {/* Header Content */}
      <View style={styles.header}>
        {/* Left Side: Pocket */}
        <Pressable style={styles.pocket} onPress={handlePocketPress}>
          <View style={styles.pocketIconContainer}>
            <IconComponent name={accountItem.icon as any} size={22} color="white" style={accountItem.iconCollection === 'material-community' ? styles.materialIconNudge : undefined} />
          </View>
          <ThemedText style={styles.pocketLabel} numberOfLines={1}>
            {accountItem.name.length > 10 ? accountItem.name.substring(0, 10) + '...' : accountItem.name}
          </ThemedText>
          <Ionicons name="chevron-down" size={16} color="rgba(255, 255, 255, 0.8)" />
        </Pressable>

        {/* Right Side: Camera and Settings Icons */}
        <View style={styles.headerRight}>
          <Pressable style={styles.iconButton} onPress={handleCameraPress} testID="CameraButton">
            <Ionicons name="scan-outline" size={24} color="rgba(255, 255, 255, 0.8)" />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={onSettingsPress} testID="SettingsButton">
            <Ionicons name="settings-outline" size={24} color="rgba(255, 255, 255, 0.8)" />
          </Pressable>
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
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  blurBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  blurView: {
    width: '100%',
    height: '100%',
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
  materialIconNudge: {
    marginTop: -3,
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
