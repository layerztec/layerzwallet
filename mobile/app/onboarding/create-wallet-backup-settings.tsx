import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { Colors, gradients } from '@shared/constants/Colors';
import { Typography } from '@shared/constants/Typography';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import SettingsRow from '@/components/SettingsRow';
import { Ionicons } from '@expo/vector-icons';

export default function CreateWalletBackupSettingsScreen() {
  const router = useRouter();

  const logoOpacity = useRef(new Animated.Value(1)).current; // Image stays visible
  const contentFadeIn = useRef(new Animated.Value(0)).current; // Content starts invisible and fades in
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(30)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(30)).current;
  const buttonsOpacity = useRef(new Animated.Value(1)).current; // Button starts visible
  const buttonsTranslateY = useRef(new Animated.Value(0)).current; // Button starts in position

  useEffect(() => {
    // Start with content fade-in animation
    Animated.timing(contentFadeIn, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Then sequence the rest of the animations (excluding button)
    const animationSequence = Animated.sequence([
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
    ]);

    setTimeout(() => {
      animationSequence.start();
    }, 100);
  }, [contentFadeIn, titleOpacity, titleTranslateY, subtitleOpacity, subtitleTranslateY, buttonsOpacity, buttonsTranslateY]);

  const handleCreateWallet = async () => {
    router.replace('/onboarding/create-wallet');
  };

  const handleGoBack = () => {
    // Add reverse cross-fade animation
    Animated.timing(contentFadeIn, {
      toValue: 0,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      router.back();
    });
  };

  return (
    <LinearGradient colors={gradients.blueGradient} style={styles.container}>
      <SafeAreaView style={styles.safeAreaView}>
        {/* Back button */}
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack} testID="BackButton">
          <Ionicons name="chevron-back" size={24} color={Colors.dark.buttonText} />
        </TouchableOpacity>

        {/* Fixed positioned image - same position as first screen */}
        <View style={styles.fixedImageContainer}>
          <Animated.View style={[{ opacity: logoOpacity }]}>
            <Image source={require('@/assets/images/ui/newWallet.png')} style={styles.image} />
          </Animated.View>
        </View>

        {/* Scrollable content area */}
        <Animated.View style={[styles.content, { opacity: contentFadeIn }]}>
          <Animated.View
            style={[
              {
                opacity: titleOpacity,
                transform: [{ translateY: titleTranslateY }],
              },
            ]}
          >
            <ThemedText type="title" darkColor={Colors.dark.buttonText} textAlign="center">
              To better protect your funds, review your backup and security settings.
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

        <Animated.View style={[{ opacity: contentFadeIn }]}>
          <SettingsRow
            title="Manual Backup"
            description="To recover your wallet in case you lose access to this application."
            onPress={handleCreateWallet}
            showBottomDivider
            testID="ManualBackupSettingsRow"
          />
          <SettingsRow title="Cloud Backup" description="To recover your wallet in case you lose access to this application." disabled testID="CloudBackupSettingsRow" />
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
            <TouchableOpacity style={styles.button} onPress={handleCreateWallet} testID="DoThisLaterButton">
              <View style={styles.view}>
                <ThemedText style={styles.buttonText} darkColor={Colors.dark.buttonText}>
                  Do this later
                </ThemedText>
              </View>
            </TouchableOpacity>
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
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 2,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 180, // Make room for fixed image
    paddingBottom: 20,
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
