import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Animated, ImageBackground, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { Colors, gradients } from '@shared/constants/Colors';
const useFadeIn = (delay: number = 0, duration: number = 450) => {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [delay, duration, opacity]);
  return { opacity } as const;
};

export default function WelcomeScreen() {
  const router = useRouter();

  const heroFade = useFadeIn(0, 550);
  const titleFade = useFadeIn(0, 500);
  const paragraphFade = useFadeIn(0, 500);
  const dotsFade = useFadeIn(0, 500);
  const buttonFade = useFadeIn(0, 550);

  const handleGetStarted = () => {
    router.push('/onboarding/intro');
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={gradients.welcomeScreenBackground} style={styles.root}>
        <SafeAreaView style={styles.safeAreaView}>
          <View style={styles.container}>
            <Animated.View style={[heroFade]}>
              <ImageBackground source={require('@/assets/images/ui/welcome.png')} style={styles.image} resizeMode="cover">
                <Animated.View style={[styles.titleOverlay, titleFade]}>
                  <ThemedText type="headline" darkColor={Colors.dark.buttonText} style={styles.title}>
                    {`Welcome to \nLayerz`}
                  </ThemedText>
                </Animated.View>
              </ImageBackground>
            </Animated.View>
          </View>

          <Animated.View style={[styles.paragraphContainer, paragraphFade]}>
            <ThemedText type="paragraph" darkColor={Colors.dark.paragraphText}>
              Layerz starts with your Base Wallet — this is your core Bitcoin account. It’s where your Bitcoin is stored, secured by your keys. Every other layer connects to this foundation.
            </ThemedText>
          </Animated.View>

          <Animated.View style={[styles.dotsContainer, dotsFade]}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={[styles.dot, i === 0 ? styles.dotActive : null]} />
            ))}
          </Animated.View>

          <Animated.View style={[styles.buttonSection, buttonFade]}>
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
  container: {
    paddingBottom: 12,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 520,
  },
  paragraphContainer: {
    paddingTop: 8,
    paddingHorizontal: 30,
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
    paddingHorizontal: 30,
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
    width: '80%',
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
