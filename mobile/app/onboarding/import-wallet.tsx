import { useRouter, useFocusEffect } from 'expo-router';
import React, { useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
  Image,
  Keyboard,
  TouchableWithoutFeedback,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ThemedText } from '@/components/ThemedText';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { sanitizeAndValidateMnemonic } from '@shared/modules/wallet-utils';
import { Colors, gradients } from '@shared/constants/Colors';
import { useSequentialSpringAnimation } from '@/hooks/useCustomTransitions';

export default function ImportWalletScreen() {
  const { scanQr } = useContext(ScanQrContext);
  const router = useRouter();
  const navigation = useNavigation();
  const [mnemonic, setMnemonic] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const inputTransition = useSequentialSpringAnimation(300);
  const buttonTransition = useSequentialSpringAnimation(400);
  const scanButtonTransition = useSequentialSpringAnimation(500);

  const glowAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnimation = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isLoading) {
      Animated.timing(fadeAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        const startGlowAnimation = () => {
          Animated.loop(
            Animated.sequence([
              Animated.timing(glowAnimation, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
              }),
              Animated.timing(glowAnimation, {
                toValue: 0,
                duration: 1000,
                useNativeDriver: true,
              }),
            ])
          ).start();
        };
        startGlowAnimation();
      });
    } else {
      glowAnimation.stopAnimation();
      glowAnimation.setValue(0);
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      glowAnimation.stopAnimation();
    };
  }, [isLoading, glowAnimation, fadeAnimation]);

  // Track keyboard visibility and screen dimensions
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Handle hardware back button and navigation options
  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({
        headerBackVisible: !isLoading,
        gestureEnabled: !isLoading,
        headerShown: !isLoading,
      });

      const onBackPress = () => {
        if (isLoading) {
          return true;
        }
        return false;
      };

      const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => backHandler.remove();
    }, [isLoading, navigation])
  );

  const handleImportWallet = async () => {
    if (!mnemonic.trim()) {
      setError('Please enter your seed phrase');
      return;
    }

    setIsLoading(true);
    setError('');

    let sanitizedMnemonic: string = mnemonic;

    try {
      // Small delay to allow UI to update
      await new Promise((resolve) => setTimeout(resolve, 100));

      try {
        sanitizedMnemonic = sanitizeAndValidateMnemonic(mnemonic);
      } catch {
        setError('Invalid mnemonic seed');
        return;
      }

      const response = await BackgroundExecutor.saveMnemonic(sanitizedMnemonic);

      if (!response) {
        setError('Invalid mnemonic seed');
      } else {
        await BackgroundExecutor.setMasterSeed(sanitizedMnemonic);
        router.dismissAll();
        router.replace('/onboarding/tos');
      }
    } catch (err) {
      setError('An error occurred while importing the wallet');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradients.blueGradient} style={styles.container}>
        <SafeAreaView style={styles.safeAreaView} testID="ImportWalletScreen">
          {isLoading ? (
            <Animated.View style={[styles.loadingContainer, { opacity: fadeAnimation.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
              <View style={styles.loadingContent}>
                <Animated.View
                  style={[
                    styles.loadingIconContainer,
                    {
                      shadowColor: '#fff',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: glowAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.2, 0.8],
                      }),
                      shadowRadius: glowAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [5, 20],
                      }),
                      elevation: glowAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [5, 15],
                      }),
                    },
                  ]}
                >
                  <Image source={require('@/assets/images/ui/importing.png')} style={{ width: 80, height: 80 }} />
                </Animated.View>
                <ThemedText style={styles.loadingTitle} darkColor="rgba(255, 255, 255, 0.9)">
                  Importing wallet...
                </ThemedText>
                <ThemedText style={styles.loadingSubtitle} darkColor="rgba(255, 255, 255, 0.6)">
                  We're verifying your seed phrase and setting up your wallet.{'\n'}This may take a few moments.
                </ThemedText>
              </View>
            </Animated.View>
          ) : (
            <Animated.View style={[styles.container, { opacity: fadeAnimation }]}>
              <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 20}>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                  <View style={styles.scrollContent}>
                    <View style={styles.content}>
                      <Animated.View
                        style={[
                          styles.inputWrapper,
                          inputTransition,
                          {
                            width: screenWidth - 40,
                            maxWidth: 370,
                            height: keyboardVisible ? Math.min(screenHeight * 0.3, 200) : Math.min(screenHeight * 0.4, 306),
                          },
                        ]}
                      >
                        <TextInput
                          style={styles.mnemonicInput}
                          placeholder="Enter your recovery phrase or paste your private key here"
                          placeholderTextColor="rgba(255, 255, 255, 0.5)"
                          numberOfLines={4}
                          value={mnemonic}
                          clearTextOnFocus
                          onChangeText={setMnemonic}
                          multiline
                          autoCapitalize="none"
                          autoCorrect={false}
                          enablesReturnKeyAutomatically
                          returnKeyType="done"
                          onSubmitEditing={Keyboard.dismiss}
                          editable={!isLoading}
                          testID="ImportWalletMnemonicInput"
                        />
                      </Animated.View>

                      {error ? (
                        <View style={styles.errorContainer}>
                          <ThemedText style={styles.errorText} darkColor="#FF6B6B">
                            {error}
                          </ThemedText>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </TouchableWithoutFeedback>
              </KeyboardAvoidingView>
              <Animated.View style={[styles.buttonSection, buttonTransition]}>
                <Animated.View style={scanButtonTransition}>
                  <TouchableOpacity
                    style={[styles.scanButton, isLoading && styles.disabledButton]}
                    onPress={async () => {
                      const scanned = await scanQr();
                      if (scanned) {
                        setMnemonic(scanned);
                      }
                    }}
                    disabled={isLoading}
                  >
                    <Ionicons name="qr-code-outline" size={24} color="rgba(255, 255, 255, 0.9)" />
                  </TouchableOpacity>
                </Animated.View>

                <TouchableOpacity
                  style={[styles.button, isLoading || !mnemonic.trim() ? styles.buttonDisabled : null]}
                  onPress={handleImportWallet}
                  disabled={isLoading || !mnemonic.trim()}
                  testID="ImportWalletImportButton"
                >
                  {isLoading ? (
                    <ActivityIndicator color={Colors.dark.buttonText} size="small" />
                  ) : (
                    <ThemedText style={styles.buttonText} darkColor={Colors.dark.buttonText}>
                      Import
                    </ThemedText>
                  )}
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
          )}
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  safeAreaView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    justifyContent: 'flex-start',
  },
  inputWrapper: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    marginBottom: 16,
    alignSelf: 'center',
    marginTop: 40,
  },
  mnemonicInput: {
    width: '100%',
    height: '100%',
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlignVertical: 'center',
    textAlign: 'center',
    justifyContent: 'center',
    alignItems: 'center',
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
  scanButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  buttonSection: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
  },
  button: {
    backgroundColor: Colors.dark.buttonPrimary,
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingContent: {
    alignItems: 'center',
    maxWidth: 300,
  },
  loadingIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  loadingTitle: {
    fontSize: 32,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 38,
    paddingVertical: 4,
  },
  loadingSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});
