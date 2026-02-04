import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@shared/constants/Colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import Rive from 'rive-react-native';
import Pressable from '../../components/Pressable';
import Carousel, { ICarouselInstance } from 'react-native-reanimated-carousel';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing } from 'react-native-reanimated';
import { RadialGradient } from 'react-native-gradients';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const GRADIENT_TRANSITION_DELAY = 150; // ms delay after slide changes
const GRADIENT_TRANSITION_DURATION = 1000; // ms for smooth gradient fade

const SLIDES = [
  {
    id: 1,
    title: 'Self-custody',
    text: "Keys never leave your device and your assets can't be frozen.",
    animation: 'selfcustody',
    primaryColor: '#FF1414',
    duration: 7000,
  },
  {
    id: 2,
    title: 'Lightning',
    text: 'Instant, cheap and privacy preserving payments on Bitcoin.',
    animation: 'lightning',
    primaryColor: '#D10DF9',
    duration: 7000,
  },
  {
    id: 3,
    title: 'USD layer',
    text: 'Access the Dollar with USDT and other stable coins. Move money globally, avoid volatility.',
    animation: 'bars',
    primaryColor: '#03F2CA',
    duration: 7000,
  },
  {
    id: 4,
    title: 'Swaps',
    text: 'Swap, transfer or convert between bitcoin layers, assets and tokens.',
    animation: 'swaps',
    primaryColor: '#F9A92A',
    duration: 7000,
    fullWidth: true,
  },
  {
    id: 5,
    title: 'Confidential Transactions',
    text: 'On Liquid Layer, assets and balances are hidden.',
    animation: 'liquid',
    primaryColor: '#00BEFD',
    duration: 7000,
  },
  {
    id: 6,
    title: 'Tokens & NFTs',
    text: 'Access assets like tokens and NFTs.',
    animation: 'nfts',
    primaryColor: '#6A00FF',
    duration: 7000,
  },
  {
    id: 7,
    title: 'Open Source',
    text: 'Free and open, code available to everyone.',
    animation: 'oss',
    primaryColor: '#AAAAAA',
    duration: 7000,
  },
];

interface AnimatedGradientBackgroundProps {
  prevIndex: number;
  currentIndex: number;
}

