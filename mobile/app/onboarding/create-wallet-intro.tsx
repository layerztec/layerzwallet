import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Animated, Easing } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { Colors, gradients } from '@shared/constants/Colors';
import { Typography } from '@shared/constants/Typography';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CreateWalletIntroScreen() {
  const router = useRouter();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [hasNavigatedAway, setHasNavigatedAway] = useState(false);

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(30)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(30)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const buttonsTranslateY = useRef(new Animated.Value(40)).current;

  // Custom transition animations
  const buttonScale = useRef(new Animated.Value(1)).current;
  const contentFadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Only run initial animation if we haven't navigated away
    if (!hasNavigatedAway) {
      const animationSequence = Animated.sequence([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),

        Animated.parallel([
          Animated.timing(titleOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(titleTranslateY, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),

        Animated.parallel([
          Animated.timing(subtitleOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(subtitleTranslateY, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),

        Animated.parallel([
          Animated.timing(buttonsOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(buttonsTranslateY, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      ]);

      animationSequence.start();
    }
  }, [hasNavigatedAway, logoOpacity, titleOpacity, titleTranslateY, subtitleOpacity, subtitleTranslateY, buttonsOpacity, buttonsTranslateY]);

  // Handle screen focus - fade content back in when returning
  useFocusEffect(
    React.useCallback(() => {
      if (hasNavigatedAway) {
        // Fade content back in when returning from another screen
        Animated.timing(contentFadeOut, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
        setIsTransitioning(false);
      }
    }, [hasNavigatedAway, contentFadeOut])
  );

  const handleCreateWallet = async () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setHasNavigatedAway(true);

    // Professional button press animation
    Animated.sequence([
      // Quick scale down
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      // Scale back up
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    // Content cross-fade transition animation
    setTimeout(() => {
      // Fade out only the content below the image
      Animated.timing(contentFadeOut, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        router.push('/onboarding/create-wallet-backup-settings');
      });
    }, 200);
  };

  return (
    <LinearGradient colors={gradients.blueGradient} style={styles.container}>
      <SafeAreaView style={styles.safeAreaView}>
        {/* Fixed positioned image */}
        <View style={styles.fixedImageContainer}>
          <Animated.View style={[{ opacity: logoOpacity }]}>
            <Image source={require('@/assets/images/ui/newWallet.png')} style={styles.image} />
          </Animated.View>
        </View>

        {/* Scrollable content area */}
        <Animated.View style={[styles.content, { opacity: contentFadeOut }]}>
          <Animated.View
            style={[
              {
                opacity: titleOpacity,
                transform: [{ translateY: titleTranslateY }],
              },
            ]}
          >
            <ThemedText type="title" darkColor={Colors.dark.buttonText} textAlign="center">
              Generating your new recovery phrase
            </ThemedText>
          </Animated.View>

          <View style={{ marginVertical: 10 }} />

          <Animated.View
            style={[
              {
                opacity: subtitleOpacity,
                transform: [{ translateY: subtitleTranslateY }],
              },
            ]}
          >
            <ThemedText type="paragraph" darkColor={Colors.dark.text} textAlign="center">
              A recovery phrase is a series of 12 words in a specific order. This word combination is unique to your wallet. Make sure to have pen and paper ready so you can write it down.
            </ThemedText>
          </Animated.View>
        </Animated.View>

        <Animated.View style={[styles.buttonSection, { opacity: 1 }]}>
          <Animated.View
            style={[
              styles.buttonContainer,
              {
                opacity: buttonsOpacity,
                transform: [{ translateY: buttonsTranslateY }],
              },
            ]}
          >
            <Animated.View style={[{ transform: [{ scale: buttonScale }] }]}>
              <TouchableOpacity style={styles.button} onPress={handleCreateWallet} testID="ContinueButton">
                <View style={styles.view}>
                  <Image source={require('@/assets/images/ui/arrow-right.png')} style={styles.image} />
                  <ThemedText style={styles.buttonText} darkColor={Colors.dark.buttonText}>
                    Continue
                  </ThemedText>
                </View>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  safeAreaView: {
    flex: 1,
  },
  fixedImageContainer: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1,
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  image: {
    alignSelf: 'center',
    marginRight: 8,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 180, // Make room for fixed image
  },
  buttonSection: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  buttonContainer: {
    // No horizontal margin needed since buttonSection handles positioning
  },
  button: {
    backgroundColor: Colors.dark.buttonPrimary,
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignContent: 'center',
    marginBottom: 8,
  },
  button2: {
    alignItems: 'center',
    backgroundColor: Colors.dark.buttonSecondary,
    borderColor: Colors.dark.buttonBorder,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 22,
  },
  view: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    color: Colors.dark.buttonText,
  },
});
