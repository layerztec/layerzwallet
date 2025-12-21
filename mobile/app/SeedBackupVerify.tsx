import React, { useContext, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import Button from '@/components/Button';
import GradientScreen from '@/components/GradientScreen';
import { ThemedText } from '@/components/ThemedText';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useSettings } from '@shared/hooks/useSettings';

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

export default function SeedBackupVerifyScreen() {
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const settingsContext = useSettings();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mnemonic?: string }>();
  const mnemonic = typeof params.mnemonic === 'string' ? params.mnemonic : '';

  const mnemonicWords = useMemo(() => (mnemonic ? mnemonic.split(' ') : []), [mnemonic]);
  const shuffledWords = useMemo(() => shuffle(mnemonicWords), [mnemonic]);

  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState('');

  if (!mnemonic) {
    Alert.alert('Missing data', 'Recovery phrase not found. Please try again.', [
      {
        text: 'OK',
        onPress: () => router.back(),
      },
    ]);
    return null;
  }

  const handleSelectWord = async (word: string) => {
    if (isComplete || selectedWords.includes(word)) return;

    const nextSelection = [...selectedWords, word];
    setSelectedWords(nextSelection);

    if (nextSelection.length === mnemonicWords.length) {
      const isCorrect = nextSelection.join(' ') === mnemonic;

      if (isCorrect) {
        setIsComplete(true);
        setError('');
        await settingsContext.updateSetting('seedBackedUp', 'ON');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setError('Incorrect order. Please try again.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setTimeout(() => {
          setSelectedWords([]);
          setError('');
        }, 900);
      }
    }
  };

  const handleReset = () => {
    setSelectedWords([]);
    setIsComplete(false);
    setError('');
  };

  const handleDone = () => {
    if (isComplete) {
      router.back();
    }
  };

  return (
    <GradientScreen variant={network} scroll>
      <View
        style={[
          styles.container,
          {
            paddingTop: (insets.top || 0) + 20,
            paddingBottom: (insets.bottom || 0) + 20,
          },
        ]}
      >
        <View style={styles.header}>
          <ThemedText style={styles.title}>Verify your phrase</ThemedText>
          <ThemedText style={styles.subtitle}>Tap each word in the correct order to confirm your backup.</ThemedText>
        </View>

        <View style={styles.selectedContainer}>
          {selectedWords.length === 0 ? (
            <ThemedText style={styles.placeholder}>Your selection will appear here</ThemedText>
          ) : (
            <View style={styles.selectedWordsGrid}>
              {selectedWords.map((word, index) => (
                <View key={`${word}-${index}`} style={styles.selectedWordChip}>
                  <View style={styles.wordNumber}>
                    <ThemedText style={styles.wordNumberText}>{index + 1}</ThemedText>
                  </View>
                  <ThemedText style={styles.wordText}>{word}</ThemedText>
                </View>
              ))}
            </View>
          )}
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="warning" size={18} color="#F44336" />
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        ) : null}

        <View style={styles.wordsGrid}>
          {shuffledWords.map((word) => {
            const isPicked = selectedWords.includes(word);
            return <Button key={word} title={word} variant={isPicked ? 'secondary' : 'light'} onPress={() => handleSelectWord(word)} disabled={isPicked || isComplete} style={styles.wordButton} />;
          })}
        </View>

        <View style={styles.actions}>
          <Button title="Reset" variant="secondary" onPress={handleReset} disabled={selectedWords.length === 0 || isComplete} />
          <Button title={isComplete ? 'Done' : 'Complete the phrase'} variant="light" onPress={handleDone} disabled={!isComplete} />
        </View>
      </View>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    gap: 20,
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.95)',
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.75)',
    lineHeight: 22,
  },
  selectedContainer: {
    minHeight: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    justifyContent: 'center',
  },
  placeholder: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  selectedWordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  selectedWordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  wordNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  wordText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.95)',
  },
  wordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  wordButton: {
    width: '48%',
    marginBottom: 0,
  },
  actions: {
    gap: 10,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
    borderColor: '#F44336',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
  },
});
