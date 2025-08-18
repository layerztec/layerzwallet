import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { Colors, gradients } from '@shared/constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHorizontalSpringTransition, useSequentialSpringAnimation } from '@/hooks/useCustomTransitions';

export default function ManualBackupIntroScreen() {
  const router = useRouter();

  const imageTransition = useHorizontalSpringTransition(true, 'forward');
  const titleTransition = useSequentialSpringAnimation(200);
  const subtitleTransition = useSequentialSpringAnimation(400);
  const buttonTransition = useSequentialSpringAnimation(600);

  const handleContinue = async () => {
    router.dismissAll();
    router.replace('/onboarding/create-wallet');
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradients.blueGradient} style={styles.container}>
        <SafeAreaView style={styles.safeAreaView}>
          <View style={styles.logoContainer}>
            <Animated.View style={[imageTransition]}>
              <Image source={require('@/assets/images/ui/newWallet.png')} style={styles.image} />
            </Animated.View>
          </View>

          <View style={styles.content}>
            <Animated.View style={[titleTransition]}>
              <ThemedText type="title" darkColor={Colors.dark.buttonText} textAlign="center">
                First, let's create your recovery phrase
              </ThemedText>
            </Animated.View>

            <View style={{ marginVertical: 10 }} />

            <Animated.View style={[subtitleTransition]}>
              <ThemedText type="paragraph" darkColor={Colors.dark.text} textAlign="center">
                A recovery phrase is a series of 12 words in a specific order. This word combination is unique to your wallet. Make sure to have pen and paper ready so you can write it down.
              </ThemedText>
            </Animated.View>
          </View>

          <View style={styles.buttonSection}>
            <Animated.View style={[styles.buttonContainer, buttonTransition]}>
              <TouchableOpacity style={styles.button} onPress={handleContinue} testID="ManualBackupContinueButton">
                <View style={styles.view}>
                  <ThemedText type="button" darkColor={Colors.dark.buttonText}>
                    Continue
                  </ThemedText>
                </View>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeAreaView: {
    flex: 1,
    paddingHorizontal: 20,
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
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  buttonSection: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  buttonContainer: {
    marginHorizontal: 20,
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
});
