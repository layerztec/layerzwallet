import React, { useState } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, Alert, View, Animated, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { Colors, gradients } from '@shared/constants/Colors';
import { useSequentialSpringAnimation, useHorizontalSpringTransition } from '@/hooks/useCustomTransitions';

export default function TermsOfServiceScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const imageTransition = useHorizontalSpringTransition(true, 'forward');
  const titleTransition = useSequentialSpringAnimation(200);
  const termsTransition = useSequentialSpringAnimation(400);
  const buttonTransition = useSequentialSpringAnimation(600);

  const handleAgree = async () => {
    setIsLoading(true);
    try {
      // Accept the terms of service
      await BackgroundExecutor.acceptTermsOfService();

      // Navigate to the main home screen
      router.replace('/Home');
    } catch (error) {
      console.error('Error accepting terms:', error);
      Alert.alert('Error', 'Failed to accept terms. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradients.blueGradient} style={styles.container}>
        <SafeAreaView style={styles.safeAreaView}>
          <View style={styles.logoContainer}>
            <Animated.View style={[imageTransition]}>
              <View style={styles.iconContainer}>
                <Ionicons name="document-text-outline" size={60} color={Colors.dark.buttonText} />
              </View>
            </Animated.View>
          </View>

          <View style={styles.content}>
            <Animated.View style={[titleTransition]}>
              <ThemedText type="title" darkColor={Colors.dark.buttonText} textAlign="center">
                Terms of Service
              </ThemedText>
            </Animated.View>

            <View style={{ marginVertical: 10 }} />

            <Animated.View style={[styles.termsContainer, termsTransition]}>
              <ScrollView style={styles.termsScrollView} showsVerticalScrollIndicator={false}>
                <ThemedText style={styles.termsText} darkColor="rgba(255, 255, 255, 0.9)">
                  {TERMS_OF_SERVICE}
                </ThemedText>
              </ScrollView>
            </Animated.View>
          </View>

          <Animated.View style={[styles.buttonSection, buttonTransition]}>
            <TouchableOpacity style={[styles.button, isLoading ? styles.buttonDisabled : null]} onPress={handleAgree} disabled={isLoading}>
              <View style={styles.view}>
                <View style={styles.iconBorder}>
                  <Image source={require('@/assets/images/ui/arrow-right.png')} style={styles.arrowIcon} />
                </View>
                <ThemedText style={styles.buttonText} darkColor={Colors.dark.buttonText}>
                  {isLoading ? 'Processing...' : 'I Agree'}
                </ThemedText>
              </View>
            </TouchableOpacity>
          </Animated.View>
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
  },
  iconContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  content: {
    flex: 1,
    paddingTop: 10,
    paddingBottom: 20,
  },
  termsContainer: {
    flex: 1,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  termsScrollView: {
    flex: 1,
    padding: 20,
  },
  termsText: {
    fontSize: 14,
    lineHeight: 22,
  },
  buttonSection: {
    paddingBottom: 20,
  },
  button: {
    backgroundColor: Colors.dark.buttonPrimary,
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  view: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  iconBorder: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  arrowIcon: {
    tintColor: Colors.dark.buttonText,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

const TERMS_OF_SERVICE = `
TERMS OF SERVICE

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

By clicking "I Agree," you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
`;
