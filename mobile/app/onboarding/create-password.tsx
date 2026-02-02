import React, { useState, useRef, useEffect, useCallback } from 'react';
import { StyleSheet, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView, View, Animated, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/ThemedText';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { Colors, globalDarkBackground } from '@shared/constants/Colors';
import { useSequentialSpringAnimation } from '@/hooks/useCustomTransitions';
import Pressable from '../../components/Pressable';

export default function CreatePasswordScreen() {
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isRepeatPasswordFocused, setIsRepeatPasswordFocused] = useState(false);
  const router = useRouter();

  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const errorFadeAnimation = useRef(new Animated.Value(0)).current;
  const inputBorderAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const passwordBorderAnimation = useRef(new Animated.Value(0)).current;
  const repeatPasswordBorderAnimation = useRef(new Animated.Value(0)).current;

  const repeatPasswordInputRef = useRef<TextInput>(null);

  const titleTransition = useSequentialSpringAnimation(200);
  const subtitleTransition = useSequentialSpringAnimation(400);
  const inputTransition = useSequentialSpringAnimation(600);
  const buttonTransition = useSequentialSpringAnimation(800);

  const animateError = useCallback(() => {
    shakeAnimation.setValue(0);
    errorFadeAnimation.setValue(0);
    inputBorderAnimation.setValue(0);
    scaleAnimation.setValue(1);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(shakeAnimation, {
          toValue: 10,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnimation, {
          toValue: -10,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnimation, {
          toValue: 8,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnimation, {
          toValue: -8,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnimation, {
          toValue: 0,
          duration: 50,
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(errorFadeAnimation, {
        toValue: 1,
        tension: 150,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(inputBorderAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.spring(scaleAnimation, {
          toValue: 0.98,
          tension: 200,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnimation, {
          toValue: 1,
          tension: 200,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      if (repeatPasswordInputRef.current) {
        repeatPasswordInputRef.current.focus();
      }

      setTimeout(() => {
        setErrorMessage('');
      }, 2000);
    });
  }, [shakeAnimation, errorFadeAnimation, inputBorderAnimation, scaleAnimation]);

  const clearErrorAnimation = useCallback(() => {
    Animated.parallel([
      Animated.timing(errorFadeAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(inputBorderAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, [errorFadeAnimation, inputBorderAnimation]);

  useEffect(() => {
    if (errorMessage) {
      animateError();
    } else {
      clearErrorAnimation();
    }
  }, [errorMessage, animateError, clearErrorAnimation]);

  // Animate border color on focus/blur
  useEffect(() => {
    Animated.timing(passwordBorderAnimation, {
      toValue: isPasswordFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isPasswordFocused, passwordBorderAnimation]);

  useEffect(() => {
    Animated.timing(repeatPasswordBorderAnimation, {
      toValue: isRepeatPasswordFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isRepeatPasswordFocused, repeatPasswordBorderAnimation]);

  // Create animated styles for border colors
  const passwordBorderStyle = {
    borderColor: passwordBorderAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(0, 0, 0, 0.3)', 'rgba(255, 255, 255, 0.8)'],
    }),
    borderWidth: 1,
  };

  const repeatPasswordBorderStyle = {
    borderColor: repeatPasswordBorderAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(0, 0, 0, 0.3)', 'rgba(255, 255, 255, 0.8)'],
    }),
    borderWidth: 1,
  };

  const validatePasswords = () => {
    // Reset error message
    setErrorMessage('');

    // Check if passwords match
    if (password !== repeatPassword) {
      setErrorMessage('Passwords do not match');
      setRepeatPassword('');
      return false;
    }
    // Check password length (minimum 8 characters)
    if (password.length < 2) {
      setErrorMessage('Password must be at least 2 characters long');
      return false;
    }

    // Password is valid
    return true;
  };

  const handleCreatePassword = async () => {
    Keyboard.dismiss();

    if (!validatePasswords()) {
      return;
    }

    setIsLoading(true);
    try {
      // Encrypt the mnemonic with the provided password
      const result = await BackgroundExecutor.encryptMnemonic(password);

      if (!result.success) {
        throw new Error(result.message || 'Failed to encrypt wallet');
      }

      router.replace('/Home');
    } catch (error) {
      console.error('Error encrypting wallet:', error);
      Alert.alert('Error', 'Failed to create password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.container, { backgroundColor: globalDarkBackground }]}>
        <SafeAreaView style={styles.safeAreaView}>
          <ScreenHeader />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardContainer}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
              <View style={styles.content}>
                <Animated.View style={[titleTransition]}>
                  <ThemedText type="title" darkColor={Colors.dark.buttonText} textAlign="center">
                    Create Password
                  </ThemedText>
                </Animated.View>

                <View style={styles.spacer} />

                <Animated.View style={[subtitleTransition]}>
                  <ThemedText type="paragraph" darkColor={Colors.dark.text} textAlign="center">
                    Create a password to encrypt your wallet
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

                  <Animated.View style={[styles.inputWrapper, repeatPasswordBorderStyle]}>
                    <TextInput
                      ref={repeatPasswordInputRef}
                      style={styles.input}
                      placeholder="Repeat password"
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      autoCapitalize="none"
                      secureTextEntry
                      value={repeatPassword}
                      onChangeText={setRepeatPassword}
                      onFocus={() => setIsRepeatPasswordFocused(true)}
                      onBlur={() => setIsRepeatPasswordFocused(false)}
                      testID="RepeatPasswordInput"
                    />
                  </Animated.View>

                  {errorMessage ? (
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
                        {errorMessage}
                      </ThemedText>
                    </Animated.View>
                  ) : null}
                </Animated.View>
              </View>

              <Animated.View style={[styles.buttonSection, buttonTransition]}>
                <Pressable
                  style={[styles.button, isLoading || !password || !repeatPassword ? styles.buttonDisabled : null]}
                  onPress={handleCreatePassword}
                  disabled={isLoading || !password || !repeatPassword}
                  testID="CreatePasswordButton"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.8}
                >
                  <ThemedText type="button" darkColor={Colors.dark.buttonText}>
                    {isLoading ? 'Creating...' : 'Create Password'}
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
    justifyContent: 'flex-start',
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
