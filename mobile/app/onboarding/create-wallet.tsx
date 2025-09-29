import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, Animated, FlatList, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { ThemedText } from '@/components/ThemedText';
import { Typography } from '@/constants/Typography';
import { useSequentialSpringAnimation } from '@/hooks/useCustomTransitions';
import { Colors, gradients } from '@shared/constants/Colors';

type CreateWalletScreenParams = {
  mnemonic: string;
};

const WordDisplay: React.FC<{
  targetWord: string;
  index: number;
}> = ({ targetWord, index }) => {
  return (
    <View style={styles.wordContainer}>
      <View style={styles.wordNumber}>
        <ThemedText style={styles.wordNumberText}>{index + 1}</ThemedText>
      </View>
      <View style={styles.centerContainerStyle}>
        <ThemedText style={styles.wordText}>{targetWord}</ThemedText>
      </View>
    </View>
  );
};

export default function CreateWalletScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<CreateWalletScreenParams>();
  const [recoveryPhrase, setRecoveryPhrase] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [shouldAnimateButtons, setShouldAnimateButtons] = useState<boolean>(false);
  const verifyButtonAnimation = useSequentialSpringAnimation(shouldAnimateButtons ? 300 : 0);

  usePreventScreenCapture();

  useEffect(() => {
    if (!isLoading && !error && recoveryPhrase) {
      const timer = setTimeout(() => {
        setShouldAnimateButtons(true);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [isLoading, error, recoveryPhrase]);

  useEffect(() => {
    const mnemonic = params.mnemonic;
    if (mnemonic) {
      setRecoveryPhrase(mnemonic);
    } else {
      setError('No recovery phrase provided');
    }
    setIsLoading(false);
  }, [params.mnemonic]);

  const handleContinue = () => {
    router.push('/onboarding/create-password');
  };

  const handleVerify = () => {
    router.push('/onboarding/verify-recovery-phrase');
  };
  const wordsData = useMemo(() => {
    const words = recoveryPhrase ? recoveryPhrase.split(' ') : [];
    return Array.from({ length: 12 }, (_, index) => ({
      id: index,
      targetWord: words[index] || '',
    }));
  }, [recoveryPhrase]);

  const renderWordItem = ({ item }: { item: { id: number; targetWord: string } }) => <WordDisplay targetWord={item.targetWord} index={item.id} />;

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradients.blueGradient} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.contentContainer}>
            <View style={styles.titleContainer}>
              <ThemedText type="title" style={styles.title}>
                {`This is your \nrecovery phrase`}
              </ThemedText>
              <ThemedText style={styles.subtitle}>Make sure to write it down as shown here.{'\n'}You have to verify this later.</ThemedText>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <ThemedText style={styles.errorText}>Error: {error}</ThemedText>
              </View>
            ) : (
              <FlatList
                data={wordsData}
                renderItem={renderWordItem}
                numColumns={2}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.wordsContentContainer}
                showsVerticalScrollIndicator={false}
                columnWrapperStyle={styles.flatListRow}
              />
            )}

            <View style={styles.bottomButtonContainer}>
              {!error && recoveryPhrase && (
                <Animated.View style={verifyButtonAnimation}>
                  <TouchableOpacity style={styles.skipButton} onPress={handleContinue} testID="SkipButton">
                    <ThemedText style={styles.buttonText}>Skip</ThemedText>
                  </TouchableOpacity>
                </Animated.View>
              )}

              {!error && recoveryPhrase && (
                <Animated.View style={verifyButtonAnimation}>
                  <TouchableOpacity style={styles.verifyButton} onPress={handleVerify} testID="VerifyButton">
                    <ThemedText style={styles.buttonText}>Verify</ThemedText>
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
  },
  titleContainer: {
    alignItems: 'center',
    marginVertical: 30,
  },
  title: {
    ...Typography.headline,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    ...Typography.paragraph,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  wordsContentContainer: {
    paddingBottom: 20,
  },
  flatListRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  centerContainerStyle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  image: {
    alignSelf: 'center',
    marginRight: 8,
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
  wordNumberText: {
    ...Typography.buttonText,
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '600',
  },
  wordText: {
    ...Typography.paragraph,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    flex: 1,
  },
  actionButtonsContainer: {
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  actionButtonText: {
    ...Typography.buttonText,
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 12,
  },
  bottomButtonContainer: {
    marginBottom: 20,
    gap: 12,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.buttonBorder,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.buttonPrimary,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  errorText: {
    ...Typography.paragraph,
    color: '#FF6B6B',
    textAlign: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
});
