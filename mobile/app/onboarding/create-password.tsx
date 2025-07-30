import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, Alert, View, Animated, Easing, Platform, TextInput, useWindowDimensions } from 'react-native';
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
const ANIMATION_DURATION = {
  FADE: 800,
  SLIDE: 600,
  BUTTON_PRESS: 100,
  PIN_DOT_SCALE: 200,
  PIN_DOT_RESTORE: 300,
  SHAKE_SEGMENT: 60,
};

const ANIMATION_CONFIG = {
  SCALE_AMOUNT: 1.2,
  BUTTON_SCALE: 0.9,
  ENTRANCE_DURATION: 500,
  ENTRANCE_DELAY: 100,
};

const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', 'delete'],
] as const;

const getScaledValue = (baseValue: number, screenHeight: number) => {
  const baseHeight = 812;
  const scale = Math.max(0.8, Math.min(1.2, screenHeight / baseHeight));
  return Math.round(baseValue * scale);
};

const getLayoutValues = (width: number, height: number) => ({
  titleFontSize: getScaledValue(28, height),
  subtitleFontSize: getScaledValue(16, height),
  pinDotSize: getScaledValue(16, height),
  explanationFontSize: getScaledValue(14, height),
  errorFontSize: getScaledValue(14, height),
  keypadButtonSize: Math.min(Math.max(65, getScaledValue(80, height)), width * 0.22),
  keypadButtonFontSize: getScaledValue(26, height),
  deleteIconSize: getScaledValue(24, height),
});

