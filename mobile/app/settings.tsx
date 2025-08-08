import React, { useContext, useState, useEffect, useRef } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, Alert, View, Switch, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as Linking from 'expo-linking';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useSecurityContext } from '@/hooks/useSecurityContext';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { SecureStorage } from '@/src/class/secure-storage';
import { STORAGE_KEY_MNEMONIC } from '@shared/types/IStorage';
import { EStep, InitializationContext } from '@shared/hooks/InitializationContext';
import { useSettings } from '@shared/hooks/useSettings';
import { SETTINGS_CONFIG } from '@shared/hooks/SettingsContext';
import { capitalizeFirstLetter } from '@shared/modules/string-utils';
import { unlockRoutes } from '@/utils/navigation';

export default function SettingsScreen() {
  const router = useRouter();
  const { accountNumber, setAccountNumber } = useContext(AccountNumberContext);
  const { scanQr } = useContext(ScanQrContext);
  const { setStep } = useContext(InitializationContext);
  const { settings, updateSetting } = useSettings();
  const {
    isAppLocked,
    isSecurityEnabled,
    isAuthenticationAvailable,
    biometricType,
    enableSecurity,
    disableSecurity,
    hasSecurityMismatch,
    checkSecurityAvailability,
    lockOnBackground,
    setLockOnBackground,
    unlockApp,
  } = useSecurityContext();
  const [isClearing, setIsClearing] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        checkSecurityAvailability();
      }
      appState.current = nextAppState;
    });
    return () => subscription.remove();
  }, [checkSecurityAvailability]);

  const handleClearStorage = async () => {
    Alert.alert('Clear Storage', 'Are you sure you want to clear all app data? This action cannot be undone.', [
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
            await SecureStorage.setItem(STORAGE_KEY_MNEMONIC, '');
            Alert.alert('Storage Cleared', 'All app data has been cleared successfully. The app will now restart.', [
              {
                text: 'OK',
                onPress: () => {
                  // Navigate back to the index screen which will handle redirection to onboarding
                  router.dismissAll();
                  router.replace('/');
                  setStep(EStep.INTRO);
                },
              },
            ]);
          } catch (error) {
            console.error('Error clearing storage:', error);
            Alert.alert('Error', 'Failed to clear storage. Please try again.');
          } finally {
            setIsClearing(false);
          }
        },
      },
    ]);
  };

  const handleAccountChange = (newAccountNumber: number) => {
    setAccountNumber(newAccountNumber);
  };

  const handleNavigateToSelfTest = () => {
    router.push('/selftest');
  };

  const handleNavigateToSeedBackup = () => {
    router.push('/SeedBackup');
  };

  const handleSettingChange = async (key: string, value: string) => {
    try {
      await updateSetting(key as any, value);
    } catch (error) {
      console.error('Error updating setting:', error);
    }
  };

  const formatSettingName = (key: string) => {
    return key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
  };

  const formatOptionName = (option: string) => {
    return capitalizeFirstLetter(option);
  };

  const handleSecurityToggle = async (enabled: boolean) => {
    if (enabled) {
      router.push(unlockRoutes.enableSecurity());
    } else {
      router.push(unlockRoutes.disableSecurity());
    }
  };

  const handleLockOnBackgroundToggle = async (enabled: boolean) => {
    try {
      if (enabled) {
        await setLockOnBackground(true);
      } else {
        await setLockOnBackground(false);
      }
    } catch (error) {
      console.error('Error toggling lock on background:', error);
    }
  };

  const handleSecurityPress = () => {
    // Normal press goes to real security screen
    router.push(unlockRoutes.regular());
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.header}>
          <ThemedText style={styles.title}>Settings</ThemedText>
        </ThemedView>

        <ScrollView style={styles.scrollContainer}>
          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Data Management</ThemedText>

            <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleNavigateToSeedBackup}>
              <ThemedText style={styles.primaryButtonText}>Backup Seed Phrase</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.button, styles.dangerButton, isClearing && styles.buttonDisabled]} onPress={handleClearStorage} disabled={isClearing}>
              <ThemedText style={styles.dangerButtonText}>{isClearing ? 'Clearing...' : 'Clear All App Data'}</ThemedText>
            </TouchableOpacity>

            <ThemedText style={styles.warningText}>Warning: This will erase all app data including your wallet. You will need to restore your wallet using your seed phrase.</ThemedText>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Pocket Number</ThemedText>
            <ThemedText style={styles.accountText}>Current Pocket: {accountNumber}</ThemedText>

            <View style={styles.accountSelectorContainer}>
              {[0, 1, 2, 3, 4].map((num) => (
                <TouchableOpacity key={num} style={[styles.accountButton, accountNumber === num && styles.accountButtonActive]} onPress={() => handleAccountChange(num)}>
                  <ThemedText style={[styles.accountButtonText, accountNumber === num && styles.accountButtonTextActive]}>{num}</ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </ThemedView>

          {/* Security Section */}
          <ThemedView style={styles.section}>
            <TouchableOpacity onPress={handleSecurityPress} onLongPress={() => router.push('/BackdoorSecurity' as any)} testID="BackdoorSecurity">
              <ThemedText style={styles.sectionTitle}>Security</ThemedText>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <ThemedText style={styles.settingLabel}>App Lock</ThemedText>
              <Switch value={isSecurityEnabled} onValueChange={handleSecurityToggle} disabled={hasSecurityMismatch} />
            </View>
            {hasSecurityMismatch && <ThemedText style={[styles.warningText, { marginBottom: 12 }]}>Security settings have changed. Please check your device authentication.</ThemedText>}
            {isSecurityEnabled && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <ThemedText style={styles.settingLabel}>Lock on Background</ThemedText>
                <Switch value={lockOnBackground} onValueChange={handleLockOnBackgroundToggle} />
              </View>
            )}
          </ThemedView>

          {/* App Settings Section */}
          <ThemedView style={styles.section} testID="AppSettingsSection">
            <ThemedText style={styles.sectionTitle} testID="AppSettingsTitle">
              App Settings
            </ThemedText>
            {Object.keys(SETTINGS_CONFIG).map((key) => {
              const config = SETTINGS_CONFIG[key as keyof typeof SETTINGS_CONFIG];
              const currentValue = settings[key as keyof typeof SETTINGS_CONFIG];

              return (
                <View key={key} style={styles.settingContainer} testID={`SettingContainer-${key}`}>
                  <ThemedText style={styles.settingLabel} testID={`SettingLabel-${key}`}>
                    {formatSettingName(key)}:
                  </ThemedText>
                  <View style={styles.settingOptionsContainer} testID={`SettingOptionsContainer-${key}`}>
                    {config.options.map((option: string) => (
                      <TouchableOpacity
                        key={option}
                        style={[styles.settingOptionButton, currentValue === option && styles.settingOptionButtonActive]}
                        onPress={() => handleSettingChange(key, option)}
                        testID={`SettingOption-${key}-${option}`}
                      >
                        <ThemedText style={[styles.settingOptionText, currentValue === option && styles.settingOptionTextActive]} testID={`SettingOptionText-${key}-${option}`}>
                          {formatOptionName(option)}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })}
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Developer Options</ThemedText>

            <TouchableOpacity style={[styles.button, styles.selfTestButton]} onPress={handleNavigateToSelfTest} testID="SelfTestButton">
              <ThemedText style={styles.selfTestButtonText}>Self Test</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.selfTestButton]}
              onPress={() => {
                scanQr().then(Alert.alert);
              }}
            >
              <ThemedText style={styles.selfTestButtonText}>ScanQr</ThemedText>
            </TouchableOpacity>
          </ThemedView>

          <ThemedText style={{ textAlign: 'center' }}>
            {Application.applicationName} v{Application.nativeApplicationVersion} (build {Application.nativeBuildVersion})
          </ThemedText>
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
    fontWeight: '700',
  },
  scrollContainer: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  button: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: '700',
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
  },
  dangerButtonText: {
    color: 'white',
    fontWeight: '700',
  },
  selfTestButton: {
    backgroundColor: '#34C759',
  },
  selfTestButtonText: {
    color: 'white',
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  warningText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 8,
  },
  backButton: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    marginTop: 16,
  },
  backButtonText: {
    color: 'white',
    fontWeight: '700',
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
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  accountButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  accountButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  accountButtonTextActive: {
    color: 'white',
  },
  settingContainer: {
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  settingOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  settingOptionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  settingOptionButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  settingOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  settingOptionTextActive: {
    color: 'white',
  },
  securityContainer: {
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    marginTop: 8,
  },
  securityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  securityTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  securityIcon: {
    marginRight: 12,
  },
  securityTextContainer: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  securityStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  securityMismatchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 8,
    marginBottom: 12,
  },
  warningIcon: {
    marginRight: 8,
  },
  securityMismatchText: {
    fontSize: 14,
    color: '#ff6b6b',
    fontWeight: '500',
  },
  subSettingContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  subSettingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subSettingTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  subSettingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  subSettingDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  securityDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});
