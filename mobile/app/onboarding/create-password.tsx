import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, Alert, View, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { gradients, Colors } from '@shared/constants/Colors';
import { Typography } from '@/constants/Typography';

const PIN_LENGTH = 4;

export default function CreatePasswordScreen() {
  const [pin, setPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const router = useRouter();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const pinDotScales = useRef(
    Array(PIN_LENGTH)
      .fill(0)
      .map(() => new Animated.Value(1))
  ).current;
  const keypadScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.stagger(100, [
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.back(1.1)),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 80,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim, slideAnim]);

  const animatePinDot = (index: number) => {
    Animated.sequence([
      Animated.spring(pinDotScales[index], {
        toValue: 1.3,
        tension: 300,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.spring(pinDotScales[index], {
        toValue: 1,
        tension: 300,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateKeypadPress = () => {
    Animated.sequence([
      Animated.timing(keypadScale, {
        toValue: 0.98,
        duration: 100,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(keypadScale, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePinInput = (digit: string) => {
    if (isLoading) return;

    const currentPin = isConfirming ? confirmPin : pin;
    if (currentPin.length < PIN_LENGTH) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      animateKeypadPress();

      const newPin = currentPin + digit;
      animatePinDot(currentPin.length);

      if (isConfirming) {
        setConfirmPin(newPin);
        if (newPin.length === PIN_LENGTH) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setTimeout(() => validatePins(pin, newPin), 200);
        }
      } else {
        setPin(newPin);
        if (newPin.length === PIN_LENGTH) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setTimeout(() => {
            setIsConfirming(true);
            setErrorMessage('');
          }, 200);
        }
      }
    }
  };

  const handleDelete = () => {
    if (isLoading) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (isConfirming) {
      if (confirmPin.length > 0) {
        setConfirmPin(confirmPin.slice(0, -1));
      } else {
        setIsConfirming(false);
        setErrorMessage('');
      }
    } else {
      setPin(pin.slice(0, -1));
    }
  };

  const resetPinWithAnimation = () => {
    const fadeOutAnimations = pinDotScales.map((scale) =>
      Animated.timing(scale, {
        toValue: 0,
        duration: 150,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      })
    );

    Animated.parallel(fadeOutAnimations).start(() => {
      setErrorMessage('');
      setConfirmPin('');
      setIsConfirming(false);
      setPin('');

      const fadeInAnimations = pinDotScales.map((scale) =>
        Animated.timing(scale, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      );

      Animated.stagger(50, fadeInAnimations).start();
    });
  };

  const validatePins = async (originalPin: string, confirmedPin: string) => {
    if (originalPin !== confirmedPin) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage('PINs do not match');
      shakeError();

      // Clear error and reset UI after 2.5 seconds
      setTimeout(() => {
        resetPinWithAnimation();
      }, 2500);
      return;
    }

    setIsLoading(true);
    try {
      // Use the PIN as the password for encryption
      const result = await BackgroundExecutor.encryptMnemonic(originalPin);

      if (!result.success) {
        throw new Error(result.message || 'Failed to encrypt wallet');
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Navigate to the terms of service screen
      router.replace('/onboarding/tos');
    } catch (error) {
      console.error('Error encrypting wallet:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to create PIN. Please try again.');
      setPin('');
      setConfirmPin('');
      setIsConfirming(false);
    } finally {
      setIsLoading(false);
    }
  };

  const shakeError = () => {
    const shakeSequence = [
      { toValue: 8, duration: 80 },
      { toValue: -8, duration: 80 },
      { toValue: 6, duration: 70 },
      { toValue: -6, duration: 70 },
      { toValue: 4, duration: 60 },
      { toValue: -4, duration: 60 },
      { toValue: 0, duration: 100 },
    ];

    const animations = shakeSequence.map(({ toValue, duration }) =>
      Animated.timing(shakeAnimation, {
        toValue,
        duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );

    Animated.sequence(animations).start();

    pinDotScales.forEach((scale, index) => {
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 200,
          easing: Easing.elastic(1.2),
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const renderPinDots = () => {
    const currentPin = isConfirming ? confirmPin : pin;
    return (
      <Animated.View
        style={[
          styles.pinDotsContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateX: shakeAnimation }, { scale: scaleAnim }],
          },
        ]}
      >
        {Array.from({ length: PIN_LENGTH }).map((_, index) => (
          <Animated.View
            key={index}
            style={[
              styles.pinDot,
              currentPin.length > index && styles.pinDotFilled,
              errorMessage && styles.pinDotError,
              {
                transform: [{ scale: pinDotScales[index] }],
              },
            ]}
          />
        ))}
      </Animated.View>
    );
  };

  const renderKeypadButton = (digit: string) => (
    <TouchableOpacity key={digit} style={styles.keypadButton} onPress={() => handlePinInput(digit)} disabled={isLoading}>
      <ThemedText style={styles.keypadButtonText}>{digit}</ThemedText>
    </TouchableOpacity>
  );

  const renderKeypad = () => {
    const rows = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['', '0', 'delete'],
    ];

    return (
      <Animated.View
        style={[
          styles.keypadContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: keypadScale }],
          },
        ]}
      >
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keypadRow}>
            {row.map((item) => {
              if (item === '') {
                return <View key="empty" style={styles.keypadButton} />;
              }
              if (item === 'delete') {
                const currentPin = isConfirming ? confirmPin : pin;
                const isDeleteDisabled = isLoading || currentPin.length === 0;

                return (
                  <TouchableOpacity key="delete" style={[styles.keypadButton, isDeleteDisabled && styles.keypadButtonDisabled]} onPress={handleDelete} disabled={isDeleteDisabled}>
                    <Ionicons name="backspace-outline" size={24} color={isDeleteDisabled ? Colors.dark.white30 : Colors.dark.white90} />
                  </TouchableOpacity>
                );
              }
              return renderKeypadButton(item);
            })}
          </View>
        ))}
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradients.blueGradient} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.contentContainer}>
            <View style={styles.titleContainer}>
              <Animated.View style={[{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <ThemedText style={styles.title}>{isConfirming ? 'Confirm your PIN' : 'Choose a 4-digit PIN'}</ThemedText>
              </Animated.View>

              <Animated.View style={[{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <ThemedText style={styles.subtitle}>{isConfirming ? 'Enter your PIN again to confirm' : 'Use a PIN you will remember. It cannot be recovered.'}</ThemedText>
              </Animated.View>
            </View>

            <View style={styles.pinSection}>{renderPinDots()}</View>
            <ThemedText style={styles.pinExplanation}>This is used to encrypt your wallet.</ThemedText>
            {errorMessage ? <ThemedText style={styles.errorText}>{errorMessage}</ThemedText> : null}
            <View style={styles.keypadSection}>
              <View style={styles.keypadSeparator} />
              {renderKeypad()}
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  titleContainer: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: {
    ...Typography.headline,
    color: Colors.dark.buttonText,
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    ...Typography.paragraph,
    color: Colors.dark.paragraphText,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '400',
  },
  pinSection: {
    alignItems: 'center',
    marginVertical: 40,
  },
  pinDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  pinExplanation: {
    ...Typography.paragraph,
    color: Colors.dark.paragraphText,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    marginHorizontal: 20,
    marginBottom: 10,
    fontWeight: '400',
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.dark.white30,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: Colors.dark.white50,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  pinDotFilled: {
    backgroundColor: Colors.dark.white90,
    borderColor: Colors.dark.white90,
    shadowOpacity: 0.2,
  },
  pinDotError: {
    backgroundColor: Colors.dark.error,
    borderColor: Colors.dark.error,
    shadowColor: Colors.dark.error,
    shadowOpacity: 0.3,
  },
  errorText: {
    ...Typography.paragraph,
    color: Colors.dark.error,
    textAlign: 'center',
    fontSize: 14,
    marginTop: 10,
    fontWeight: '400',
  },
  keypadSection: {
    alignItems: 'center',
    paddingBottom: 40,
    justifyContent: 'flex-end',
    flex: 1,
  },
  keypadSeparator: {
    width: '120%',
    marginLeft: -40,
    height: 1,
    backgroundColor: Colors.dark.white30,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  keypadContainer: {
    alignItems: 'center',
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  keypadButton: {
    width: 80,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
  },
  keypadButtonDisabled: {
    opacity: 0.3,
  },
  keypadButtonText: {
    ...Typography.buttonText,
    color: Colors.dark.buttonText,
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 32,
  },
} as const);
