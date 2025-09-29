import GradientScreen from '@/components/GradientScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useContext, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View, Switch } from 'react-native';

import ScreenHeader from '@/components/navigation/ScreenHeader';
import { ThemedText } from '@/components/ThemedText';
import { LayerzStorage } from '@/src/class/layerz-storage';
import { SecureStorage } from '@/src/class/secure-storage';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { useAuthState, isMaestroMode } from '@/src/hooks/AuthStateContext';
import { useBiometrics } from '@/hooks/useBiometrics';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { EStep, InitializationContext } from '@shared/hooks/InitializationContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { SETTINGS_CONFIG } from '@shared/hooks/SettingsContext';
import { useSettings } from '@shared/hooks/useSettings';
import { capitalizeFirstLetter } from '@shared/modules/string-utils';
import { STORAGE_KEY_BTC_XPUB, STORAGE_KEY_MNEMONIC } from '@shared/types/IStorage';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { AskMnemonicContext } from '@/src/hooks/AskMnemonicContext';

const gitCommitHash = require('../git_commit_hash.json');

type TSettingsKey = keyof typeof SETTINGS_CONFIG;

export default function SettingsScreen() {
  const { askMnemonic } = useContext(AskMnemonicContext);
  const router = useRouter();
  const { accountNumber, setAccountNumber } = useContext(AccountNumberContext);
  const { scanQr } = useContext(ScanQrContext);
  const { setStep } = useContext(InitializationContext);
  const { settings, updateSetting } = useSettings();
  const [isClearing, setIsClearing] = useState(false);
  const { network } = useContext(NetworkContext);
  const [btcXpub, setBtcXpub] = useState('');
  const biometricInfo = useBiometrics();
  const { enableBiometricAuth, disableBiometricAuth, isUpdatingBiometric, lockApp } = useAuthState();

  useEffect(() => {
    (async () => {
      const xpub = await LayerzStorage.getItem(STORAGE_KEY_BTC_XPUB + accountNumber);
      setBtcXpub(xpub);
    })();
  }, [accountNumber]);

  // loading if master seed is encrypted
  useEffect(() => {
    (async () => {
      const encrypted = await BackgroundExecutor.hasEncryptedMnemonic();
      await updateSetting('seedEncrypted', encrypted ? 'ON' : 'OFF');
    })();
    // it will go to endless loop if we include updateSetting
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            await BackgroundExecutor.clear();
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

  const handleSettingChange = async (key: TSettingsKey, value: (typeof SETTINGS_CONFIG)[TSettingsKey]['options'][number]) => {
    try {
      // Special handling for biometric authentication
      if (key === 'biometricAuth') {
        if (value === 'ON') {
          await enableBiometricAuth();
        } else {
          await disableBiometricAuth();
        }
        return;
      }

      if (key === 'seedEncrypted') {
        const hasEncryptedMnemonic = await BackgroundExecutor.hasEncryptedMnemonic();
        if (value === 'ON') {
          if (hasEncryptedMnemonic) {
            // nop
            return;
          }
          router.push('/onboarding/create-password');
        } else {
          if (!hasEncryptedMnemonic) {
            // nop
            return;
          }
          const mnemonic = await askMnemonic();
          setTimeout(async () => {
            // let it execute in the back, its heavy a operation
            await BackgroundExecutor.saveMnemonic(mnemonic);
          }, 100);
          await updateSetting(key, value);
        }
        return;
      }

      // Default handling for all other settings
      await updateSetting(key, value);
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

  const handleCopyXpub = async () => {
    if (btcXpub) {
      await Clipboard.setStringAsync(btcXpub);
      Alert.alert('Copied', 'Bitcoin XPUB copied to clipboard');
    }
  };

  return (
    <GradientScreen variant={network}>
      <ScreenHeader title="Settings" testID="SettingsScreenTitle" />

      <ScrollView style={styles.scrollContainer}>
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Data Management</ThemedText>

          <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleNavigateToSeedBackup}>
            <ThemedText style={styles.primaryButtonText}>Backup Seed Phrase</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.dangerButton, isClearing && styles.buttonDisabled]} onPress={handleClearStorage} disabled={isClearing}>
            <ThemedText style={styles.dangerButtonText}>{isClearing ? 'Clearing...' : 'Clear All App Data'}</ThemedText>
          </TouchableOpacity>

          <ThemedText style={styles.warningText}>Warning: This will erase all app data including your wallet. You will need to restore your wallet using your seed phrase.</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Pocket Number</ThemedText>
          <ThemedText style={styles.accountText}>Current Pocket: {accountNumber}</ThemedText>

          <View style={styles.accountSelectorContainer}>
            {[0, 1, 2, 3, 4].map((num) => (
              <TouchableOpacity key={num} style={[styles.accountButton, accountNumber === num && styles.accountButtonActive]} onPress={() => handleAccountChange(num)}>
                <ThemedText style={[styles.accountButtonText, accountNumber === num && styles.accountButtonTextActive]}>{num}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Bitcoin XPUB</ThemedText>
          <TouchableOpacity style={styles.settingOptionButton} onPress={handleCopyXpub} disabled={!btcXpub} testID="XpubCopyButton">
            <ThemedText style={styles.settingOptionText} selectable testID="XpubText">
              {btcXpub || 'Not available'}
            </ThemedText>
          </TouchableOpacity>
          {!!btcXpub && <ThemedText style={styles.warningText}>Tap to copy</ThemedText>}
        </View>

        {/* App Settings Section */}
        <View style={styles.section} testID="AppSettingsSection">
          <ThemedText style={styles.sectionTitle} testID="AppSettingsTitle">
            App Settings
          </ThemedText>
          {(Object.keys(SETTINGS_CONFIG) as TSettingsKey[])
            .filter((key) => {
              // Filter out biometric setting if not available (unless in test mode)
              if (key === 'biometricAuth' && !biometricInfo.isAvailable && !isMaestroMode()) {
                return false;
              }
              return true;
            })
            .map((key) => {
              const config = SETTINGS_CONFIG[key as keyof typeof SETTINGS_CONFIG];
              const currentValue = settings[key as keyof typeof SETTINGS_CONFIG];

              if (key === 'biometricAuth') {
                const isDisabled = isUpdatingBiometric;
                const isEnabled = currentValue === 'ON';

                return (
                  <View key={key} style={styles.settingContainer} testID={`SettingContainer-${key}`}>
                    <ThemedText style={styles.settingLabel} testID={`SettingLabel-${key}`}>
                      {formatSettingName(key)}:
                    </ThemedText>
                    <Switch testID={`SettingSwitch-${key}`} value={isEnabled} onValueChange={(value) => handleSettingChange(key, value ? 'ON' : 'OFF')} disabled={isDisabled} />
                  </View>
                );
              }

              // Default handling for other settings - render as buttons
              return (
                <View key={key} style={styles.settingContainer} testID={`SettingContainer-${key}`}>
                  <ThemedText style={styles.settingLabel} testID={`SettingLabel-${key}`}>
                    {formatSettingName(key)}:
                  </ThemedText>
                  <View style={styles.settingOptionsContainer} testID={`SettingOptionsContainer-${key}`}>
                    {config.options.map((option) => {
                      return (
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
                      );
                    })}
                  </View>
                </View>
              );
            })}
        </View>

        <View style={styles.section}>
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
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Security</ThemedText>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={() => {
              Alert.alert('Lock App', 'Are you sure you want to lock the app?', [
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
                {
                  text: 'Lock',
                  onPress: () => lockApp(),
                },
              ]);
            }}
            testID="LockAppButton"
          >
            <ThemedText style={styles.primaryButtonText}>Lock App</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={handleClearStorage} disabled={isClearing} testID="ClearStorageButton">
            <ThemedText style={styles.dangerButtonText}>{isClearing ? 'Clearing...' : 'Clear Storage'}</ThemedText>
          </TouchableOpacity>
        </View>

        <ThemedText style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.8)' }}>
          {Application.applicationName} v{Application.nativeApplicationVersion} (build {Application.nativeBuildVersion})
        </ThemedText>
        {gitCommitHash && (
          <TouchableOpacity style={[styles.button, styles.changelogButton]} onPress={() => router.push('/Changelog')}>
            <ThemedText style={styles.changelogButtonText}>Changelog</ThemedText>
          </TouchableOpacity>
        )}
      </ScrollView>
    </GradientScreen>
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
    paddingLeft: 16,
    paddingRight: 16,
  },
  section: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  sectionTitle: {
    color: 'rgba(255, 255, 255, 0.8)',
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
    color: 'rgba(255, 255, 255, 0.8)',
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
    color: 'rgba(255, 255, 255, 0.8)',
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
  settingOptionButtonDisabled: {
    opacity: 0.5,
  },
  settingOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  settingOptionTextActive: {
    color: 'white',
  },
  settingOptionTextDisabled: {
    opacity: 0.5,
  },
  changelogButton: {
    backgroundColor: '#8A2BE2',
    marginTop: 8,
    marginHorizontal: 16,
  },
  changelogButtonText: {
    color: 'white',
    fontWeight: '700',
  },
});
