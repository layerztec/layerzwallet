import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ViewStyle, TextStyle, Animated, FlatList, TouchableOpacity, LayoutAnimation, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/ThemedText';
import { Colors, gradients } from '@shared/constants/Colors';
import { Typography } from '@/constants/Typography';
import { useSequentialSpringAnimation } from '@/hooks/useCustomTransitions';
import { BackgroundExecutor } from '@/src/modules/background-executor';

interface WordItem {
  id: number;
  word: string;
  originalIndex: number;
  isSelected: boolean;
  selectedOrder?: number;
}

const SelectableWordDisplay: React.FC<{
  wordItem: WordItem;
  onPress: (wordItem: WordItem) => void;
  isCorrect?: boolean;
  showError?: boolean;
}> = ({ wordItem, onPress, isCorrect, showError }) => {
  const getWordStyle = () => {
    if (wordItem.isSelected) {
      if (isCorrect) {
        return [styles.wordContainer, styles.correctWordContainer];
      } else if (showError) {
        return [styles.wordContainer, styles.errorWordContainer];
      } else {
        return [styles.wordContainer, styles.selectedWordContainer];
      }
    }
    return styles.wordContainer;
  };

  const getNumberStyle = () => {
    if (wordItem.isSelected) {
      if (isCorrect) {
        return [styles.wordNumber, styles.correctWordNumber];
      } else if (showError) {
        return [styles.wordNumber, styles.errorWordNumber];
      } else {
        return [styles.wordNumber, styles.selectedWordNumber];
      }
    }
    return styles.wordNumber;
  };

  return (
    <TouchableOpacity style={getWordStyle()} onPress={() => onPress(wordItem)} disabled={wordItem.isSelected || showError}>
      <View style={getNumberStyle()}>
        <ThemedText style={styles.wordNumberText}>{wordItem.isSelected && wordItem.selectedOrder !== undefined ? wordItem.selectedOrder + 1 : ''}</ThemedText>
      </View>
      <View style={styles.wordTextContainer}>
        <ThemedText style={styles.wordText}>{wordItem.word}</ThemedText>
      </View>
    </TouchableOpacity>
  );
};