export default function CreatePasswordScreen() {
  const { width, height } = useWindowDimensions();
  const layout = useMemo(() => getLayoutValues(width, height), [width, height]);
  const styles = useMemo(() => createStyles(layout), [layout]);

  const [pin, setPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isErrorAnimating, setIsErrorAnimating] = useState<boolean>(false);
  const router = useRouter();

  const hiddenTextInputRef = useRef<TextInput>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const errorFadeAnim = useRef(new Animated.Value(0)).current;
  const explanationFadeAnim = useRef(new Animated.Value(1)).current;
  const createPinDotScale = () => new Animated.Value(1);

  const pinDotScales = useRef(Array(PIN_LENGTH).fill(0).map(createPinDotScale)).current;

  const createKeypadButtonScale = (acc: Record<string, Animated.Value>, key: string) => {
    acc[key] = new Animated.Value(1);
    return acc;
  };

  const keypadButtonScales = useRef(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'delete'].reduce(createKeypadButtonScale, {} as Record<string, Animated.Value>)).current;

  useEffect(() => {
    Animated.stagger(ANIMATION_CONFIG.ENTRANCE_DELAY, [
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: ANIMATION_DURATION.FADE,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: ANIMATION_DURATION.SLIDE,
        easing: Easing.out(Easing.back(1.1)),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: ANIMATION_CONFIG.ENTRANCE_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim, slideAnim]);

  const animatePinDot = useCallback(
    (index: number) => {
      Animated.sequence([
        Animated.timing(pinDotScales[index], {
          toValue: ANIMATION_CONFIG.SCALE_AMOUNT,
          duration: ANIMATION_DURATION.PIN_DOT_SCALE,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pinDotScales[index], {
          toValue: 1,
          duration: ANIMATION_DURATION.PIN_DOT_RESTORE,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    },
    [pinDotScales]
  );

  const animateKeypadPress = useCallback(
    (buttonKey: string) => {
      const buttonScale = keypadButtonScales[buttonKey];
      if (!buttonScale) return;

      Animated.sequence([
        Animated.timing(buttonScale, {
          toValue: ANIMATION_CONFIG.BUTTON_SCALE,
          duration: ANIMATION_DURATION.BUTTON_PRESS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(buttonScale, {
          toValue: 1,
          duration: ANIMATION_DURATION.BUTTON_PRESS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    },
    [keypadButtonScales]
  );

  const shakeError = useCallback(() => {
    // Add haptic feedback at the start of shake
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

    const shakeSequence = [
      { toValue: 12, duration: ANIMATION_DURATION.SHAKE_SEGMENT },
      { toValue: -12, duration: ANIMATION_DURATION.SHAKE_SEGMENT },
      { toValue: 10, duration: ANIMATION_DURATION.SHAKE_SEGMENT },
      { toValue: -10, duration: ANIMATION_DURATION.SHAKE_SEGMENT },
      { toValue: 6, duration: ANIMATION_DURATION.SHAKE_SEGMENT },
      { toValue: -6, duration: ANIMATION_DURATION.SHAKE_SEGMENT },
      { toValue: 3, duration: ANIMATION_DURATION.SHAKE_SEGMENT },
      { toValue: -3, duration: ANIMATION_DURATION.SHAKE_SEGMENT },
      { toValue: 0, duration: ANIMATION_DURATION.SHAKE_SEGMENT },
    ];

    const createShakeAnimation = (shake: { toValue: number; duration: number }) =>
      Animated.timing(shakeAnimation, {
        toValue: shake.toValue,
        duration: shake.duration,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      });

    Animated.sequence(shakeSequence.map(createShakeAnimation)).start();
  }, [shakeAnimation]);

  const resetPinWithAnimation = useCallback(() => {
    const createScaleDownAnimation = (scale: Animated.Value) =>
      Animated.timing(scale, {
        toValue: 0,
        duration: 150,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      });

    const createScaleUpAnimation = (scale: Animated.Value) =>
      Animated.timing(scale, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });

    const onScaleDownComplete = () => {
      // Fade out error message first
      Animated.timing(errorFadeAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setConfirmPin('');
        setIsConfirming(false);
        setPin('');
        setIsErrorAnimating(false);

        // Restore explanation text fade
        explanationFadeAnim.setValue(1);

        Animated.parallel(pinDotScales.map(createScaleUpAnimation)).start();
      });
    };

    Animated.parallel(pinDotScales.map(createScaleDownAnimation)).start(onScaleDownComplete);
  }, [pinDotScales, errorFadeAnim, explanationFadeAnim]);

  const validatePins = useCallback(
    async (originalPin: string, confirmedPin: string) => {
      if (originalPin !== confirmedPin) {
        setIsErrorAnimating(true);

        // Crossfade: fade out explanation and fade in error message
        Animated.parallel([
          Animated.timing(explanationFadeAnim, {
            toValue: 0,
            duration: 200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(errorFadeAnim, {
            toValue: 1,
            duration: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();

        shakeError();

        const resetWithDelay = () => resetPinWithAnimation();
        setTimeout(resetWithDelay, 2500);
        return;
      }

      setIsLoading(true);
      try {
        const result = await BackgroundExecutor.encryptMnemonic(originalPin);

        if (!result.success) {
          throw new Error(result.message || 'Failed to encrypt wallet');
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    },
    [router, resetPinWithAnimation, shakeError, errorFadeAnim, explanationFadeAnim]
  );

  const handlePinInput = useCallback(
    (digit: string, shouldAnimate: boolean = true) => {
      if (isLoading || isErrorAnimating) return;

      const currentPin = isConfirming ? confirmPin : pin;
      if (currentPin.length < PIN_LENGTH) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (shouldAnimate) {
          animateKeypadPress(digit);
        }

        const newPin = currentPin + digit;
        animatePinDot(currentPin.length);

        if (isConfirming) {
          setConfirmPin(newPin);
          if (newPin.length === PIN_LENGTH) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const validateWithDelay = () => validatePins(pin, newPin);
            setTimeout(validateWithDelay, 200);
          }
        } else {
          setPin(newPin);
          if (newPin.length === PIN_LENGTH) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const setConfirmingWithDelay = () => {
              setIsConfirming(true);
              // Reset error fade animation
              errorFadeAnim.setValue(0);
            };
            setTimeout(setConfirmingWithDelay, 200);
          }
        }
      }
    },
    [isLoading, isErrorAnimating, isConfirming, confirmPin, pin, animateKeypadPress, animatePinDot, validatePins, errorFadeAnim]
  );

  const handleDelete = useCallback(
    (shouldAnimate: boolean = true) => {
      if (isLoading || isErrorAnimating) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (shouldAnimate) {
        animateKeypadPress('delete');
      }

      if (isConfirming) {
        if (confirmPin.length > 0) {
          setConfirmPin(confirmPin.slice(0, -1));
        }
      } else {
        setPin(pin.slice(0, -1));
      }
    },
    [isLoading, isErrorAnimating, isConfirming, confirmPin, pin, animateKeypadPress]
  );

  useEffect(() => {
    const focusHiddenInput = () => {
      if (hiddenTextInputRef.current) {
        hiddenTextInputRef.current.focus();
      }
    };

    const timer = setTimeout(focusHiddenInput, 500);
    return () => clearTimeout(timer);
  }, []);

  // Maintain focus on the hidden input to capture hardware keyboard
  useEffect(() => {
    const maintainFocus = () => {
      if (hiddenTextInputRef.current && !isLoading) {
        // Check if the input is focused, if not, focus it
        const input = hiddenTextInputRef.current;
        if (input && !input.isFocused()) {
          input.focus();
        }
      }
    };

    const intervalId = setInterval(maintainFocus, 2000);

    return () => clearInterval(intervalId);
  }, [isLoading]);

  const handleTextInputChange = useCallback((text: string) => {
    // Clear the input immediately to prevent text accumulation
    if (hiddenTextInputRef.current) {
      hiddenTextInputRef.current.clear();
    }
  }, []);

  const handleKeyPress = useCallback(
    (event: any) => {
      const { nativeEvent } = event;

      if (/^[0-9]$/.test(nativeEvent.key)) {
        const digit = nativeEvent.key;
        handlePinInput(digit, true);
      }

      if (nativeEvent.key === 'Backspace') {
        handleDelete(true);
      }

      event.preventDefault?.();
    },
    [handlePinInput, handleDelete]
  );

  const renderPinDots = useMemo(() => {
    const currentPin = isConfirming ? confirmPin : pin;

    const renderPinDot = (_: unknown, index: number) => (
      <Animated.View
        key={index}
        style={[
          styles.pinDot,
          currentPin.length > index && styles.pinDotFilled,
          {
            transform: [{ scale: pinDotScales[index] }],
          },
        ]}
      />
    );

    return (
      <Animated.View
        style={[
          styles.pinDotsContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateX: shakeAnimation }, { scale: scaleAnim }],
          },
        ]}
        testID="pin-dots-container"
      >
        {Array.from({ length: PIN_LENGTH }).map(renderPinDot)}
      </Animated.View>
    );
  }, [isConfirming, confirmPin, pin, fadeAnim, shakeAnimation, scaleAnim, pinDotScales, styles.pinDot, styles.pinDotFilled, styles.pinDotsContainer]);

  const renderKeypadButton = useCallback(
    (digit: string) => {
      const handleDigitPress = () => handlePinInput(digit);
      const isDisabled = isLoading || isErrorAnimating;

      return (
        <Animated.View
          key={digit}
          style={{
            transform: [{ scale: keypadButtonScales[digit] || 1 }],
          }}
        >
          <TouchableOpacity
            style={[styles.keypadButton, isDisabled && styles.keypadButtonDisabled]}
            onPress={handleDigitPress}
            disabled={isDisabled}
            testID={`keypad-button-${digit}`}
            accessibilityLabel={`PIN digit ${digit}`}
            accessibilityRole="button"
          >
            <ThemedText style={styles.keypadButtonText}>{digit}</ThemedText>
          </TouchableOpacity>
        </Animated.View>
      );
    },
    [keypadButtonScales, styles.keypadButton, styles.keypadButtonDisabled, styles.keypadButtonText, handlePinInput, isLoading, isErrorAnimating]
  );

  const renderKeypad = useMemo(() => {
    const renderKeypadRow = (row: readonly string[], rowIndex: number) => (
      <View key={rowIndex} style={styles.keypadRow}>
        {row.map(renderKeypadItem)}
      </View>
    );

    const renderKeypadItem = (item: string) => {
      if (item === '') {
        return <View key="empty" style={styles.keypadButton} />;
      }
      if (item === 'delete') {
        const currentPin = isConfirming ? confirmPin : pin;
        const isDeleteDisabled = isLoading || isErrorAnimating || currentPin.length === 0;
        const handleDeletePress = () => handleDelete();

        return (
          <Animated.View
            key="delete"
            style={{
              transform: [{ scale: keypadButtonScales['delete'] || 1 }],
            }}
          >
            <TouchableOpacity
              style={[styles.keypadButton, isDeleteDisabled && styles.keypadButtonDisabled]}
              onPress={handleDeletePress}
              disabled={isDeleteDisabled}
              testID="keypad-button-delete"
              accessibilityLabel="Delete PIN digit"
              accessibilityRole="button"
            >
              <Ionicons name="backspace-outline" size={layout.deleteIconSize} color={isDeleteDisabled ? Colors.dark.white30 : Colors.dark.white90} />
            </TouchableOpacity>
          </Animated.View>
        );
      }
      return renderKeypadButton(item);
    };

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
        {KEYPAD_ROWS.map(renderKeypadRow)}
      </Animated.View>
    );
  }, [styles, fadeAnim, slideAnim, isConfirming, confirmPin, pin, isLoading, isErrorAnimating, keypadButtonScales, handleDelete, layout.deleteIconSize, renderKeypadButton]);

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradients.blueGradient} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          <TextInput
            ref={hiddenTextInputRef}
            style={styles.hiddenTextInput}
            value=""
            onChangeText={handleTextInputChange}
            onKeyPress={handleKeyPress}
            keyboardType="default"
            returnKeyType="done"
            autoFocus={false}
            caretHidden={true}
            contextMenuHidden={true}
            autoComplete="off"
            autoCorrect={false}
            spellCheck={false}
            maxLength={0}
            selectTextOnFocus={false}
            textContentType="none"
            secureTextEntry={false}
            enterKeyHint="done"
            allowFontScaling={false}
            showSoftInputOnFocus={false}
            editable={true}
            blurOnSubmit={false}
          />

          <View style={styles.contentContainer}>
            <View style={styles.headerSection}>
              <Animated.View style={[{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <ThemedText style={styles.title} testID="pin-screen-title">
                  {isConfirming ? 'Confirm your PIN' : 'Choose a 4-digit PIN'}
                </ThemedText>
              </Animated.View>

              <Animated.View style={[{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <ThemedText style={styles.subtitle}>{isConfirming ? 'Enter your PIN again to confirm' : 'Use a PIN you will remember. It cannot be recovered.'}</ThemedText>
              </Animated.View>
            </View>

            <View style={styles.middleSection}>
              {renderPinDots}
              <Animated.View style={{ opacity: explanationFadeAnim }}>
                <ThemedText style={styles.pinExplanation}>This is used to encrypt your wallet.</ThemedText>
              </Animated.View>
            </View>

            <View style={styles.keypadSection}>
              <View style={styles.keypadSeparator} />
              <View style={styles.keypadContainer}>{renderKeypad}</View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const baseStyles = StyleSheet.create({
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
  hiddenTextInput: {
    position: 'absolute',
    top: -1000,
    left: -1000,
    width: 1,
    height: 1,
    opacity: 0,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  headerSection: {
    flex: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  middleSection: {
    flex: 0.8,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 15,
  },
  keypadSection: {
    flex: 3.5,
    justifyContent: 'flex-end',
    paddingBottom: 15,
  },
  keypadContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
  },
  keypadSeparator: {
    width: '120%',
    marginLeft: -40,
    height: 1,
    backgroundColor: Colors.dark.white30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 6,
  },
  keypadButtonDisabled: {
    opacity: 0.5,
  },
} as const);

const createStyles = (layout: ReturnType<typeof getLayoutValues>) =>
  StyleSheet.create({
    ...baseStyles,
    title: {
      ...Typography.headline,
      color: Colors.dark.buttonText,
      textAlign: 'center',
      fontWeight: '700',
      fontSize: layout.titleFontSize,
    },
    subtitle: {
      ...Typography.paragraph,
      color: Colors.dark.paragraphText,
      textAlign: 'center',
      fontWeight: '400',
      fontSize: layout.subtitleFontSize,
    },
    pinDotsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    pinDot: {
      backgroundColor: Colors.dark.white30,
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
      width: layout.pinDotSize,
      height: layout.pinDotSize,
      borderRadius: layout.pinDotSize / 2,
      marginHorizontal: 8,
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
    pinExplanation: {
      ...Typography.paragraph,
      color: Colors.dark.paragraphText,
      textAlign: 'center',
      marginHorizontal: 20,
      fontWeight: '400',
      fontSize: layout.explanationFontSize,
      marginTop: 16,
    },
    errorText: {
      ...Typography.paragraph,
      color: Colors.dark.error,
      textAlign: 'center',
      fontWeight: '400',
      fontSize: layout.errorFontSize,
      marginTop: 24,
      marginHorizontal: 20,
    },
    keypadButton: {
      alignItems: 'center',
      justifyContent: 'center',
      width: layout.keypadButtonSize,
      height: layout.keypadButtonSize,
      marginHorizontal: 12,
      borderRadius: layout.keypadButtonSize / 2,
    },
    keypadButtonText: {
      ...Typography.buttonText,
      color: Colors.dark.buttonText,
      fontWeight: '600',
      fontSize: layout.keypadButtonFontSize,
      lineHeight: layout.keypadButtonFontSize * 1.1,
      textAlign: 'center',
      includeFontPadding: false,
      textAlignVertical: 'center',
    },
  });
