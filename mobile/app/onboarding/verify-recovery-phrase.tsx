import { useRouter } from 'expo-router';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, StyleSheet, Animated, FlatList, TouchableOpacity, LayoutAnimation, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { ThemedText } from '@/components/ThemedText';
import { Colors, gradients } from '@shared/constants/Colors';
import { Typography } from '@/constants/Typography';
import { useSequentialSpringAnimation } from '@/hooks/useCustomTransitions';
import { BackgroundExecutor } from '@/src/modules/background-executor';

// Constants
const TOTAL_WORDS = 12;
const ERROR_TIMEOUT_MS = 2000;
const BUTTON_ANIMATION_DELAY_MS = 300;
const OPACITY_ANIMATION_DURATION_MS = 200;
const DISABLED_OPACITY = 0.5;
const ENABLED_OPACITY = 1;

interface WordItem {
  id: number;
  word: string;
  isSelected: boolean;
  selectedOrder?: number;
}

const SelectableWordDisplay: React.FC<{
  wordItem: WordItem;
  onPress: (wordItem: WordItem) => void;
  isCorrect?: boolean;
  showError?: boolean;
  buttonOpacity: Animated.Value;
}> = React.memo(({ wordItem, onPress, isCorrect, showError, buttonOpacity }) => {
  const wordStyle = useMemo(() => {
    if (!wordItem.isSelected) return styles.wordContainer;

    if (isCorrect) return [styles.wordContainer, styles.correctWordContainer];
    if (showError) return [styles.wordContainer, styles.errorWordContainer];
    return [styles.wordContainer, styles.selectedWordContainer];
  }, [wordItem.isSelected, isCorrect, showError]);

  const numberStyle = useMemo(() => {
    if (!wordItem.isSelected) return styles.wordNumber;

    if (isCorrect) return [styles.wordNumber, styles.correctWordNumber];
    if (showError) return [styles.wordNumber, styles.errorWordNumber];
    return [styles.wordNumber, styles.selectedWordNumber];
  }, [wordItem.isSelected, isCorrect, showError]);

  const animatedViewStyle = useMemo(
    () => ({
      opacity: !wordItem.isSelected ? buttonOpacity : ENABLED_OPACITY,
      flex: 1,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
    }),
    [wordItem.isSelected, buttonOpacity]
  );

  const handlePress = useCallback(() => onPress(wordItem), [onPress, wordItem]);

  return (
    <TouchableOpacity style={wordStyle} onPress={handlePress} disabled={wordItem.isSelected || showError}>
      <Animated.View style={animatedViewStyle}>
        <View style={numberStyle}>
          <ThemedText style={styles.wordNumberText}>{wordItem.isSelected && wordItem.selectedOrder !== undefined ? wordItem.selectedOrder + 1 : ''}</ThemedText>
        </View>
        <View style={styles.wordTextContainer}>
          <ThemedText style={styles.wordText}>{wordItem.word}</ThemedText>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

SelectableWordDisplay.displayName = 'SelectableWordDisplay';

export default function VerifyRecoveryPhrase() {
  const router = useRouter();
  const [recoveryPhrase, setRecoveryPhrase] = useState<string>('');
  const [scrambledWords, setScrambledWords] = useState<WordItem[]>([]);
  const [selectedWords, setSelectedWords] = useState<WordItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [showError, setShowError] = useState<boolean>(false);
  const [shouldAnimateButtons, setShouldAnimateButtons] = useState<boolean>(false);
  const [verificationComplete, setVerificationComplete] = useState<boolean>(false);
  const verifyButtonAnimation = useSequentialSpringAnimation(shouldAnimateButtons ? BUTTON_ANIMATION_DELAY_MS : 0);
  const buttonOpacity = useRef(new Animated.Value(ENABLED_OPACITY)).current;

  const shuffleArray = useCallback(<T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, []);

  useEffect(() => {
    if (recoveryPhrase) {
      const words = recoveryPhrase.split(' ');
      const wordsWithData: WordItem[] = words.map((word, index) => ({
        id: index,
        word,
        isSelected: false,
      }));

      // Shuffle the words
      const shuffled = shuffleArray(wordsWithData);
      setScrambledWords(shuffled);
    }
  }, [recoveryPhrase, shuffleArray]);

  useEffect(() => {
    if (!isLoading && !error && recoveryPhrase) {
      const timer = setTimeout(() => {
        setShouldAnimateButtons(true);
      }, BUTTON_ANIMATION_DELAY_MS);

      return () => clearTimeout(timer);
    }
  }, [isLoading, error, recoveryPhrase]);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
  }, [showError, verificationComplete, selectedWords.length]);

  useEffect(() => {
    Animated.timing(buttonOpacity, {
      toValue: showError ? DISABLED_OPACITY : ENABLED_OPACITY,
      duration: OPACITY_ANIMATION_DURATION_MS,
      useNativeDriver: true,
    }).start();
  }, [showError, buttonOpacity]);

  useEffect(() => {
    const loadMnemonic = async () => {
      try {
        const storedMnemonic = await BackgroundExecutor.getMnemonicForVerification();
        if (storedMnemonic) {
          setRecoveryPhrase(storedMnemonic);
        } else {
          setError('Unable to load recovery phrase for verification. Please try again.');
        }
      } catch (err) {
        console.error('Error loading mnemonic:', err);
        setError('Failed to load recovery phrase');
      } finally {
        setIsLoading(false);
      }
    };

    loadMnemonic();
  }, []);

  const handleWordPress = useCallback(
    (wordItem: WordItem) => {
      if (wordItem.isSelected || verificationComplete || showError) return;

      const expectedWordIndex = selectedWords.length;
      const correctWord = recoveryPhrase.split(' ')[expectedWordIndex];

      if (wordItem.word === correctWord) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const updatedScrambledWords = scrambledWords.map((item) => (item.id === wordItem.id ? { ...item, isSelected: true, selectedOrder: expectedWordIndex } : item));

        setScrambledWords(updatedScrambledWords);
        setSelectedWords([...selectedWords, { ...wordItem, selectedOrder: expectedWordIndex }]);
        setShowError(false);

        if (expectedWordIndex === TOTAL_WORDS - 1) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setVerificationComplete(true);
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setShowError(true);

        // Hide error message after a timeout
        setTimeout(() => {
          setShowError(false);
        }, ERROR_TIMEOUT_MS);
      }
    },
    [verificationComplete, showError, selectedWords, recoveryPhrase, scrambledWords]
  );

  const handleContinue = useCallback(() => {
    if (verificationComplete) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.push('/onboarding/create-password');
    }
  }, [verificationComplete, router]);

  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/onboarding/create-password');
  }, [router]);

  const renderWordItem = useCallback(
    ({ item }: { item: WordItem }) => {
      const isCorrect = item.isSelected && item.word === recoveryPhrase.split(' ')[item.selectedOrder || 0];

      return <SelectableWordDisplay wordItem={item} onPress={handleWordPress} isCorrect={isCorrect} showError={showError && !item.isSelected} buttonOpacity={buttonOpacity} />;
    },
    [handleWordPress, showError, buttonOpacity, recoveryPhrase]
  );

  if (verificationComplete) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={gradients.blueGradient} style={styles.gradient}>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.content}>
              <View style={styles.successContainer}>
                <View style={styles.successIconContainer}>
                  <Image source={require('@/assets/images/ui/success.png')} style={styles.successIcon} />
                </View>
                <ThemedText type="title" style={styles.successTitle}>
                  Your backup is complete
                </ThemedText>
                <ThemedText style={styles.successSubtitle}>You should now have your recovery phrase written down for future reference.</ThemedText>
              </View>
            </View>

            <Animated.View style={[styles.buttonSection, verifyButtonAnimation]}>
              <TouchableOpacity style={styles.successButton} onPress={handleContinue} testID="ContinueButton">
                <ThemedText type="button" darkColor={Colors.dark.buttonText}>
                  Continue
                </ThemedText>
              </TouchableOpacity>
            </Animated.View>
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradients.blueGradient} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.content}>
            <View style={styles.titleContainer}>
              <ThemedText type="title" style={styles.title}>
                Tap the words in the correct order
              </ThemedText>
            </View>

            <View style={styles.scrollableContent}>
              {error ? (
                <View style={styles.errorContainer}>
                  <ThemedText style={styles.errorText}>Error: {error}</ThemedText>
                </View>
              ) : (
                <>
                  <FlatList
                    data={scrambledWords}
                    renderItem={renderWordItem}
                    numColumns={2}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.wordsContentContainer}
                    showsVerticalScrollIndicator={false}
                    columnWrapperStyle={styles.flatListRow}
                  />
                  {showError && (
                    <View style={styles.errorMessageContainer}>
                      <ThemedText style={styles.errorMessage}>✗ Sorry, that's not the correct order. Give it another try.</ThemedText>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>

          <Animated.View style={[styles.buttonSection, verifyButtonAnimation]}>
            <Animated.View style={{ opacity: buttonOpacity }}>
              <TouchableOpacity style={styles.skipButton} onPress={handleSkip} disabled={showError} testID="SkipButton">
                <ThemedText style={[styles.buttonText, showError && styles.disabledButtonText]}>Skip Verify</ThemedText>
              </TouchableOpacity>
            </Animated.View>
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
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
  },
  scrollableContent: {
    flex: 1,
  },

  titleContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  errorMessageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  wordsContentContainer: {
    paddingBottom: 20,
  },
  flatListRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },

  wordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    width: '48%',
    minHeight: 50,
  },
  selectedWordContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  correctWordContainer: {
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  errorWordContainer: {
    backgroundColor: 'rgba(244, 67, 54, 0.3)',
    borderWidth: 2,
    borderColor: '#F44336',
  },

  wordNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  selectedWordNumber: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  correctWordNumber: {
    backgroundColor: '#4CAF50',
  },
  errorWordNumber: {
    backgroundColor: '#F44336',
  },
  wordTextContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bottomButtonContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.buttonPrimary,
    borderRadius: 16,
    height: 56,
    marginHorizontal: 16,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  disabledButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },

  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  successIconContainer: {
    marginBottom: 30,
  },
  successButton: {
    backgroundColor: Colors.dark.buttonPrimary,
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
  },
  buttonSection: {
    paddingBottom: 20,
    gap: 12,
  },

  // Text styles
  title: {
    fontFamily: Typography.headline.fontFamily,
    fontSize: Typography.headline.fontSize,
    fontWeight: '300',
    lineHeight: Typography.headline.lineHeight,
    letterSpacing: Typography.headline.letterSpacing,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontFamily: Typography.paragraph.fontFamily,
    fontSize: Typography.paragraph.fontSize,
    fontWeight: '400',
    lineHeight: Typography.paragraph.lineHeight,
    letterSpacing: Typography.paragraph.letterSpacing,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 40,
  },
  errorMessage: {
    fontFamily: Typography.paragraph.fontFamily,
    fontSize: Typography.paragraph.fontSize,
    fontWeight: '400',
    lineHeight: Typography.paragraph.lineHeight,
    letterSpacing: Typography.paragraph.letterSpacing,
    color: '#FF6B6B',
    textAlign: 'center',
    marginTop: 8,
  },
  wordNumberText: {
    fontFamily: Typography.buttonText.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  wordText: {
    fontFamily: Typography.paragraph.fontFamily,
    fontSize: Typography.paragraph.fontSize,
    fontWeight: '500',
    lineHeight: Typography.paragraph.lineHeight,
    letterSpacing: Typography.paragraph.letterSpacing,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  disabledButtonText: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  errorText: {
    fontFamily: Typography.paragraph.fontFamily,
    fontSize: Typography.paragraph.fontSize,
    fontWeight: '400',
    lineHeight: Typography.paragraph.lineHeight,
    letterSpacing: Typography.paragraph.letterSpacing,
    color: '#FF6B6B',
    textAlign: 'center',
  },
  successTitle: {
    fontFamily: Typography.headline.fontFamily,
    fontSize: Typography.headline.fontSize,
    fontWeight: '300',
    lineHeight: Typography.headline.lineHeight,
    letterSpacing: Typography.headline.letterSpacing,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    marginBottom: 16,
  },
  successSubtitle: {
    fontFamily: Typography.paragraph.fontFamily,
    fontSize: Typography.paragraph.fontSize,
    fontWeight: '400',
    lineHeight: Typography.paragraph.lineHeight,
    letterSpacing: Typography.paragraph.letterSpacing,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 40,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },

  successIcon: {
    width: 120,
    height: 120,
  },
});