const AnimatedGradientBackground: React.FC<AnimatedGradientBackgroundProps> = ({ prevIndex, currentIndex }) => {
  const fadeProgress = useSharedValue(0);

  // Trigger animation when currentIndex changes
  useEffect(() => {
    fadeProgress.value = 0;
    fadeProgress.value = withDelay(
      GRADIENT_TRANSITION_DELAY,
      withTiming(1, {
        duration: GRADIENT_TRANSITION_DURATION,
        easing: Easing.inOut(Easing.quad),
      })
    );
  }, [currentIndex, fadeProgress]);

  // Previous gradient fades out smoothly
  const prevOpacity = useAnimatedStyle(() => ({
    opacity: 1 - fadeProgress.value,
  }));

  // Current gradient fades in smoothly
  const currentOpacity = useAnimatedStyle(() => ({
    opacity: fadeProgress.value,
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Previous gradient (fading out) */}
      <Animated.View style={[StyleSheet.absoluteFill, prevOpacity]}>
        <RadialGradient
          colorList={[
            { offset: '0%', color: SLIDES[prevIndex].primaryColor, opacity: '0.8' },
            { offset: '100%', color: '#000000', opacity: '1' },
          ]}
          x="50%"
          y="-40%"
          rx="70%"
          ry="95%"
        />
      </Animated.View>
      {/* Current gradient (fading in) */}
      <Animated.View style={[StyleSheet.absoluteFill, currentOpacity]}>
        <RadialGradient
          colorList={[
            { offset: '0%', color: SLIDES[currentIndex].primaryColor, opacity: '0.8' },
            { offset: '100%', color: '#000000', opacity: '1' },
          ]}
          x="50%"
          y="-40%"
          rx="70%"
          ry="95%"
        />
      </Animated.View>
    </View>
  );
};

interface SlideItemProps {
  item: (typeof SLIDES)[0];
}

const SlideItem: React.FC<SlideItemProps> = ({ item }) => {
  const isFullWidth = 'fullWidth' in item && item.fullWidth;

  return (
    <View style={styles.slideContent}>
      <View style={[styles.animationContainer, isFullWidth && styles.animationContainerFullWidth]}>
        <Rive autoplay={true} style={styles.riveAnimation} resourceName={item.animation} />
      </View>
      <View style={styles.textContainer}>
        <ThemedText style={styles.slideTitle} darkColor="#FFFFFF">
          {item.title}
        </ThemedText>
        <ThemedText style={styles.slideText} darkColor="rgba(255, 255, 255, 0.7)">
          {item.text}
        </ThemedText>
      </View>
    </View>
  );
};

export default function IntroScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState(0);
  const carouselRef = useRef<ICarouselInstance>(null);
  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCreateWallet = () => {
    router.push('/onboarding/create-wallet-intro');
  };

  const handleImportWallet = () => {
    router.push('/onboarding/import-wallet');
  };

  // Auto-advance timer
  const startAutoPlayTimer = useCallback(() => {
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current);
    }
    autoPlayTimerRef.current = setTimeout(() => {
      if (carouselRef.current) {
        // Use next() to properly handle looping - scrolls forward by 1 slide
        carouselRef.current.next();
      }
    }, SLIDES[currentIndex].duration);
  }, [currentIndex]);

  useEffect(() => {
    startAutoPlayTimer();
    return () => {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
      }
    };
  }, [startAutoPlayTimer]);

  const handleSnapToItem = useCallback(
    (index: number) => {
      if (index !== currentIndex) {
        // Store previous index for gradient transition
        setPrevIndex(currentIndex);
        setCurrentIndex(index);
      }
    },
    [currentIndex]
  );

  const renderItem = useCallback(({ item }: { item: (typeof SLIDES)[0] }) => {
    return <SlideItem item={item} />;
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Animated Radial Gradient Background */}
      <AnimatedGradientBackground prevIndex={prevIndex} currentIndex={currentIndex} />

      <SafeAreaView style={styles.safeAreaView}>
        {/* Progress Bars at TOP */}
        <View style={styles.progressContainer}>
          {SLIDES.map((slide, index) => (
            <View key={slide.id} style={styles.progressBar}>
              <View
                style={[
                  styles.progressBarFilled,
                  {
                    width: index <= currentIndex ? '100%' : '0%',
                    opacity: index <= currentIndex ? 1 : 0.3,
                  },
                ]}
              />
            </View>
          ))}
        </View>

        {/* Carousel Content CENTERED */}
        <View style={styles.carouselContainer}>
          <Carousel ref={carouselRef} data={SLIDES} width={SCREEN_WIDTH} height={450} loop={true} onSnapToItem={handleSnapToItem} renderItem={renderItem} />
        </View>

        {/* Buttons at BOTTOM */}
        <View style={styles.buttonSection}>
          <Pressable style={styles.buttonPrimary} onPress={handleCreateWallet}>
            <ThemedText type="defaultSemiBold" darkColor={Colors.dark.buttonText}>
              Create Wallet
            </ThemedText>
          </Pressable>

          <Pressable style={styles.buttonSecondary} onPress={handleImportWallet}>
            <ThemedText type="defaultSemiBold" darkColor={Colors.dark.buttonText}>
              Import Wallet
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safeAreaView: {
    flex: 1,
    justifyContent: 'space-between',
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  progressBar: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressBarFilled: {
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 1.5,
  },
  carouselContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  slideContent: {
    flex: 1,
    width: SCREEN_WIDTH,
    paddingHorizontal: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  animationContainer: {
    width: 300,
    height: 280,
    alignSelf: 'center',
  },
  animationContainerFullWidth: {
    width: '100%',
  },
  textContainer: {
    paddingHorizontal: 24,
    marginTop: 24,
  },
  slideTitle: {
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 30,
    fontWeight: '600',
    lineHeight: 42,
  },
  slideText: {
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 16,
    fontWeight: '400',
  },
  buttonSection: {
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  buttonPrimary: {
    backgroundColor: Colors.dark.buttonPrimary,
    borderColor: Colors.dark.buttonBorder,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: 56,
  },
  buttonSecondary: {
    backgroundColor: Colors.dark.buttonSecondary,
    borderColor: Colors.dark.buttonBorder,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: 56,
  },
  riveAnimation: {
    width: '100%',
    height: '100%',
  },
});
