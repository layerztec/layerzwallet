import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Animated, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { Colors, gradients } from '@shared/constants/Colors';
import { useHorizontalSpringTransition, useSequentialSpringAnimation } from '@/hooks/useCustomTransitions';

// First screen shown before the existing Intro screen.
// Mimics the provided design screenshot while reusing existing onboarding patterns.
export default function WelcomeScreen() {
  const router = useRouter();

  const imageTransition = useHorizontalSpringTransition(true, 'forward');
  const titleTransition = useSequentialSpringAnimation(200);
  const paragraphTransition = useSequentialSpringAnimation(400);
  const dotsTransition = useSequentialSpringAnimation(500);
  const buttonTransition = useSequentialSpringAnimation(650);

  const handleGetStarted = () => {
    router.push('/onboarding/intro');
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={gradients.welcomeScreenBackground} style={styles.root}>
        <SafeAreaView style={styles.safeAreaView}>
          <View style={styles.heroContainer}>
            <Animated.View style={[imageTransition]}>
              <ImageBackground source={require('@/assets/images/ui/welcome.png')} style={styles.heroImage} resizeMode="cover">
                {/* Title overlay at bottom of image */}
                <Animated.View style={[styles.titleOverlay, titleTransition]}>
                  <ThemedText type="headline" darkColor={Colors.dark.buttonText} style={styles.title}>
                    {`Welcome to \nLayerz`}
                  </ThemedText>
                </Animated.View>
              </ImageBackground>
            </Animated.View>
          </View>

          {/* Copy (paragraph only now) */}
          <Animated.View style={[styles.paragraphContainer, paragraphTransition]}>
            <ThemedText type="paragraph" darkColor={Colors.dark.paragraphText}>
              Layerz starts with your Base Wallet — this is your core Bitcoin account. It’s where your Bitcoin is stored, secured by your keys. Every other layer connects to this foundation.
            </ThemedText>
          </Animated.View>

          {/* Pagination dots (static for now) */}
          <Animated.View style={[styles.dotsContainer, dotsTransition]}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={[styles.dot, i === 0 ? styles.dotActive : null]} />
            ))}
          </Animated.View>

          {/* Button */}
          <Animated.View style={[styles.buttonSection, buttonTransition]}>
            <TouchableOpacity style={styles.button} onPress={handleGetStarted} activeOpacity={0.85} testID="GetStartedButton">
              <LinearGradient colors={['#85F8E8', '#FC602C']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.buttonGradient}>
                <View style={styles.buttonInner}>
                  <View style={styles.iconBorder}>
                    <Image source={require('@/assets/images/ui/arrow-right.png')} style={styles.arrowIcon} />
                  </View>
                  <ThemedText style={styles.buttonText} darkColor={Colors.dark.buttonText}>
                    Get Started
                  </ThemedText>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const DOT_SIZE = 10;

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeAreaView: {
    flex: 1,
  },
  heroContainer: {
    paddingBottom: 12,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: 520,
  },
  paragraphContainer: {
    paddingTop: 8,
    paddingHorizontal: 20,
  },
  titleOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    paddingHorizontal: 20,
  },
  title: {
    lineHeight: 40,
  },
  spacer: { height: 16 },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
  },
  buttonSection: {
    paddingBottom: 30,
    marginTop: 'auto',
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 370,
  },
  buttonGradient: {
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    width: '100%',
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  iconBorder: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowIcon: {
    tintColor: 'black',
    resizeMode: 'contain',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'black',
  },
});
