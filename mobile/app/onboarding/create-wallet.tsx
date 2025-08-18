import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, ViewStyle, TextStyle, ImageStyle, Animated, ActivityIndicator, FlatList, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/ThemedText';
import { Colors, gradients } from '@shared/constants/Colors';
import { Typography } from '@/constants/Typography';
import { useSequentialSpringAnimation } from '@/hooks/useCustomTransitions';

const WordDisplay: React.FC<{
  targetWord: string;
  index: number;
}> = ({ targetWord, index }) => {
  const centerContainerStyle = {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  return (
    <View style={styles.wordContainer}>
      <View style={styles.wordNumber}>
        <ThemedText style={styles.wordNumberText}>{index + 1}</ThemedText>
      </View>
      <View style={centerContainerStyle}>
        <ThemedText style={styles.wordText}>{targetWord}</ThemedText>
      </View>
    </View>
  );
};

export default function CreateWalletScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [recoveryPhrase, setRecoveryPhrase] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [shouldAnimateButtons, setShouldAnimateButtons] = useState<boolean>(false);
  const verifyButtonAnimation = useSequentialSpringAnimation(shouldAnimateButtons ? 300 : 0);

  useEffect(() => {
    if (!isLoading && !error && recoveryPhrase) {
      const timer = setTimeout(() => {
        setShouldAnimateButtons(true);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [isLoading, error, recoveryPhrase]);

  useEffect(() => {
    const mnemonic = params.mnemonic as string;
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
                  <TouchableOpacity style={styles.verifyButton} onPress={handleContinue} testID="VerifyButton">
                    <ThemedText type="button">I wrote it down!</ThemedText>
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
  image: {
    alignSelf: 'center',
    marginRight: 8,
  } as ImageStyle,
  wordNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  } as ViewStyle,
  wordNumberText: {
    ...Typography.buttonText,
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '600',
  } as TextStyle,
  wordText: {
    ...Typography.paragraph,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    flex: 1,
  } as TextStyle,
  actionButtonsContainer: {
    marginBottom: 20,
  } as ViewStyle,
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
  } as ViewStyle,
  actionButtonText: {
    ...Typography.buttonText,
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 12,
  } as TextStyle,
  bottomButtonContainer: {
    marginBottom: 20,
  } as ViewStyle,
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.buttonPrimary,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
  } as ViewStyle,
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
});