export default function VerifyRecoveryPhrase() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [recoveryPhrase, setRecoveryPhrase] = useState<string>('');
  const [scrambledWords, setScrambledWords] = useState<WordItem[]>([]);
  const [selectedWords, setSelectedWords] = useState<WordItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [showError, setShowError] = useState<boolean>(false);
  const [shouldAnimateButtons, setShouldAnimateButtons] = useState<boolean>(false);
  const [verificationComplete, setVerificationComplete] = useState<boolean>(false);
  const [isColdBoot, setIsColdBoot] = useState<boolean>(false);
  const verifyButtonAnimation = useSequentialSpringAnimation(shouldAnimateButtons ? 300 : 0);

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  useEffect(() => {
    if (recoveryPhrase) {
      const words = recoveryPhrase.split(' ');
      const wordsWithData: WordItem[] = words.map((word, index) => ({
        id: index,
        word,
        originalIndex: index,
        isSelected: false,
      }));

      // Shuffle the words
      const shuffled = shuffleArray(wordsWithData);
      setScrambledWords(shuffled);
    }
  }, [recoveryPhrase]);

  useEffect(() => {
    if (!isLoading && !error && recoveryPhrase) {
      const timer = setTimeout(() => {
        setShouldAnimateButtons(true);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [isLoading, error, recoveryPhrase]);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
  }, [showError, verificationComplete, selectedWords.length]);

  useEffect(() => {
    const loadMnemonic = async () => {
      try {
        const mnemonic = params.mnemonic as string;
        if (mnemonic) {
          setRecoveryPhrase(mnemonic);
          setIsColdBoot(false);
        } else {
          const storedMnemonic = await BackgroundExecutor.getMnemonicForVerification();
          if (storedMnemonic) {
            setRecoveryPhrase(storedMnemonic);
            setIsColdBoot(true);
          } else {
            setError('Unable to load recovery phrase for verification. Please try again.');
          }
        }
      } catch (err) {
        console.error('Error loading mnemonic:', err);
        setError('Failed to load recovery phrase');
      } finally {
        setIsLoading(false);
      }
    };

    loadMnemonic();
  }, [params.mnemonic]);

  const handleWordPress = (wordItem: WordItem) => {
    if (wordItem.isSelected || verificationComplete || showError) return;

    const expectedWordIndex = selectedWords.length;
    const correctWord = recoveryPhrase.split(' ')[expectedWordIndex];

    if (wordItem.word === correctWord) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const updatedScrambledWords = scrambledWords.map((item) => (item.id === wordItem.id ? { ...item, isSelected: true, selectedOrder: expectedWordIndex } : item));

      setScrambledWords(updatedScrambledWords);
      setSelectedWords([...selectedWords, { ...wordItem, selectedOrder: expectedWordIndex }]);
      setShowError(false);

      if (expectedWordIndex === 11) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setVerificationComplete(true);
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setShowError(true);

      // Reset UI state immediately
      const resetScrambledWords = scrambledWords.map((item) => ({ ...item, isSelected: false, selectedOrder: undefined }));
      setScrambledWords(resetScrambledWords);
      setSelectedWords([]);

      // Hide error message after a timeout
      setTimeout(() => {
        setShowError(false);
      }, 2000);
    }
  };

  const handleContinue = () => {
    if (verificationComplete) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.push('/onboarding/create-password');
    }
  };

  const handleSkip = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await BackgroundExecutor.setSeedVerified();
      router.push('/onboarding/create-password');
    } catch (err) {
      console.error('Error skipping verification:', err);
      setError('Failed to skip verification');
    }
  };

  const renderWordItem = ({ item }: { item: WordItem }) => {
    const expectedIndex = selectedWords.length;
    const correctWord = recoveryPhrase.split(' ')[expectedIndex];
    const isCorrect = item.isSelected && item.word === recoveryPhrase.split(' ')[item.selectedOrder || 0];

    return <SelectableWordDisplay wordItem={item} onPress={handleWordPress} isCorrect={isCorrect} showError={showError && !item.isSelected} />;
  };

  if (verificationComplete) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={gradients.blueGradient} style={styles.gradient}>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.successContainer}>
              <View style={styles.successIconContainer}>
                <ThemedText style={styles.successIcon}>🛡️</ThemedText>
              </View>
              <ThemedText type="title" style={styles.successTitle}>
                Your backup is complete
              </ThemedText>
              <ThemedText style={styles.successSubtitle}>You should now have your recovery phrase written down for future reference.</ThemedText>
              <Animated.View style={verifyButtonAnimation}>
                <TouchableOpacity style={styles.continueButton} onPress={handleContinue} testID="ContinueButton">
                  <ThemedText type="button">Continue</ThemedText>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradients.blueGradient} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.contentContainer}>
            <View style={styles.titleContainer}>
              <ThemedText type="title" style={styles.title}>
                Tap the words in the correct order
              </ThemedText>
            </View>

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

            <View style={styles.bottomButtonContainer}>
              {isColdBoot ? (
                <Animated.View style={verifyButtonAnimation}>
                  {verificationComplete ? (
                    <TouchableOpacity style={styles.continueButton} onPress={handleContinue} testID="ContinueButton">
                      <ThemedText type="button">Continue</ThemedText>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.skipButton} onPress={handleSkip} testID="SkipButton">
                      <ThemedText type="button">Skip Verification</ThemedText>
                    </TouchableOpacity>
                  )}
                </Animated.View>
              ) : (
                <Animated.View style={verifyButtonAnimation}>
                  <TouchableOpacity style={[styles.continueButton, !verificationComplete && styles.disabledButton]} onPress={handleContinue} disabled={!verificationComplete} testID="ContinueButton">
                    <ThemedText type="button" style={!verificationComplete && styles.disabledButtonText}>
                      Continue
                    </ThemedText>
                  </TouchableOpacity>
                </Animated.View>
              )}
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
  } as ViewStyle,
  titleContainer: {
    alignItems: 'center',
    marginVertical: 30,
  } as ViewStyle,
  title: {
    ...Typography.headline,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    marginBottom: 16,
  } as TextStyle,
  subtitle: {
    ...Typography.paragraph,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  } as TextStyle,
  errorMessage: {
    ...Typography.paragraph,
    color: '#FF6B6B',
    textAlign: 'center',
    marginTop: 8,
  } as TextStyle,
  errorMessageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  } as ViewStyle,
  wordsContentContainer: {
    paddingBottom: 20,
  } as ViewStyle,
  flatListRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  } as ViewStyle,
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
  } as ViewStyle,
  selectedWordContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  } as ViewStyle,
  correctWordContainer: {
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
    borderWidth: 2,
    borderColor: '#4CAF50',
  } as ViewStyle,
  errorWordContainer: {
    backgroundColor: 'rgba(244, 67, 54, 0.3)',
    borderWidth: 2,
    borderColor: '#F44336',
  } as ViewStyle,
  wordNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  } as ViewStyle,
  selectedWordNumber: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  } as ViewStyle,
  correctWordNumber: {
    backgroundColor: '#4CAF50',
  } as ViewStyle,
  errorWordNumber: {
    backgroundColor: '#F44336',
  } as ViewStyle,
  wordNumberText: {
    ...Typography.buttonText,
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '600',
  } as TextStyle,
  wordTextContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  wordText: {
    ...Typography.paragraph,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    flex: 1,
  } as TextStyle,
  bottomButtonContainer: {
    marginBottom: 20,
  } as ViewStyle,
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
  } as ViewStyle,
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.buttonPrimary,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
  } as ViewStyle,
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
  } as ViewStyle,
  disabledButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  } as ViewStyle,
  disabledButtonText: {
    color: 'rgba(255, 255, 255, 0.5)',
  } as TextStyle,
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  } as ViewStyle,
  errorText: {
    ...Typography.paragraph,
    color: '#FF6B6B',
    textAlign: 'center',
  } as TextStyle,
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  } as ViewStyle,
  successIconContainer: {
    marginBottom: 30,
  } as ViewStyle,
  successIcon: {
    fontSize: 60,
    textAlign: 'center',
  } as TextStyle,
  successTitle: {
    ...Typography.headline,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    marginBottom: 16,
  } as TextStyle,
  successSubtitle: {
    ...Typography.paragraph,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 40,
  } as TextStyle,
});
