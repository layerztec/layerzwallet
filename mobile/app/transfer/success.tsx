import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { Pressable as RNPressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { makeMutable, runOnJS, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/ThemedText';

const DISMISS_THRESHOLD = 150;

function setSharedValue<T>(sharedValue: { value: T }, nextValue: T) {
  'worklet';
  sharedValue.value = nextValue;
}

export default function TransferSuccess() {
  const router = useRouter();
  const { height: screenHeight } = useWindowDimensions();

  const translateY = makeMutable(screenHeight);

  useEffect(() => {
    setSharedValue(translateY, withSpring(0, { damping: 18, stiffness: 220, mass: 0.6 }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDismiss = useCallback(() => {
    router.back();
  }, [router]);

  const animateDismiss = useCallback(() => {
    setSharedValue(
      translateY,
      withTiming(screenHeight, { duration: 250 }, () => {
        runOnJS(handleDismiss)();
      })
    );
  }, [translateY, screenHeight, handleDismiss]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        setSharedValue(translateY, event.translationY);
      }
    })
    .onEnd((event) => {
      if (event.translationY > DISMISS_THRESHOLD || event.velocityY > 1000) {
        runOnJS(animateDismiss)();
      } else {
        setSharedValue(translateY, withTiming(0, { duration: 200 }));
      }
    });

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - translateY.value / (screenHeight * 0.75),
  }));

  return (
    <GestureHandlerRootView style={styles.gestureRoot} testID="TransferSuccessScreen">
      <Animated.View style={[styles.overlay, overlayAnimatedStyle]}>
        <RNPressable style={styles.overlayTouchable} onPress={handleDismiss} />
      </Animated.View>
      <View style={styles.cardWrapper} pointerEvents="box-none">
        <View style={styles.cardSpacer} pointerEvents="none" />
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.card, cardAnimatedStyle]}>
            <View style={styles.grabber} />
            <View style={styles.content}>
              <View style={styles.iconContainer}>
                <Ionicons name="checkmark" size={56} color="rgba(0, 0, 0, 0.7)" />
              </View>
              <ThemedText style={styles.successText} testID="TransferSuccessText">
                Transfer successful
              </ThemedText>
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  overlayTouchable: {
    flex: 1,
  },
  cardWrapper: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 24,
  },
  cardSpacer: {
    flex: 1,
  },
  card: {
    width: 370,
    height: 317,
    borderRadius: 40,
    backgroundColor: 'rgba(50, 50, 50, 0.95)',
    alignItems: 'center',
    overflow: 'hidden',
  },
  grabber: {
    width: 46,
    height: 5,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginTop: 16,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successText: {
    fontSize: 24,
    fontWeight: '600',
    fontFamily: 'Inter',
    color: 'rgba(255, 255, 255, 1)',
    marginTop: 24,
    textAlign: 'center',
    letterSpacing: -0.48,
  },
});
