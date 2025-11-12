import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, Alert, View, Animated, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { Colors } from '@shared/constants/Colors';
import { useSequentialSpringAnimation } from '@/hooks/useCustomTransitions';
import { Image } from 'expo-image';

export default function TermsOfServiceScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [backupChecked, setBackupChecked] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);

  const iconTransition = useSequentialSpringAnimation(200);
  const titleTransition = useSequentialSpringAnimation(400);
  const subtitleTransition = useSequentialSpringAnimation(600);
  const checkboxTransition = useSequentialSpringAnimation(800);
  const buttonTransition = useSequentialSpringAnimation(1000);

  const handleAgree = async () => {
    if (!backupChecked || !termsChecked) {
      Alert.alert('Please check both boxes', 'You must confirm that you have backed up your recovery phrase and accept the terms of service to continue.');
      return;
    }

    setIsLoading(true);
    try {
      // Accept the terms of service
      await BackgroundExecutor.acceptTermsOfService();

      // Navigate to the main home screen with onboarding parameter
      router.replace('/Home?fromOnboarding=true');
    } catch (error) {
      console.error('Error accepting terms:', error);
      Alert.alert('Error', 'Failed to accept terms. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckboxPress = (type: 'backup' | 'terms') => {
    if (type === 'backup') {
      setBackupChecked(!backupChecked);
    } else {
      setTermsChecked(!termsChecked);
    }
  };

  const handleOpenTerms = async () => {
    try {
      await Linking.openURL('https://layerzwallet.com/tos');
    } catch (error) {
      console.error('Failed to open Terms of Service URL:', error);
      Alert.alert('Error', 'Failed to open Terms of Service. Please try again.');
    }
  };

  const isButtonEnabled = backupChecked && termsChecked && !isLoading;

  return (
    <View style={styles.container}>
      <View style={[styles.container, { backgroundColor: Colors.GlobalDarkBackground }]}>
        <SafeAreaView style={styles.safeAreaView}>
          <View style={styles.logoContainer}>
            <Animated.View style={[iconTransition]}>
              <Image source={require('@/assets/images/ui/success.png')} style={styles.icon} />
            </Animated.View>
          </View>
          <View style={styles.content}>
            <Animated.View style={[titleTransition]}>
              <ThemedText type="title" darkColor={Colors.dark.buttonText} textAlign="center">
                Wallet created{'\n'}successfully
              </ThemedText>
            </Animated.View>

            <View style={styles.spacer} />

            <Animated.View style={[subtitleTransition]}>
              <ThemedText type="paragraph" darkColor="rgba(255, 255, 255, 0.7)" textAlign="center" testID="TosSubtitle">
                You are now ready to access your wallet and unlock the full potential that Bitcoin has to offer via Layer2
              </ThemedText>
            </Animated.View>
          </View>
          <View style={styles.checkboxSection}>
            <Animated.View style={[checkboxTransition]}>
              <TouchableOpacity style={styles.checkboxContainer} onPress={() => handleCheckboxPress('backup')} activeOpacity={0.7} testID="BackupRecoveryPhraseCheckbox">
                <View style={[styles.checkbox, backupChecked && styles.checkboxChecked]}>{backupChecked && <Ionicons name="checkmark" size={16} />}</View>
                <ThemedText style={styles.checkboxText} darkColor="rgba(255, 255, 255, 0.9)">
                  I have backed up my recovery phrase and I understand I cannot recover my wallet without it.
                </ThemedText>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={[checkboxTransition]}>
              <TouchableOpacity style={styles.checkboxContainer} onPress={() => handleCheckboxPress('terms')} activeOpacity={0.7} testID="TermsOfServiceCheckbox">
                <View style={[styles.checkbox, termsChecked && styles.checkboxChecked]}>{termsChecked && <Ionicons name="checkmark" size={16} />}</View>
                <ThemedText style={styles.checkboxText} darkColor="rgba(255, 255, 255, 0.9)">
                  I have read and accept the{' '}
                  <ThemedText style={[styles.checkboxText, styles.linkText]} darkColor="rgba(255, 255, 255, 0.9)" onPress={handleOpenTerms}>
                    Terms of Service
                  </ThemedText>{' '}
                  of Layerz Tec Ltd.
                </ThemedText>
              </TouchableOpacity>
            </Animated.View>
          </View>
          <Animated.View style={[styles.buttonSection, buttonTransition]}>
            <TouchableOpacity style={[styles.button, !isButtonEnabled && styles.buttonDisabled]} onPress={handleAgree} disabled={!isButtonEnabled} testID="LetsGoButton">
              <ThemedText type="button" darkColor={Colors.dark.buttonText}>
                {isLoading ? 'Processing...' : "Let's go"}
              </ThemedText>
            </TouchableOpacity>
          </Animated.View>
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
  },
  icon: {
    width: 120,
    height: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 60,
  },
  content: {
    flex: 1,
    paddingTop: 10,
    paddingBottom: 20,
  },
  checkboxSection: {
    marginBottom: 20,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 4,
    marginRight: 12,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  checkboxText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  linkText: {
    textDecorationLine: 'underline',
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
  spacer: {
    marginVertical: 10,
  },
});
