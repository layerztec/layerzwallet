import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { Colors, gradients } from '@shared/constants/Colors';
import { Typography } from '@shared/constants/Typography';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function IntroScreen() {
  const router = useRouter();

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(30)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(30)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const buttonsTranslateY = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    const animationSequence = Animated.sequence([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),

      Animated.delay(300),

      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(titleTranslateY, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),

      Animated.delay(200),

      Animated.parallel([
        Animated.timing(subtitleOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(subtitleTranslateY, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),

      Animated.delay(400),

      Animated.parallel([
        Animated.timing(buttonsOpacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(buttonsTranslateY, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    ]);

    animationSequence.start();
  }, [logoOpacity, titleOpacity, titleTranslateY, subtitleOpacity, subtitleTranslateY, buttonsOpacity, buttonsTranslateY]);

  const handleCreateWallet = async () => {
    router.replace('/onboarding/create-wallet');
  };

  const handleImportWallet = () => {
    router.push('/onboarding/import-wallet');
  };

  return (
    <LinearGradient colors={gradients.blueGradient} style={styles.container}>
      <SafeAreaView style={styles.safeAreaView}>
        <View style={styles.logoContainer}>
          <Animated.View
            style={[
              {
                opacity: logoOpacity,
              },
            ]}
          >
            <Image source={require('@/assets/images/logo.png')} style={styles.image} />
          </Animated.View>
        </View>

        <View style={styles.content}>
          <Animated.View
            style={[
              {
                opacity: titleOpacity,
                transform: [{ translateY: titleTranslateY }],
              },
            ]}
          >
            <ThemedText type="title" darkColor={Colors.dark.buttonText}>
              Welcome to Layerz
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
            <ThemedText type="paragraph" darkColor={Colors.dark.paragraphText}>
              From A–Z, You're in Control
            </ThemedText>
          </Animated.View>
        </View>

        <View style={styles.buttonSection}>
          <Animated.View
            style={[
              styles.buttonContainer,
              {
                opacity: buttonsOpacity,
                transform: [{ translateY: buttonsTranslateY }],
              },
            ]}
          >
            <TouchableOpacity style={styles.button} onPress={handleCreateWallet}>
              <View style={styles.view}>
                <ThemedText style={styles.buttonText} darkColor={Colors.dark.buttonText}>
                  Create Wallet
                </ThemedText>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button2} onPress={handleImportWallet}>
              <View style={styles.view}>
                <ThemedText style={styles.buttonText} darkColor={Colors.dark.buttonText}>
                  Import Wallet
                </ThemedText>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>
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
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  image: {
    alignSelf: 'center',
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
    marginHorizontal: 16,
  },
  button: {
    alignItems: 'center',
    backgroundColor: Colors.dark.buttonPrimary,
    borderRadius: 16,
    paddingVertical: 22,
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
    paddingBottom: 1,
  },
  buttonText: {
    fontSize: 16,
    color: Colors.dark.buttonText,
  },
});
