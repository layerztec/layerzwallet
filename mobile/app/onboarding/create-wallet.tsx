import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View, ScrollView, Alert, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';

import { ThemedText } from '@/components/ThemedText';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { Colors, gradients } from '@shared/constants/Colors';
import { Typography } from '@/constants/Typography';

const DEBUG_MODE = __DEV__ && true;
const DEBUG_MNEMONIC = 'gloom police month stamp viable claim hospital heart alcohol ocean ghost';

export default function CreateWalletScreen() {
  const router = useRouter();
  const [recoveryPhrase, setRecoveryPhrase] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        setError('');

        if (DEBUG_MODE) {
          setRecoveryPhrase(DEBUG_MNEMONIC);
          setIsLoading(false);
          return;
        }

        const hasMnemonic = await BackgroundExecutor.hasMnemonic();
        console.log('hasMnemonic', hasMnemonic);
        if (!hasMnemonic) {
          const response = await BackgroundExecutor.createMnemonic();
          console.log('response', response);
          setRecoveryPhrase(response.mnemonic);
        }
      } catch (error: any) {
        console.error('Error creating wallet:', error);
        setError(`Error creating wallet: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleContinue = () => {
    router.replace('/onboarding/create-password');
  };

  const handleSaveBackup = async () => {
    try {
      if (!recoveryPhrase) {
        Alert.alert('Error', 'No recovery phrase available to save');
        return;
      }

      const backupContent = `LayerZ Wallet Recovery Phrase Backup
Generated: ${new Date().toLocaleDateString()}

IMPORTANT: Keep this recovery phrase safe and secure. Never share it with anyone.

Recovery Phrase:
        ${recoveryPhrase
          .split(' ')
          .map((word, index) => `${index + 1}. ${word}`)
          .join('\n')}

Instructions:
1. Write down these 12 words in order on paper
2. Store the paper in a secure location
3. Never store this digitally or take photos
4. Verify you have written it correctly

WARNING: Anyone with access to this recovery phrase can access your wallet and funds.
`;

      const fileUri = FileSystem.documentDirectory + 'layerz-wallet-backup.txt';
      await FileSystem.writeAsStringAsync(fileUri, backupContent);

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          dialogTitle: 'Save your LayerZ Wallet backup',
          mimeType: 'text/plain',
        });
      } else {
        Alert.alert('Success', 'Backup file saved to device');
      }
    } catch (error) {
      console.error('Error saving backup:', error);
      Alert.alert('Error', 'Failed to save backup file');
    }
  };

  const handlePrintTemplate = async () => {
    try {
      if (!recoveryPhrase) {
        Alert.alert('Error', 'No recovery phrase available to print');
        return;
      }

      const words = recoveryPhrase.split(' ');
      const printHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
            .subtitle { font-size: 14px; color: #666; }
            .words-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 30px 0; }
            .word-item { border: 1px solid #ddd; padding: 15px; border-radius: 8px; display: flex; align-items: center; }
            .word-number { 
              width: 30px; 
              height: 30px; 
              border-radius: 50%; 
              background: #f0f0f0; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              margin-right: 15px; 
              font-weight: bold; 
            }
            .word-text { font-size: 18px; }
            .instructions { margin-top: 30px; padding: 20px; background: #f9f9f9; border-radius: 8px; }
            .warning { color: #d32f2f; font-weight: bold; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">LayerZ Wallet Recovery Phrase</div>
            <div class="subtitle">Generated: ${new Date().toLocaleDateString()}</div>
          </div>
          
          <div class="words-grid">
            ${words
              .map(
                (word, index) => `
              <div class="word-item">
                <div class="word-number">${index + 1}</div>
                <div class="word-text">${word}</div>
              </div>
            `
              )
              .join('')}
          </div>
          
          <div class="instructions">
            <h3>Recovery Instructions:</h3>
            <ol>
              <li>Write down these 12 words in the exact order shown above</li>
              <li>Store this paper in a secure location (safe, safety deposit box)</li>
              <li>Never store this recovery phrase digitally or take photos</li>
              <li>Test your backup by attempting to restore your wallet</li>
            </ol>
            
            <div class="warning">
              WARNING: Anyone with access to this recovery phrase can access your wallet and funds. 
              Keep it secure and never share it with anyone.
            </div>
          </div>
        </body>
        </html>
      `;

      const isPrintAvailable = true;
      if (isPrintAvailable) {
        await Print.printAsync({
          html: printHtml,
          printerUrl: undefined,
        });
      } else {
        Alert.alert('Print Unavailable', 'Printing is not available on this device');
      }
    } catch (error) {
      console.error('Error printing template:', error);
      Alert.alert('Error', 'Failed to print backup template');
    }
  };

  const renderSeedWord = (word: string, index: number) => (
    <View key={index} style={styles.wordContainer}>
      <View style={styles.wordNumber}>
        <ThemedText style={styles.wordNumberText}>{index + 1}</ThemedText>
      </View>
      <ThemedText style={styles.wordText}>{word}</ThemedText>
    </View>
  );

  const words = recoveryPhrase ? recoveryPhrase.split(' ') : [];

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradients.blueGradient} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.contentContainer}>
            <View style={styles.titleContainer}>
              <ThemedText type="title" style={styles.title}>
                This is your{'\n'}recovery phrase
              </ThemedText>
              <ThemedText style={styles.subtitle}>Make sure to write it down as shown here.{'\n'}You have to verify this later.</ThemedText>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <ThemedText style={styles.errorText}>Error: {error}</ThemedText>
              </View>
            ) : (
              <>
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="rgba(255, 255, 255, 0.8)" />
                    <ThemedText style={styles.loadingText}>Creating your wallet...</ThemedText>
                  </View>
                ) : (
                  <ScrollView style={styles.wordsContainer} contentContainerStyle={styles.wordsContentContainer} showsVerticalScrollIndicator={false}>
                    <View style={styles.wordsGrid}>{words.map((word, index) => renderSeedWord(word, index))}</View>
                  </ScrollView>
                )}
              </>
            )}

            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity style={styles.actionButton} onPress={handleSaveBackup}>
                <Ionicons name="download" size={20} color="rgba(255, 255, 255, 0.8)" />
                <ThemedText style={styles.actionButtonText}>Save your Backup Kit</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton} onPress={handlePrintTemplate}>
                <Ionicons name="print" size={20} color="rgba(255, 255, 255, 0.8)" />
                <ThemedText style={styles.actionButtonText}>Print template</ThemedText>
              </TouchableOpacity>
            </View>

            <View style={styles.bottomButtonContainer}>
              {!isLoading && !error && recoveryPhrase && (
                <TouchableOpacity style={styles.verifyButton} disabled>
                  <Ionicons name="arrow-forward" size={20} color={Colors.dark.buttonText} />
                  <ThemedText style={styles.verifyButtonText}>Verify</ThemedText>
                </TouchableOpacity>
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
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  } as ViewStyle,
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
  } as ViewStyle,
  titleContainer: {
    alignItems: 'center',
    marginBottom: 30,
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
  wordsContainer: {
    flex: 1,
    marginBottom: 20,
  } as ViewStyle,
  wordsContentContainer: {
    paddingBottom: 20,
  } as ViewStyle,
  wordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
    opacity: 0.5,
    paddingVertical: 18,
    paddingHorizontal: 20,
  } as ViewStyle,
  verifyButtonText: {
    ...Typography.buttonText,
    color: Colors.dark.buttonText,
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  } as TextStyle,
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  } as ViewStyle,
  loadingText: {
    ...Typography.paragraph,
    marginTop: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
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
});
