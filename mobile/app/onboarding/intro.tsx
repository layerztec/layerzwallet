import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@shared/constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Rive, { RiveRef } from 'rive-react-native';
import Pressable from '@/components/Pressable';

const SLIDES = [
  {
    id: 1,
    title: 'Welcome to Layerz',
    text: 'Meet Layerz!! The next-gen Bitcoin wallet built to unlock the full potential of your coins. Experience Bitcoin not just as sound money, but as a foundation for the future of finance.',
    duration: 7000,
  },
  {
    id: 2,
    title: 'Explore Bitcoin Layer 2',
    text: "Dive into Lightning, Spark, Ark, Citrea, Liquid, Botanix, and more. Layerz makes it easy to harness the power of Bitcoin's evolving second layers.",
    duration: 7000,
  },
  {
    id: 3,
    title: 'Self-Custodial & Secure',
    text: 'Your keys, your control. With Layerz, your funds never leave your device. Trade, explore, and transact with confidence. Anytime, anywhere.',
    duration: 7000,
  },
];

export default function IntroScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const riveRef = useRef<RiveRef>(null);
  const prevIndexRef = useRef(0);
  const [riveError, setRiveError] = useState<string | null>(null);

  // Fire Rive trigger when slide changes
  useEffect(() => {
    const prevIndex = prevIndexRef.current;

    if (riveRef.current && prevIndex !== currentIndex) {
      if (prevIndex === 0 && currentIndex === 1) {
        riveRef.current.fireState('State Machine 1', 'trigger 1to2');
      } else if (prevIndex === 1 && currentIndex === 2) {
        riveRef.current.fireState('State Machine 1', 'trigger 2to3');
      } else if (prevIndex === 2 && currentIndex === 0) {
        riveRef.current.fireState('State Machine 1', 'trigger 3to1');
      }
    }

    prevIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    // Start progress animation
    const currentSlide = SLIDES[currentIndex];
    progressAnim.setValue(0);

    const animation = Animated.timing(progressAnim, {
      toValue: 1,
      duration: currentSlide.duration,
      useNativeDriver: false,
    });

    animation.start();

    // Auto-advance to next slide
    const timer = setTimeout(() => {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        // Change slide
        setCurrentIndex((prev) => (prev + 1) % SLIDES.length);
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, currentSlide.duration);

    return () => {
      animation.stop();
      clearTimeout(timer);
    };
  }, [currentIndex, progressAnim, fadeAnim]);

  const handleCreateWallet = () => {
    router.push('/onboarding/create-wallet-intro');
  };

  const handleImportWallet = () => {
    router.push('/onboarding/import-wallet');
  };

  return (
    <View style={[styles.container, { backgroundColor: Colors.GlobalDarkBackground }]}>
      <SafeAreaView style={styles.safeAreaView}>
        <View style={styles.contentContainer}>
          {/* Rive Animation */}
          <View style={styles.animationPlaceholder}>
            <Rive
              ref={riveRef}
              autoplay={true}
              style={styles.riveAnimation}
              resourceName="intro"
              onError={(error) => {
                setRiveError(error.message || 'Unknown error');
              }}
            />
          </View>
          {/* Animated Text Content */}
          <Animated.View style={[styles.textContainer, { opacity: fadeAnim }]}>
            {/* Title */}
            <ThemedText style={styles.slideTitle} darkColor="#FFFFFF">
              {SLIDES[currentIndex].title}
            </ThemedText>

            {/* Text */}
            <ThemedText style={styles.slideText} darkColor="rgba(255, 255, 255, 0.7)">
              {SLIDES[currentIndex].text}
            </ThemedText>
          </Animated.View>

          {/* Progress Bars */}
          <View style={styles.progressContainer}>
            {SLIDES.map((slide, index) => (
              <View key={slide.id} style={styles.progressBar}>
                <Animated.View
                  style={[
                    styles.progressBarFilled,
                    {
                      width:
                        index === currentIndex
                          ? progressAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0%', '100%'],
                            })
                          : index < currentIndex
                            ? '100%'
                            : '0%',
                    },
                  ]}
                />
              </View>
            ))}
          </View>

          {/* Buttons */}
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
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeAreaView: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  animationPlaceholder: {
    width: 380,
    height: 350,
    alignSelf: 'center',
    backgroundColor: 'transparent',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  slideTitle: {
    textAlign: 'left',
    marginBottom: 16,
    fontSize: 42,
    fontWeight: '500',
    lineHeight: 48,
  },
  slideText: {
    textAlign: 'left',
    marginBottom: 8,
    lineHeight: 24,
    fontSize: 16,
    fontWeight: '400',
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 48,
    maxWidth: 160,
    alignSelf: 'center',
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFilled: {
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  buttonSection: {
    gap: 12,
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
