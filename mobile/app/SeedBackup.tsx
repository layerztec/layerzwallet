import React, { useContext, useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View, Animated, ActivityIndicator, Image, FlatList, LayoutAnimation, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { usePreventRemove } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GradientScreen from '@/components/GradientScreen';
import { buildScreenHeaderOptions } from '@/components/navigation/ScreenHeader';
import { ThemedText } from '@/components/ThemedText';
import Button from '@/components/Button';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { useAuthState } from '@/src/hooks/AuthStateContext';
import { useAskPassword } from '@/src/hooks/AskPasswordContext';
import { useSettings } from '@shared/hooks/useSettings';
import * as LocalAuthentication from 'expo-local-authentication';

const TOTAL_WORDS = 12;
const ERROR_TIMEOUT_MS = 2000;
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
    if (!wordItem.isSelected) return styles.verifyWordContainer;

    if (isCorrect) return [styles.verifyWordContainer, styles.correctWordContainer];
    if (showError) return [styles.verifyWordContainer, styles.errorWordContainer];
    return [styles.verifyWordContainer, styles.selectedWordContainer];
  }, [wordItem.isSelected, isCorrect, showError]);

  const numberStyle = useMemo(() => {
    if (!wordItem.isSelected) return styles.verifyWordNumber;

    if (isCorrect) return [styles.verifyWordNumber, styles.correctWordNumber];
    if (showError) return [styles.verifyWordNumber, styles.errorWordNumber];
    return [styles.verifyWordNumber, styles.selectedWordNumber];
  }, [wordItem.isSelected, isCorrect, showError]);

  const animatedViewStyle = useMemo(
    () =>
      ({
        opacity: !wordItem.isSelected ? buttonOpacity : ENABLED_OPACITY,
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
      }) as const,
    [wordItem.isSelected, buttonOpacity]
  );

  const handlePress = useCallback(() => onPress(wordItem), [onPress, wordItem]);

  return (
    <TouchableOpacity style={wordStyle} onPress={handlePress} disabled={wordItem.isSelected || showError}>
      <Animated.View style={animatedViewStyle}>
        <View style={numberStyle}>
          <ThemedText style={styles.verifyWordNumberText}>{wordItem.isSelected && wordItem.selectedOrder !== undefined ? wordItem.selectedOrder + 1 : ''}</ThemedText>
        </View>
        <View style={styles.verifyWordTextContainer}>
          <ThemedText style={styles.verifyWordText}>{wordItem.word}</ThemedText>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

SelectableWordDisplay.displayName = 'SelectableWordDisplay';

export default function SeedBackupScreen() {
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const { authenticateWithBiometrics } = useAuthState();
  const { askPassword } = useAskPassword();
  const [mnemonic, setMnemonic] = useState<string>('');
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [scrambledWords, setScrambledWords] = useState<WordItem[]>([]);
  const [selectedWords, setSelectedWords] = useState<WordItem[]>([]);
  const [showError, setShowError] = useState<boolean>(false);
  const [verificationComplete, setVerificationComplete] = useState<boolean>(false);
  const [badgeTapCount, setBadgeTapCount] = useState(0);
  const buttonOpacity = useRef(new Animated.Value(ENABLED_OPACITY)).current;
  const blurOpacity = useRef(new Animated.Value(1)).current;
  usePreventScreenCapture();

  const shuffleArray = useCallback(<T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, []);

  useEffect(() => {
    if (isVerifying && mnemonic) {
      const words = mnemonic.split(' ');
      const wordsWithData: WordItem[] = words.map((word, index) => ({
        id: index,
        word,
        isSelected: false,
      }));
      const shuffled = shuffleArray(wordsWithData);
      setScrambledWords(shuffled);
    }
  }, [isVerifying, mnemonic, shuffleArray]);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
  }, [showError, verificationComplete, selectedWords.length, isVerifying]);

  useEffect(() => {
    Animated.timing(buttonOpacity, {
      toValue: showError ? DISABLED_OPACITY : ENABLED_OPACITY,
      duration: OPACITY_ANIMATION_DURATION_MS,
      useNativeDriver: true,
    }).start();
  }, [showError, buttonOpacity]);

  const handleRevealSeedPhrase = async () => {
    if (isLoading || isRevealed) return;

    try {
      setIsLoading(true);

      const isBiometricEnabled = settings.biometricAuth === 'ON';
      const isPasswordEnabled = settings.seedEncrypted === 'ON';

      let authenticated = false;

      if (isBiometricEnabled) {
        const result = await authenticateWithBiometrics();
        authenticated = result.success;

        if (!authenticated) {
          setIsLoading(false);
          return;
        }
      }

      if (!authenticated && isPasswordEnabled) {
        try {
          await askPassword();
          authenticated = true;
        } catch (error) {
          console.error('Password authentication cancelled or failed:', error);
          setIsLoading(false);
          return;
        }
      }

      if (!isBiometricEnabled && !isPasswordEnabled) {
        authenticated = true;
      }

      if (authenticated) {
        const seedPhrase = await BackgroundExecutor.getMasterSeed();
        setMnemonic(seedPhrase);
        setIsRevealed(true);

        Animated.timing(blurOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }
    } catch (error) {
      console.error('Failed to get mnemonic:', error);
      Alert.alert('Error', 'Failed to retrieve seed phrase. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewQRCode = () => {
    if (mnemonic) {
      router.push({ pathname: '/SeedBackupQR', params: { mnemonic } });
    }
  };

  const handleVerifyBackup = () => {
    if (mnemonic) {
      setIsVerifying(true);
    }
  };

  const handleWordPress = useCallback(
    (wordItem: WordItem) => {
      if (wordItem.isSelected || verificationComplete || showError) return;

      const expectedWordIndex = selectedWords.length;
      const correctWord = mnemonic.split(' ')[expectedWordIndex];

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

        setTimeout(() => {
          setShowError(false);
        }, ERROR_TIMEOUT_MS);
      }
    },
    [verificationComplete, showError, selectedWords, mnemonic, scrambledWords]
  );

  const handleBackFromVerification = useCallback(() => {
    setIsVerifying(false);
    setScrambledWords([]);
    setSelectedWords([]);
    setShowError(false);
    setVerificationComplete(false);
  }, []);

  usePreventRemove(isVerifying, () => {
    handleBackFromVerification();
  });

  const settingsContext = useSettings();
  const hasBackedUpSeed = settings.seedBackedUp === 'ON';

  const handleBadgeTap = async () => {
    const newCount = badgeTapCount + 1;
    setBadgeTapCount(newCount);

    if (newCount >= 10) {
      await settingsContext.updateSetting('seedBackedUp', hasBackedUpSeed ? 'OFF' : 'ON');
      setBadgeTapCount(0);
      Alert.alert('Debug', `Seed backup status toggled to ${hasBackedUpSeed ? 'not backed up' : 'backed up'}`);
    }
  };

  const handleContinueFromSuccess = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await settingsContext.updateSetting('seedBackedUp', 'ON');
    router.back();
  };

  const renderWordItem = useCallback(
    ({ item }: { item: WordItem }) => {
      const isCorrect = item.isSelected && item.word === mnemonic.split(' ')[item.selectedOrder || 0];
      return <SelectableWordDisplay wordItem={item} onPress={handleWordPress} isCorrect={isCorrect} showError={showError && !item.isSelected} buttonOpacity={buttonOpacity} />;
    },
    [handleWordPress, showError, buttonOpacity, mnemonic]
  );

  const mnemonicWordsData = useMemo(() => {
    if (!mnemonic) return [];
    return mnemonic.split(' ').map((word, index) => ({ word, index, id: index.toString() }));
  }, [mnemonic]);

  if (verificationComplete) {
    return (
      <GradientScreen variant={network} scroll>
        <Stack.Screen options={buildScreenHeaderOptions({ title: 'Recovery Phrase' })} />
        <View style={styles.verificationCompleteContainer}>
          <View style={styles.successIconContainer}>
            <Image source={require('@/assets/images/ui/success.png')} style={styles.successIcon} />
          </View>
          <ThemedText style={styles.successTitle}>Your backup is complete</ThemedText>
          <ThemedText style={styles.successSubtitle}>You should now have your recovery phrase written down for future reference.</ThemedText>
          <View style={styles.successButtonContainer}>
            <Button title="Done" variant="normal" onPress={handleContinueFromSuccess} style={styles.actionButton} />
          </View>
        </View>
      </GradientScreen>
    );
  }

  if (isVerifying) {
    return (
      <GradientScreen variant={network}>
        <Stack.Screen options={buildScreenHeaderOptions({ title: 'Verify Recovery Phrase' })} />
        <View style={styles.verificationHeader}>
          <ThemedText style={styles.verificationTitle}>Tap the words in the correct order</ThemedText>
          <ThemedText style={styles.verificationSubtitle}>Select each word in the same order as your recovery phrase</ThemedText>
        </View>

        <FlatList
          data={scrambledWords}
          renderItem={renderWordItem}
          keyExtractor={(item) => item.id.toString()}
          numColumns={2}
          columnWrapperStyle={styles.verificationWordRow}
          contentContainerStyle={[styles.verificationWordList, { paddingBottom: 20 + insets.bottom }]}
          scrollEnabled={true}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            showError ? (
              <View style={styles.errorContainer}>
                <ThemedText style={styles.errorText}>Incorrect word. Please try again.</ThemedText>
              </View>
            ) : null
          }
        />
      </GradientScreen>
    );
  }

  return (
    <GradientScreen variant={network} scroll>
      <Stack.Screen options={buildScreenHeaderOptions({ title: 'Recovery Phrase' })} />
      <View style={styles.container}>
        <View style={styles.warningSection}>
          <Pressable style={styles.warningHeader} onPress={handleBadgeTap}>
            <Ionicons name="alert-circle-outline" size={28} color="rgba(255, 255, 255, 0.9)" />
            <ThemedText style={styles.warningTitle}>Warning</ThemedText>
          </Pressable>
          <ThemedText style={styles.warningText}>
            Your recovery phrase is the only way to restore your wallet if you lose access to it. <ThemedText style={styles.warningBold}>Keep it safe and never share it with anyone.</ThemedText>
          </ThemedText>
        </View>

        <View style={[styles.revealContainer, isRevealed && styles.revealContainerRevealed]}>
          {isLoading ? (
            <View style={styles.revealContent}>
              <ActivityIndicator size="large" color="rgba(255, 255, 255, 0.9)" />
            </View>
          ) : !isRevealed ? (
            <TouchableOpacity style={styles.revealContent} onPress={handleRevealSeedPhrase} activeOpacity={0.8}>
              <Ionicons name="eye-outline" size={80} color="rgba(255, 255, 255, 0.9)" />
              <ThemedText style={styles.revealText}>tap to reveal</ThemedText>
            </TouchableOpacity>
          ) : (
            <View style={styles.mnemonicDisplay}>
              {mnemonicWordsData.map((item) => (
                <View key={item.id} style={styles.wordItem}>
                  <View style={styles.wordNumber}>
                    <ThemedText style={styles.wordNumberText}>{item.index + 1}</ThemedText>
                  </View>
                  <ThemedText style={styles.wordText}>{item.word}</ThemedText>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.actionsContainer}>
          <Button title="View QR code" variant="secondary" onPress={handleViewQRCode} disabled={!mnemonic} style={styles.actionButton} />

          <Button title="Verify Backup" variant="light" onPress={handleVerifyBackup} disabled={!mnemonic} style={styles.actionButton} />
        </View>
      </View>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  warningSection: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.95)',
  },
  warningText: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  warningBold: {
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.95)',
  },
  revealContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 20, 0.6)',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    minHeight: 280,
    paddingVertical: 24,
    overflow: 'hidden',
  },
  revealContainerRevealed: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  revealContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    width: '100%',
  },
  revealText: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.95)',
    marginTop: 20,
    fontWeight: '500',
  },
  mnemonicDisplay: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  mnemonicContentContainer: {
    paddingBottom: 10,
  },
  mnemonicColumnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  wordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    width: '48%',
    gap: 12,
  },
  wordNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  wordText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.95)',
    fontWeight: '500',
    flex: 1,
  },
  actionsContainer: {
    gap: 12,
  },
  actionButton: {
    marginBottom: 0,
  },
  verificationHeader: {
    marginBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  verificationTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    marginBottom: 8,
  },
  verificationSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  verificationWordList: {
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  verificationWordRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  verifyWordContainer: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  selectedWordContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
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
  verifyWordNumber: {
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
  verifyWordTextContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyWordNumberText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  verifyWordText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  errorContainer: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: '#F44336',
  },
  errorText: {
    fontSize: 15,
    color: '#FF6B6B',
    textAlign: 'center',
  },
  verificationCompleteContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successIconContainer: {
    marginBottom: 30,
  },
  successIcon: {
    width: 120,
    height: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 60,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    marginBottom: 16,
  },
  successSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  successButtonContainer: {
    width: '100%',
    marginTop: 20,
  },
});
