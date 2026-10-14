import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import Pressable from '@/components/Pressable';
import { ThemedText } from '@/components/ThemedText';

export interface ReceiveCtaProps {
  onDismiss: () => void;
}

// Bitcoin orange — keep in sync with the Receive-button glow in HomeActionButton.
const ACCENT = '#F7931A';
const FADE_OUT_DURATION = 260;

// One-time CTA nudging brand-new (created, not imported) wallets to receive their first bitcoin.
const ReceiveCta: React.FC<ReceiveCtaProps> = ({ onDismiss }) => {
  const opacity = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  // Fade out first, then notify the parent to remove it and persist the dismissed flag.
  const handleDismiss = () => {
    // eslint-disable-next-line react-hooks/immutability
    opacity.value = withTiming(0, { duration: FADE_OUT_DURATION }, (finished) => {
      if (finished) {
        scheduleOnRN(onDismiss);
      }
    });
  };

  return (
    <Animated.View style={[styles.wrapper, animatedStyle]} testID="ReceiveCta">
      <View style={styles.row}>
        <Ionicons name="arrow-up" size={15} color={ACCENT} style={styles.arrow} />
        <ThemedText style={styles.text}>Start by receiving bitcoin</ThemedText>
      </View>
      <Pressable onPress={handleDismiss} hitSlop={10} style={styles.closeButton} testID="ReceiveCtaClose">
        <Ionicons name="close" size={16} color="rgba(255, 255, 255, 0.7)" />
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  arrow: {
    marginTop: 1,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ReceiveCta;
