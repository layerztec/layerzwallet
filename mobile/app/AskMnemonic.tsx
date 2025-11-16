import assert from 'assert';
import React, { useEffect, useState, useRef } from 'react';
import { TextInput, View, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Animated, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAskMnemonic } from '../src/hooks/AskMnemonicContext';

import { getDeviceID } from '@shared/modules/device-id';
import { ENCRYPTED_PREFIX, STORAGE_KEY_MNEMONIC } from '@shared/types/IStorage';
import { SecureStorage } from '../src/class/secure-storage';
import { Csprng } from '../src/class/rng';
import { decrypt } from '../src/modules/encryption';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@shared/constants/Colors';
import { useSequentialSpringAnimation } from '@/hooks/useCustomTransitions';
import ScreenHeader from '@/components/navigation/ScreenHeader';

export default function AskMnemonicScreen() {
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isPasswordFocused, setIsPasswordFocused] = useState<boolean>(true);
  const router = useRouter();
  const { handleMnemonicSubmit } = useAskMnemonic();

  const passwordInputRef = useRef<TextInput>(null);

  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const errorFadeAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const passwordBorderAnimation = useRef(new Animated.Value(1)).current;

  const titleTransition = useSequentialSpringAnimation(200);
  const subtitleTransition = useSequentialSpringAnimation(400);
  const inputTransition = useSequentialSpringAnimation(600);
  const buttonTransition = useSequentialSpringAnimation(800);

  // upon load, we check if mnemonic is encrypted and if not, we can just use it
  // and skip this whole dialogue
  useEffect(() => {
    (async () => {
      const encryptedMnemonic = await SecureStorage.getItem(STORAGE_KEY_MNEMONIC);
      if (encryptedMnemonic && !encryptedMnemonic.startsWith(ENCRYPTED_PREFIX)) {
        handleMnemonicSubmit(encryptedMnemonic);
        router.back();
      }
    })();
    // we need do this only once upon load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (passwordInputRef.current && !password) {
      setTimeout(() => passwordInputRef.current?.focus(), 300);
    }
  }, [password]);

  useEffect(() => {
    Animated.timing(passwordBorderAnimation, {
      toValue: isPasswordFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isPasswordFocused, passwordBorderAnimation]);

  const passwordBorderStyle = {
    borderColor: passwordBorderAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(0, 0, 0, 0.3)', 'rgba(255, 255, 255, 0.8)'],
    }),
    borderWidth: 1,
  };

  const animateError = () => {
    shakeAnimation.setValue(0);
    errorFadeAnimation.setValue(0);
    scaleAnimation.setValue(1);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: 8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: -8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]),
      Animated.spring(errorFadeAnimation, { toValue: 1, tension: 150, friction: 8, useNativeDriver: true }),
      Animated.sequence([
        Animated.spring(scaleAnimation, { toValue: 0.98, tension: 200, friction: 8, useNativeDriver: true }),
        Animated.spring(scaleAnimation, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
      ]),
    ]).start();
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (error) setError('');
  };

  const onOkPress = async () => {
    if (!password.trim()) {
      setError('Password is required');
      animateError();
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Get encrypted mnemonic from storage
      const encryptedMnemonic = await SecureStorage.getItem(STORAGE_KEY_MNEMONIC);
      assert(encryptedMnemonic, 'No encrypted mnemonic found');
      if (!encryptedMnemonic.startsWith(ENCRYPTED_PREFIX)) {
        // its not encrypted, we can just use it
        handleMnemonicSubmit(encryptedMnemonic);
        router.back();
        return;
      }

      // Decrypt the mnemonic
      const decrypted = await decrypt(encryptedMnemonic.replace(ENCRYPTED_PREFIX, ''), password, await getDeviceID(SecureStorage, Csprng));

      // Success - call context function with decrypted mnemonic
      handleMnemonicSubmit(decrypted);
      router.back();
    } catch (decryptError: any) {
      console.log('Decryption failed:', decryptError.message);
      setError('Incorrect password. Please try again.');
      animateError();
      setIsLoading(false);
      setPassword('');
      // Don't go back - allow user to retry
    }
  };

  const onCancelPress = () => {
    // Call the context function with error to indicate cancellation
    handleMnemonicSubmit(new Error('User cancelled password entry'));
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.container, { backgroundColor: '#000000' }]}>
        <SafeAreaView style={styles.safeAreaView}>
          <ScreenHeader onBackPress={onCancelPress} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardContainer}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
              <View style={styles.content}>
                <Animated.View style={[titleTransition]}>
                  <ThemedText type="title" darkColor={Colors.dark.buttonText} textAlign="center">
                    Unlock wallet
                  </ThemedText>
                </Animated.View>

                <View style={styles.spacer} />

                <Animated.View style={[subtitleTransition]}>
                  <ThemedText type="paragraph" darkColor={Colors.dark.text} textAlign="center">
                    Enter your password to view your recovery phrase
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
                  {password && !error ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color="rgba(255, 255, 255, 0.9)" />
                      <ThemedText style={styles.loadingText} darkColor="rgba(255, 255, 255, 0.7)">
                        {isLoading ? 'Unlocking...' : 'Processing...'}
                      </ThemedText>
                    </View>
                  ) : (
                    <Animated.View style={[styles.inputWrapper, passwordBorderStyle]}>
                      <TextInput
                        ref={passwordInputRef}
                        style={styles.input}
                        placeholder="Enter password"
                        placeholderTextColor="rgba(255, 255, 255, 0.5)"
                        autoCapitalize="none"
                        secureTextEntry
                        value={password}
                        onChangeText={handlePasswordChange}
                        onFocus={() => setIsPasswordFocused(true)}
                        onBlur={() => setIsPasswordFocused(false)}
                        editable={!isLoading}
                        testID="PasswordInput"
                      />
                    </Animated.View>
                  )}

                  {error ? (
                    <Animated.View
                      style={[
                        styles.errorContainer,
                        {
                          opacity: errorFadeAnimation,
                          transform: [
                            {
                              scale: errorFadeAnimation.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.8, 1],
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      <ThemedText style={styles.errorText} darkColor="#FF6B6B">
                        {error}
                      </ThemedText>
                    </Animated.View>
                  ) : null}
                </Animated.View>
              </View>

              <Animated.View style={[styles.buttonSection, buttonTransition]}>
                <TouchableOpacity style={[styles.button, isLoading || !password ? styles.buttonDisabled : null]} onPress={onOkPress} disabled={isLoading || !password} testID="UnlockButton">
                  <ThemedText type="button" darkColor={Colors.dark.buttonText}>
                    {isLoading ? 'Unlocking...' : 'Unlock'}
                  </ThemedText>
                </TouchableOpacity>
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
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  spacer: {
    height: 16,
  },
  inputContainer: {
    marginTop: 40,
  },
  inputWrapper: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  input: {
    color: Colors.dark.buttonText,
    fontSize: 16,
    padding: 18,
    fontWeight: '500',
  },
  loadingContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    textAlign: 'center',
  },
  errorContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  buttonSection: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  button: {
    backgroundColor: Colors.dark.buttonPrimary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
