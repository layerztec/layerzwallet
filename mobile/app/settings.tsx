import React, { useContext, useState } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/ThemeContext';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { SecureStorage } from '@/src/class/secure-storage';
import { STORAGE_KEY_MNEMONIC } from '@shared/types/IStorage';

export default function SettingsScreen() {
  const { getColor } = useTheme();
  const router = useRouter();
  const { accountNumber, setAccountNumber } = useContext(AccountNumberContext);
  const [isClearing, setIsClearing] = useState(false);
  const { scanQr } = useContext(ScanQrContext);

  const handleGoBack = () => {
    router.back();
  };

  const handleNavigateToSelfTest = () => {
    router.push('/selftest');
  };

  const handleClearStorage = async () => {
    Alert.alert('Clear App Data', 'Are you sure you want to clear all app data? This action cannot be undone.', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          setIsClearing(true);
          try {
            await AsyncStorage.clear();
            await SecureStorage.remove(STORAGE_KEY_MNEMONIC);
            Alert.alert('Success', 'All app data has been cleared. The app will restart.', [
              {
                text: 'OK',
                onPress: () => router.replace('/onboarding/intro'),
              },
            ]);
          } catch (error) {
            Alert.alert('Error', 'Failed to clear app data.');
          } finally {
            setIsClearing(false);
          }
        },
      },
    ]);
  };

  const handleAccountChange = (num: number) => {
    setAccountNumber(num);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.header}>
          <ThemedText style={styles.title}>Settings</ThemedText>
        </ThemedView>

        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <ThemedView style={[styles.section, { borderColor: getColor('border') }]}>
            <ThemedText style={styles.sectionTitle}>Data Management</ThemedText>

            <TouchableOpacity style={[styles.button, { backgroundColor: getColor('error') }, isClearing && styles.buttonDisabled]} onPress={handleClearStorage} disabled={isClearing}>
              <ThemedText style={[styles.dangerButtonText, { color: getColor('white') }]}>{isClearing ? 'Clearing...' : 'Clear All App Data'}</ThemedText>
            </TouchableOpacity>

            <ThemedText style={[styles.warningText, { color: getColor('error') }]}>
              Warning: This will erase all app data including your wallet. You will need to restore your wallet using your seed phrase.
            </ThemedText>
          </ThemedView>

          <ThemedView style={[styles.section, { borderColor: getColor('border') }]}>
            <ThemedText style={styles.sectionTitle}>Account Number</ThemedText>
            <ThemedText style={styles.accountText}>Current Account: {accountNumber}</ThemedText>

            <View style={styles.accountSelectorContainer}>
              {[0, 1, 2, 3, 4].map((num) => (
                <TouchableOpacity
                  key={num}
                  style={[
                    styles.accountButton,
                    {
                      backgroundColor: getColor('surfaceBackground'),
                      borderColor: getColor('border'),
                    },
                    accountNumber === num && {
                      backgroundColor: getColor('primary'),
                      borderColor: getColor('primary'),
                    },
                  ]}
                  onPress={() => handleAccountChange(num)}
                >
                  <ThemedText style={[styles.accountButtonText, accountNumber === num && { color: getColor('white') }]}>{num}</ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </ThemedView>

          <ThemedView style={[styles.section, { borderColor: getColor('border') }]}>
            <ThemedText style={styles.sectionTitle}>Developer Options</ThemedText>

            <TouchableOpacity style={[styles.button, { backgroundColor: getColor('receive') }]} onPress={handleNavigateToSelfTest} testID="SelfTestButton">
              <ThemedText style={[styles.selfTestButtonText, { color: getColor('white') }]}>Self Test</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: getColor('receive') }]}
              onPress={() => {
                scanQr().then(Alert.alert);
              }}
            >
              <ThemedText style={[styles.selfTestButtonText, { color: getColor('white') }]}>ScanQr</ThemedText>
            </TouchableOpacity>
          </ThemedView>

          <TouchableOpacity style={[styles.backButton, { backgroundColor: getColor('primary') }]} onPress={handleGoBack}>
            <ThemedText style={[styles.backButtonText, { color: getColor('white') }]}>Back</ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  scrollContainer: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  button: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  dangerButtonText: {
    fontWeight: 'bold',
  },
  selfTestButtonText: {
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  warningText: {
    fontSize: 12,
    marginTop: 8,
  },
  backButton: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  backButtonText: {
    fontWeight: 'bold',
  },
  accountText: {
    fontSize: 16,
    marginBottom: 12,
  },
  accountSelectorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  accountButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  accountButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
