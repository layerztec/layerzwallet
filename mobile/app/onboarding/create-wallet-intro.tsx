import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Animated, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@shared/constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHorizontalSpringTransition, useSequentialSpringAnimation } from '@/hooks/useCustomTransitions';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { sleep } from '@shared/modules/sleep';

export default function CreateWalletIntroScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(false);

  const imageTransition = useHorizontalSpringTransition(true, 'forward');
  const titleTransition = useSequentialSpringAnimation(200);
  const subtitleTransition = useSequentialSpringAnimation(400);
  const buttonTransition = useSequentialSpringAnimation(600);

  useEffect(() => {
    navigation.setOptions({
      gestureEnabled: !isLoading,
      headerBackVisible: !isLoading,
    });
  }, [isLoading, navigation]);

  const handleCreateWallet = async () => {
    try {
      setIsLoading(true);

      // Give enough time for navigation options to be set and animate
      await sleep(100);
      const hasMnemonic = await BackgroundExecutor.hasMnemonic();
      if (!hasMnemonic) {
        const response = await BackgroundExecutor.createMnemonic();
        router.push({
          pathname: '/onboarding/create-wallet',
          params: { mnemonic: response.mnemonic },
        });
      } else {
        router.push('/onboarding/create-wallet');
      }
    } catch (error) {
      console.error('Error in handleCreateWallet:', error);
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.container, { backgroundColor: Colors.GlobalDarkBackground }]}>
        <SafeAreaView style={styles.safeAreaView}>
          <View style={styles.logoContainer}>
            <Animated.View style={[imageTransition]}>
              <Image source={require('@/assets/images/ui/newWallet.png')} style={styles.image} />
            </Animated.View>
          </View>

          <View style={styles.content}>
            <Animated.View style={[titleTransition]}>
              <ThemedText type="title" darkColor={Colors.dark.buttonText} textAlign="center">
                Generate your new recovery phrase
              </ThemedText>
            </Animated.View>

            <View style={styles.spacer} />

            <Animated.View style={[subtitleTransition]}>
              <ThemedText type="paragraph" darkColor={Colors.dark.text} textAlign="center">
                A recovery phrase is a series of 12 words in a specific order. This word combination is unique to your wallet. Make sure to have pen and paper ready so you can write it down.
              </ThemedText>
            </Animated.View>
          </View>

          <View style={styles.buttonSection}>
            <Animated.View style={[styles.buttonContainer, buttonTransition]}>
              <TouchableOpacity style={[styles.button, isLoading && styles.buttonDisabled]} onPress={handleCreateWallet} disabled={isLoading}>
                <View style={styles.view}>
                  {isLoading ? (
                    <>
                      <ActivityIndicator size="small" color={Colors.dark.buttonText} style={styles.activityIndicator} />
                      <ThemedText type="button" darkColor={Colors.dark.buttonText}>
                        Loading...
                      </ThemedText>
                    </>
                  ) : (
                    <ThemedText type="button" darkColor={Colors.dark.buttonText}>
                      Continue
                    </ThemedText>
                  )}
                </View>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </SafeAreaView>
      </View>
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 60,
    width: 120,
    height: 120,
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
  buttonDisabled: {
    opacity: 0.6,
  },
  view: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  spacer: {
    marginVertical: 10,
  },
  activityIndicator: {
    marginRight: 8,
  },
});
