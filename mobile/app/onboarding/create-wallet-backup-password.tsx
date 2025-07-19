import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { Colors, gradients } from '@shared/constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import SettingsRow from '@/components/SettingsRow';
import { useHorizontalSpringTransition, useSequentialSpringAnimation } from '@/hooks/useCustomTransitions';
import { useBiometrics } from '@/hooks/useBiometrics';

export default function CreateWalletBackupPasswordScreen() {
  const router = useRouter();
  const [pinEnabled, setPinEnabled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const biometricInfo = useBiometrics();

  const imageTransition = useHorizontalSpringTransition(true, 'forward');
  const titleTransition = useSequentialSpringAnimation(100);
  const subtitleTransition = useSequentialSpringAnimation(200);
  const settingsTransition = useSequentialSpringAnimation(300);
  const buttonTransition = useSequentialSpringAnimation(400);

  const handleCreateWallet = async () => {
    router.dismissAll();
    router.replace('/onboarding/create-wallet');
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradients.blueGradient} style={styles.container}>
        <SafeAreaView style={styles.safeAreaView}>
          <View style={styles.fixedImageContainer}>
            <Animated.View style={[imageTransition]}>
              <Image source={require('@/assets/images/ui/newWallet.png')} style={styles.image} />
            </Animated.View>
          </View>

          <View style={styles.content}>
            <Animated.View style={[titleTransition]}>
              <ThemedText type="title" darkColor={Colors.dark.buttonText} textAlign="center">
                Now let's secure this app with a PIN or Biometric Authentication
              </ThemedText>
            </Animated.View>

            <View style={{ marginVertical: 10 }} />

            <Animated.View style={[subtitleTransition]}>
              <ThemedText type="paragraph" darkColor={Colors.dark.text} textAlign="center">
                If someone gets hold of your phone unlocked, you don't want them to be able to view or move your funds.
              </ThemedText>
            </Animated.View>
          </View>

          <Animated.View style={[settingsTransition]}>
            <SettingsRow
              title="PIN"
              description="Set a 4-digit code to protect from unwanted access."
              showSwitch
              switchValue={pinEnabled}
              onSwitchToggle={setPinEnabled}
              showBottomDivider
              testID="PinSettingsRow"
            />
            {biometricInfo.isAvailable && (
              <SettingsRow
                title={biometricInfo.displayName}
                description={biometricInfo.description}
                showSwitch
                switchValue={biometricEnabled}
                onSwitchToggle={setBiometricEnabled}
                testID="BiometricSettingsRow"
              />
            )}
          </Animated.View>

          <Animated.View style={[styles.buttonSection, buttonTransition]}>
            <View>
              <TouchableOpacity style={styles.button} onPress={handleCreateWallet} testID="DoThisLaterButton">
                <View style={styles.view}>
                  <ThemedText style={styles.buttonText} darkColor={Colors.dark.buttonText}>
                    Do this later
                  </ThemedText>
                </View>
              </TouchableOpacity>
            </View>
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
    paddingTop: 180,
    paddingBottom: 20,
  },
  buttonSection: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
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
