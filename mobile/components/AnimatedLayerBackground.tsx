import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { RadialGradient } from '@/components/RadialGradient';
import { getNetworkPrimaryColor } from '@shared/constants/Colors';

/** Same timing as onboarding intro carousel gradient cross-fade */
const GRADIENT_TRANSITION_DELAY = 150;
const GRADIENT_TRANSITION_DURATION = 1000;

/** Same geometry as [`RadialGradientScreen`](./RadialGradientScreen.tsx) */
const RADIAL = {
  x: '50%' as const,
  y: '-20.71%' as const,
  rx: '109.91%' as const,
  ry: '76.76%' as const,
};

function colorListForNetwork(network: string) {
  const primary = getNetworkPrimaryColor(network);
  return [
    { offset: '0%', color: primary, opacity: '1' },
    { offset: '100%', color: '#000000', opacity: '1' },
  ];
}

export function AnimatedLayerBackground({ network }: { network: string }) {
  const [prevNetwork, setPrevNetwork] = useState(network);
  const [currentNetwork, setCurrentNetwork] = useState(network);
  const fadeProgress = useSharedValue(1);

  useEffect(() => {
    if (network === currentNetwork) return;
    const timeout = setTimeout(() => {
      setPrevNetwork(currentNetwork);
      setCurrentNetwork(network);
    }, 0);
    return () => clearTimeout(timeout);
    // Intentionally sync only when `network` prop changes; `currentNetwork` is read as previous value.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [network]);

  useEffect(() => {
    if (prevNetwork === currentNetwork) {
      fadeProgress.value = 1;
      return;
    }
    fadeProgress.value = 0;
    fadeProgress.value = withDelay(
      GRADIENT_TRANSITION_DELAY,
      withTiming(1, {
        duration: GRADIENT_TRANSITION_DURATION,
        easing: Easing.inOut(Easing.quad),
      })
    );
  }, [currentNetwork, prevNetwork, fadeProgress]);

  const prevOpacity = useAnimatedStyle(() => ({
    opacity: 1 - fadeProgress.value,
  }));

  const currentOpacity = useAnimatedStyle(() => ({
    opacity: fadeProgress.value,
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, prevOpacity]}>
        <RadialGradient colorList={colorListForNetwork(prevNetwork)} {...RADIAL} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, currentOpacity]}>
        <RadialGradient colorList={colorListForNetwork(currentNetwork)} {...RADIAL} />
      </Animated.View>
    </View>
  );
}
