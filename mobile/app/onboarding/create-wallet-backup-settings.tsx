import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Animated, Easing, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { Colors, gradients } from '@shared/constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import SettingsRow from '@/components/SettingsRow';
import { useHorizontalSpringTransition, useSequentialSpringAnimation } from '@/hooks/useCustomTransitions';

export default function CreateWalletBackupSettingsScreen() {
  const router = useRouter();

  const imageTransition = useHorizontalSpringTransition(true, 'forward');
  const titleTransition = useSequentialSpringAnimation(100);
  const subtitleTransition = useSequentialSpringAnimation(200);
  const settingsTransition = useSequentialSpringAnimation(300);
  const buttonTransition = useSequentialSpringAnimation(400);

  const handleCreateWallet = async () => {
    router.push('/onboarding/create-wallet-backup-password');
  };

  const handleManualBackup = async () => {
    router.push('/manual-backup/intro');
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradients.blueGradient} style={styles.container}>
        <SafeAreaView style={styles.safeAreaView}>
          <ScrollView style={styles.scrollView}>
            <View style={styles.header}>
              <Animated.View style={[imageTransition]}>
                <Image source={require('@/assets/images/ui/newWallet.png')} style={styles.image} />
              </Animated.View>

              <View style={styles.headerContent}>
                <Animated.View style={[titleTransition]}>
                  <ThemedText type="title" darkColor={Colors.dark.buttonText} textAlign="center">
                    To better protect your funds, review your backup and security settings.
                  </ThemedText>
                </Animated.View>

                <View style={{ marginVertical: 10 }} />

                <Animated.View style={[subtitleTransition]}>
                  <ThemedText type="paragraph" darkColor={Colors.dark.text} textAlign="center">
                    A recovery phrase is a series of 12 words in a specific order. This word combination is unique to your wallet. Make sure to have pen and paper ready so you can write it down.
                  </ThemedText>
                </Animated.View>
              </View>
            </View>

            <Animated.View style={[settingsTransition, styles.settingsContent]}>
              <SettingsRow
                title="Manual Backup"
                description="To recover your wallet in case you lose access to this application."
                onPress={handleManualBackup}
                showBottomDivider
                testID="ManualBackupSettingsRow"
              />
              <SettingsRow title="Cloud Backup" description="To recover your wallet in case you lose access to this application." disabled testID="CloudBackupSettingsRow" />
            </Animated.View>
          </ScrollView>

          <Animated.View style={[styles.footer, buttonTransition]}>
            <TouchableOpacity style={styles.button} onPress={handleCreateWallet} testID="DoThisLaterButton" disabled>
              <View style={styles.view}>
                <ThemedText style={styles.buttonText} darkColor={Colors.dark.buttonText}>
                  Do this later
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
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  headerContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 20,
  },
  scrollView: {
    flex: 1,
  },
  settingsContent: {
    paddingHorizontal: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  image: {
    alignSelf: 'center',
    marginRight: 8,
  },
  button: {
    backgroundColor: Colors.dark.buttonPrimary,
    borderRadius: 16,
    height: 56,
    opacity: 0.5,
    justifyContent: 'center',
    alignContent: 'center',
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
