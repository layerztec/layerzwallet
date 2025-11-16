import React, { useState, useRef, useEffect } from 'react';
import { TextInput, View, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Animated, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAskPassword } from '../src/hooks/AskPasswordContext';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@shared/constants/Colors';
import { useSequentialSpringAnimation } from '@/hooks/useCustomTransitions';
import ScreenHeader from '@/components/navigation/ScreenHeader';

export default function AskPasswordScreen() {
  const [password, setPassword] = useState<string>('');
  const [isPasswordFocused, setIsPasswordFocused] = useState<boolean>(true);
  const router = useRouter();
  const { handlePasswordSubmit } = useAskPassword();

  const passwordInputRef = useRef<TextInput>(null);
  const passwordBorderAnimation = useRef(new Animated.Value(1)).current;

  const titleTransition = useSequentialSpringAnimation(200);
  const subtitleTransition = useSequentialSpringAnimation(400);
  const inputTransition = useSequentialSpringAnimation(600);
  const buttonTransition = useSequentialSpringAnimation(800);

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

  const handlePasswordChange = (text: string) => {
    setPassword(text);
  };

  const onOkPress = () => {
    // Call the context function to submit the password
    handlePasswordSubmit(password);
    router.back();
  };

  const onCancelPress = () => {
    // Call the context function with empty password to indicate cancellation
    handlePasswordSubmit('');
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
                    Enter your password to continue
                  </ThemedText>
                </Animated.View>

                <Animated.View style={[styles.inputContainer, inputTransition]}>
                  {password ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color="rgba(255, 255, 255, 0.9)" />
                      <ThemedText style={styles.loadingText} darkColor="rgba(255, 255, 255, 0.7)">
                        Processing...
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
                        testID="PasswordInput"
                      />
                    </Animated.View>
                  )}
                </Animated.View>
              </View>

              <Animated.View style={[styles.buttonSection, buttonTransition]}>
                <TouchableOpacity style={[styles.button, !password ? styles.buttonDisabled : null]} onPress={onOkPress} disabled={!password} testID="SubmitButton">
                  <ThemedText type="button" darkColor={Colors.dark.buttonText}>
                    Continue
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
