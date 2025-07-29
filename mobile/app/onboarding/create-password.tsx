import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, Alert, View, Vibration, ViewStyle, TextStyle, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { gradients } from '@shared/constants/Colors';
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
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const shakeAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim, slideAnim]);

  const handlePinInput = (digit: string) => {
    if (isLoading) return;

    const currentPin = isConfirming ? confirmPin : pin;
    if (currentPin.length < PIN_LENGTH) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const newPin = currentPin + digit;

      if (isConfirming) {
        setConfirmPin(newPin);
        if (newPin.length === PIN_LENGTH) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          validatePins(pin, newPin);
        }
      } else {
        setPin(newPin);
        if (newPin.length === PIN_LENGTH) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setIsConfirming(true);
          setErrorMessage('');
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

  const validatePins = async (originalPin: string, confirmedPin: string) => {
    if (originalPin !== confirmedPin) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage('PINs do not match');
      shakeError();

      // Clear error and reset UI after 2.5 seconds
      setTimeout(() => {
        setErrorMessage('');
        setConfirmPin('');
        setIsConfirming(false);
        setPin('');
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
    Vibration.vibrate(500);
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
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
          <View key={index} style={[styles.pinDot, currentPin.length > index && styles.pinDotFilled, errorMessage && styles.pinDotError]} />
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
            transform: [{ translateY: slideAnim }],
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
                return (
                  <TouchableOpacity key="delete" style={styles.keypadButton} onPress={handleDelete} disabled={isLoading}>
                    <Ionicons name="backspace-outline" size={24} color="rgba(255, 255, 255, 0.9)" />
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
            {/* Title Section */}
            <View style={styles.titleContainer}>
              <Animated.View style={[{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <ThemedText style={styles.title}>{isConfirming ? 'Confirm your PIN' : 'Create a PIN'}</ThemedText>
              </Animated.View>

              <Animated.View style={[{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <ThemedText style={styles.subtitle}>{isConfirming ? 'Enter your PIN again to confirm' : 'Create a 4-digit PIN to secure your wallet'}</ThemedText>
              </Animated.View>
            </View>

            {/* PIN Dots */}
            <View style={styles.pinSection}>
              {renderPinDots()}
              {errorMessage ? <ThemedText style={styles.errorText}>{errorMessage}</ThemedText> : null}
            </View>

            {/* Keypad */}
            <View style={styles.keypadSection}>{renderKeypad()}</View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  } as ViewStyle,
  gradient: {
    flex: 1,
  } as ViewStyle,
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  } as ViewStyle,
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  } as ViewStyle,
  titleContainer: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
  } as ViewStyle,
  title: {
    ...Typography.headline,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 28,
    fontWeight: '700',
  } as TextStyle,
  subtitle: {
    ...Typography.paragraph,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontSize: 16,
  } as TextStyle,
  pinSection: {
    alignItems: 'center',
    marginVertical: 40,
  } as ViewStyle,
  pinDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  } as ViewStyle,
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  } as ViewStyle,
  pinDotFilled: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderColor: 'rgba(255, 255, 255, 0.9)',
  } as ViewStyle,
  pinDotError: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  } as ViewStyle,
  errorText: {
    ...Typography.paragraph,
    color: '#FF6B6B',
    textAlign: 'center',
    fontSize: 14,
    marginTop: 10,
  } as TextStyle,
  keypadSection: {
    alignItems: 'center',
    paddingBottom: 40,
  } as ViewStyle,
  keypadContainer: {
    alignItems: 'center',
  } as ViewStyle,
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  } as ViewStyle,
  keypadButton: {
    width: 80,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
  } as ViewStyle,
  keypadButtonText: {
    ...Typography.buttonText,
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 32,
  } as TextStyle,
});
