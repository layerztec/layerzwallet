import React, { useState, useRef, useEffect, useContext } from 'react';
import Pressable from '../components/Pressable';
import { StyleSheet, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView, View, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { Colors, globalDarkBackground } from '@shared/constants/Colors';
import { useSequentialSpringAnimation } from '@/hooks/useCustomTransitions';
import { SecureStorage } from '@/src/class/secure-storage';
import { ENCRYPTED_PREFIX, STORAGE_KEY_MNEMONIC } from '@shared/types/IStorage';
import assert from 'assert';
import { decrypt } from '@/src/modules/encryption';
import { getDeviceID } from '@shared/modules/device-id';
import { Csprng } from '@/src/class/rng';
import { EStep, InitializationContext } from '@shared/hooks/InitializationContext';

/**
 * If user has a seed encrypted, we need to ask for a password to decrypt the seed. This screen is
 * shown upon cold boot to ask for the password, decrypt the seed and set it in the context.
 */
export default function UnlockPassword() {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(true); // Start focused since input auto-focuses
  const router = useRouter();
  const { setStep } = useContext(InitializationContext);

  const passwordInputRef = useRef<TextInput>(null);

  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const passwordBorderAnimation = useRef(new Animated.Value(1)).current; // Start with focused state

  const titleTransition = useSequentialSpringAnimation(200);
  const subtitleTransition = useSequentialSpringAnimation(400);
  const inputTransition = useSequentialSpringAnimation(600);
  const buttonTransition = useSequentialSpringAnimation(800);

  useEffect(() => {
    if (passwordInputRef.current) {
      setTimeout(() => passwordInputRef.current?.focus(), 1_500);
    }
  }, []);

  // Animate border color on focus/blur
  useEffect(() => {
    Animated.timing(passwordBorderAnimation, {
      toValue: isPasswordFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isPasswordFocused, passwordBorderAnimation]);

  // Create animated border style
  const passwordBorderStyle = {
    borderColor: passwordBorderAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(0, 0, 0, 0.3)', 'rgba(255, 255, 255, 0.8)'],
    }),
    borderWidth: 1,
  };

  const handleUnlockPassword = async () => {
    setIsLoading(true);

    try {
      const encryptedMnemonic = await SecureStorage.getItem(STORAGE_KEY_MNEMONIC);
      assert(encryptedMnemonic, 'No encrypted mnemonic found');
      assert(encryptedMnemonic.startsWith(ENCRYPTED_PREFIX), 'Mnemonic not encrypted, reinstall the app');

      const decrypted = await decrypt(encryptedMnemonic.replace(ENCRYPTED_PREFIX, ''), password, await getDeviceID(SecureStorage, Csprng));
      await BackgroundExecutor.setMasterSeed(decrypted);
      // Navigate to home
      setStep(EStep.READY);

      router.replace('/Home');
    } catch (error: any) {
      Alert.alert('Unlock Failed', 'Incorrect password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.container, { backgroundColor: globalDarkBackground }]}>
        <SafeAreaView style={styles.safeAreaView}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardContainer}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
              <View style={styles.content}>
                <Animated.View style={[titleTransition]}>
                  <ThemedText type="title" darkColor={Colors.dark.buttonText} textAlign="center">
                    Unlock wallet
                  </ThemedText>
                </Animated.View>

                <View style={styles.spacer} />

                <Animated.View style={[subtitleTransition]}>
                  <ThemedText type="paragraph" darkColor={Colors.dark.text} textAlign="center">
                    Enter your password to unlock your wallet
                  </ThemedText>
                </Animated.View>

                <Animated.View
                  style={[
                    styles.inputContainer,
                    inputTransition,
                    {
                      transform: [{ translateX: shakeAnimation }, { scale: scaleAnimation }],
                    },
                  ]}
                >
                  <Animated.View style={[styles.inputWrapper, passwordBorderStyle]}>
                    <TextInput
                      ref={passwordInputRef}
                      style={styles.input}
                      placeholder="Enter password"
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      autoCapitalize="none"
                      secureTextEntry
                      value={password}
                      onChangeText={setPassword}
                      onFocus={() => setIsPasswordFocused(true)}
                      onBlur={() => setIsPasswordFocused(false)}
                      testID="EnterPasswordInput"
                    />
                  </Animated.View>
                </Animated.View>
              </View>

              <Animated.View style={[styles.buttonSection, buttonTransition]}>
                <Pressable
                  style={[styles.button, isLoading || !password ? styles.buttonDisabled : null]}
                  onPress={handleUnlockPassword}
                  disabled={isLoading || !password}
                  testID="UnlockPasswordButton"
                >
                  <ThemedText type="button" darkColor={Colors.dark.buttonText}>
                    {isLoading ? 'Unlocking...' : 'Unlock'}
                  </ThemedText>
                </Pressable>
              </Animated.View>
            </ScrollView>
          </KeyboardAvoidingView>
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
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  inputContainer: {
    width: '100%',
    marginTop: 40,
  },
  inputWrapper: {
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  input: {
    height: 56,
    paddingHorizontal: 20,
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  errorContainer: {
    marginTop: -8,
    marginBottom: 16,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  buttonSection: {
    paddingHorizontal: 20,
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
