import React, { useContext, useState } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, Alert, View, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { Ionicons } from '@expo/vector-icons';
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

export default function SettingsScreen() {
  const router = useRouter();
  const { accountNumber, setAccountNumber } = useContext(AccountNumberContext);
  const { scanQr } = useContext(ScanQrContext);
  const { setStep } = useContext(InitializationContext);
  const { settings, updateSetting } = useSettings();
  const {
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
    try {
      if (enabled) {
        // Check if authentication is available first
        await checkSecurityAvailability();

        if (!isAuthenticationAvailable) {
          Alert.alert(
            'Authentication Unavailable',
            'Your device does not have biometric authentication or device passcode set up. Please set up Face ID, Touch ID, fingerprint, or a device passcode in your device settings first.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Go to Settings',
                onPress: () => Linking.openSettings(),
              },
            ]
          );
          return;
        }

        const success = await enableSecurity();
        if (!success) {
          Alert.alert('Security Setup Failed', 'Failed to enable security. Please make sure your device authentication is working properly.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Go to Settings',
              onPress: () => Linking.openSettings(),
            },
            { text: 'Try Again', onPress: () => handleSecurityToggle(true) },
          ]);
        }
      } else {
        Alert.alert('Disable Security?', 'This will disable app security and allow access without authentication. Are you sure?', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async () => {
              await disableSecurity();
            },
          },
        ]);
      }
    } catch (error) {
      console.error('Error toggling security:', error);
      Alert.alert('Error', 'Failed to update security settings. Please check your device authentication settings and try again.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Go to Settings',
          onPress: () => Linking.openSettings(),
        },
        { text: 'Try Again', onPress: () => handleSecurityToggle(enabled) },
      ]);
    }
  };

  const handleLockOnBackgroundToggle = async (enabled: boolean) => {
    try {
      if (enabled) {
        await setLockOnBackground(true);
      } else {
        Alert.alert('Disable Background Lock?', 'This will allow the app to remain unlocked when returning from background. Are you sure?', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async () => {
              await setLockOnBackground(false);
            },
          },
        ]);
      }
    } catch (error) {
      console.error('Error toggling lock on background:', error);
      Alert.alert('Error', 'Failed to update background lock setting. Please try again.', [{ text: 'OK' }]);
    }
  };

  const getSecurityStatusText = () => {
    if (hasSecurityMismatch) {
      return 'Security mismatch detected';
    }
    if (!isAuthenticationAvailable) {
      return 'Device authentication not available';
    }
    if (isSecurityEnabled) {
      return `Protected with ${biometricType || 'device authentication'}`;
    }
    return 'Security disabled';
  };

  const getSecurityStatusColor = () => {
    if (hasSecurityMismatch) {
      return '#ff6b6b'; // Red for mismatch
    }
    if (isSecurityEnabled && isAuthenticationAvailable) {
      return '#4CAF50'; // Green for enabled and working
    }
    if (!isAuthenticationAvailable) {
      return '#FFA726'; // Orange for unavailable
    }
    return '#9E9E9E'; // Gray for disabled
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
            <ThemedText style={styles.sectionTitle}>Security</ThemedText>

            <View style={styles.securityContainer}>
              <View style={styles.securityHeader}>
                <View style={styles.securityTitleContainer}>
                  <Ionicons name={isSecurityEnabled && isAuthenticationAvailable ? 'shield-checkmark' : 'shield-outline'} size={24} color={getSecurityStatusColor()} style={styles.securityIcon} />
                  <View style={styles.securityTextContainer}>
                    <ThemedText style={styles.securityTitle}>App Lock</ThemedText>
                    <ThemedText style={[styles.securityStatus, { color: getSecurityStatusColor() }]}>{getSecurityStatusText()}</ThemedText>
                  </View>
                </View>
                <Switch
                  value={isSecurityEnabled}
                  onValueChange={handleSecurityToggle}
                  disabled={hasSecurityMismatch}
                  trackColor={{ false: '#767577', true: '#4CAF50' }}
                  thumbColor={isSecurityEnabled ? '#ffffff' : '#f4f3f4'}
                />
              </View>

              {hasSecurityMismatch && (
                <TouchableOpacity
                  style={styles.securityMismatchButton}
                  onPress={() => {
                    Alert.alert('Security Settings Issue', `Your device's ${biometricType || 'authentication'} settings have changed. Please check your device settings and try again.`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Go to Settings',
                        onPress: () => Linking.openSettings(),
                      },
                      {
                        text: 'Check Again',
                        onPress: async () => {
                          await checkSecurityAvailability();
                        },
                      },
                    ]);
                  }}
                >
                  <Ionicons name="warning" size={16} color="#ff6b6b" style={styles.warningIcon} />
                  <ThemedText style={styles.securityMismatchText}>Tap to resolve security issue</ThemedText>
                </TouchableOpacity>
              )}

              {isSecurityEnabled && (
                <View style={styles.subSettingContainer}>
                  <View style={styles.subSettingHeader}>
                    <View style={styles.subSettingTextContainer}>
                      <ThemedText style={styles.subSettingTitle}>Lock on Background</ThemedText>
                      <ThemedText style={styles.subSettingDescription}>Automatically lock the app when it goes to background</ThemedText>
                    </View>
                    <Switch
                      value={lockOnBackground}
                      onValueChange={handleLockOnBackgroundToggle}
                      trackColor={{ false: '#767577', true: '#4CAF50' }}
                      thumbColor={lockOnBackground ? '#ffffff' : '#f4f3f4'}
                    />
                  </View>
                </View>
              )}

              <ThemedText style={styles.securityDescription}>
                {isAuthenticationAvailable
                  ? `When enabled, you'll need to use ${biometricType || 'device authentication'} to unlock the app.`
                  : 'Enable biometric authentication or device passcode in your device settings to use app lock.'}
              </ThemedText>
            </View>
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
