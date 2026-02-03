import { Alert, PressableStateCallbackType, ScrollView, SectionList, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Bugsnag from '@bugsnag/expo';
import { SafeAreaView } from 'react-native-safe-area-context';
import Pressable from '../components/Pressable';

import { ThemedText } from '@/components/ThemedText';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import { EvmWallet } from '@shared/class/evm-wallet';
import { HDSegwitBech32Wallet } from '@shared/class/wallets/hd-segwit-bech32-wallet';
import { decrypt, encrypt } from '../src/modules/encryption';
import assert from 'assert';
import { useContext, useEffect, useState } from 'react';

import { Csprng } from '@/src/class/rng';
import * as BlueElectrum from '@shared/blue_modules/BlueElectrum';
import { SparkWallet } from '@shared/class/wallets/spark-wallet';
import SettingsRow from '@/components/SettingsRow';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { LayerzStorage } from '@/src/class/layerz-storage';
import { STORAGE_KEY_BTC_XPUB, STORAGE_KEY_MNEMONIC } from '@shared/types/IStorage';
import { getDeviceIdentifier } from '@/src/utils/device-id';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { SETTINGS_CONFIG } from '@shared/hooks/SettingsContext';
import { useSettings } from '@shared/hooks/useSettings';
import { capitalizeFirstLetter } from '@shared/modules/string-utils';
import { useAuthState } from '@/src/hooks/AuthStateContext';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { SecureStorage } from '@/src/class/secure-storage';
import { EStep, InitializationContext } from '@shared/hooks/InitializationContext';
import { useRouter } from 'expo-router';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { applogFilePath, disableLoggingToFile, enableLoggingToFile, isLoggingToFileEnabled } from '@/src/modules/error-handler';
import { globalDarkBackground } from '@shared/constants/Colors';

type TSettingsKey = keyof typeof SETTINGS_CONFIG;

export default function TabThreeScreen() {
  const router = useRouter();
  const { setStep } = useContext(InitializationContext);
  const { accountNumber, setAccountNumber } = useContext(AccountNumberContext);
  const { scanQr } = useContext(ScanQrContext);
  const { settings, updateSetting } = useSettings();
  const { lockApp, disableBiometricAuth } = useAuthState();
  const { network } = useContext(NetworkContext);
  const [testState, setTestState] = useState<'not_started' | 'running' | 'ok' | 'error'>('not_started');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isClearing, setIsClearing] = useState(false);
  const [btcXpub, setBtcXpub] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [isLogFileEnabled, setIsLogFileEnabled] = useState(isLoggingToFileEnabled());
  const [isLogPreviewVisible, setIsLogPreviewVisible] = useState(false);
  const [logPreview, setLogPreview] = useState('');

  useEffect(() => {
    (async () => {
      const xpub = await LayerzStorage.getItem(STORAGE_KEY_BTC_XPUB + accountNumber);
      setBtcXpub(xpub);

      // Load device identifier
      try {
        const id = await getDeviceIdentifier();
        setDeviceId(id);
      } catch (error) {
        console.debug('Device identifier not available:', error);
        setDeviceId('');
      }
    })();
  }, [accountNumber]);

  const handleSelfTest = async () => {
    try {
      setTestState('running');
      await new Promise((resolve) => setTimeout(resolve, 200)); // propagate

      // testing spark:
      const w = new SparkWallet();
      w.setSecret('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
      await w.init(LayerzStorage);
      assert(
        (await w.getOffchainReceiveAddress()) === 'spark1pgss9qfk8ygtphqqzkj2yhn43k3s7r3g8z822ffvpcm38ym094800574x5numh',
        'unexpected spark wallet getOffchainReceiveAddress(): ' + (await w.getOffchainReceiveAddress())
      );

      // testing evm:
      const xpub = EvmWallet.mnemonicToXpub('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
      assert.strictEqual(xpub, 'xpub6EF8jXqFeFEW5bwMU7RpQtHkzE4KJxcqJtvkCjJumzW8CPpacXkb92ek4WzLQXjL93HycJwTPUAcuNxCqFPKKU5m5Z2Vq4nCyh5CyPeBFFr');
      assert.strictEqual(EvmWallet.xpubToAddress(xpub, 0), '0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
      assert.strictEqual(EvmWallet.xpubToAddress(xpub, 1), '0x6Fac4D18c912343BF86fa7049364Dd4E424Ab9C0');

      // testing btc:
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const hd = new HDSegwitBech32Wallet();
      hd.setSecret(mnemonic);
      assert.strictEqual(true, hd.validateMnemonic());
      assert.strictEqual('zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs', hd.getXpub());
      assert.strictEqual(hd._getExternalWIFByIndex(0), 'KyZpNDKnfs94vbrwhJneDi77V6jF64PWPF8x5cdJb8ifgg2DUc9d');
      assert.strictEqual(hd._getExternalWIFByIndex(1), 'Kxpf5b8p3qX56DKEe5NqWbNUP9MnqoRFzZwHRtsFqhzuvUJsYZCy');
      assert.strictEqual(hd._getInternalWIFByIndex(0), 'KxuoxufJL5csa1Wieb2kp29VNdn92Us8CoaUG3aGtPtcF3AzeXvF');
      assert.strictEqual(hd._getExternalAddressByIndex(0), 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu');
      assert.strictEqual(hd._getExternalAddressByIndex(1), 'bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g');
      assert.strictEqual(hd._getInternalAddressByIndex(0), 'bc1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el');

      // testing buffer (the most problematic dep):
      const buffer = Buffer.from('ffff', 'hex');
      assert.strictEqual(buffer.toString('hex'), 'ffff');

      // testing encryption:
      const data2encrypt = 'really long data string bla bla really long data string bla bla really long data string bla bla';
      const start = Date.now();
      const crypted = await encrypt(Csprng, data2encrypt, 'password', '53B63311-D2D5-4C62-9F7F-28F25447B825');
      const end = Date.now();
      console.log(`encryption took ${end - start}ms`);
      const decrypted = await decrypt(crypted, 'password', '53B63311-D2D5-4C62-9F7F-28F25447B825');
      assert(decrypted === data2encrypt, 'decryption failed');

      // testing electrum:
      if (!BlueElectrum.mainConnected) {
        await BlueElectrum.connectMain();
      }
      const balance = await BlueElectrum.getBalanceByAddress('3GCvDBAktgQQtsbN6x5DYiQCMmgZ9Yk8BK');
      assert.strictEqual(balance.confirmed, 51432, 'Incorrect balance from electrum');

      setTestState('ok');
    } catch (error: any) {
      setErrorMessage(error.message);
      setTestState('error');
    }
  };

  const handleAccountChange = (newAccountNumber: number) => {
    setAccountNumber(newAccountNumber);
  };

  const handleCopyXpub = async () => {
    if (btcXpub) {
      await Clipboard.setStringAsync(btcXpub);
      Alert.alert('Copied', 'Bitcoin XPUB copied to clipboard');
    }
  };

  const handleSettingChange = async (key: TSettingsKey, value: (typeof SETTINGS_CONFIG)[TSettingsKey]['options'][number]) => {
    try {
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

  const handleScanQr = () => {
    scanQr().then((result) => {
      Alert.alert('QR Code', result);
    });
  };

  const handleDeviceIdPress = async () => {
    if (deviceId) {
      try {
        console.debug('Sending test error to Bugsnag with device ID:', deviceId);

        // Trigger a test error to Bugsnag with the device ID
        Bugsnag.notify(new Error(`Test error from device: ${deviceId}`), (event: any) => {
          event.addMetadata('test', {
            deviceId: deviceId,
            timestamp: new Date().toISOString(),
            testType: 'manual_trigger',
          });
        });

        console.debug('Bugsnag notification sent successfully');

        // Copy to clipboard
        await Clipboard.setStringAsync(deviceId);

        Alert.alert('Test Error Sent', `ID: ${deviceId}\n\nTest error sent and ID copied to clipboard!`);
      } catch (error) {
        console.error('Error sending to Bugsnag:', error);
        Alert.alert('Error', `Failed to send test error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };

  const handleLockApp = () => {
    Alert.alert('Lock App', 'Are you sure you want to lock the app?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Lock',
        onPress: () => lockApp(),
      },
    ]);
  };

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
            await updateSetting('biometricAuth', 'OFF');
            await updateSetting('seedBackedUp', 'OFF');
            await BackgroundExecutor.clear();
            await AsyncStorage.clear();
            await SecureStorage.setItem(STORAGE_KEY_MNEMONIC, '');
            Alert.alert('Storage Cleared', 'All app data has been cleared successfully. The app will now restart.', [
              {
                text: 'OK',
                onPress: () => {
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

  const handleLogSettingChange = async (option: 'enabled' | 'disabled') => {
    try {
      if (option === 'enabled') {
        await enableLoggingToFile();
        setIsLogFileEnabled(true);
      } else {
        await disableLoggingToFile();
        setIsLogFileEnabled(false);
      }
    } catch (error) {
      console.error('Error updating log file setting:', error);
      Alert.alert('Error', 'Failed to update log file setting.');
    }
  };

  const handleShareLogFile = async () => {
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(applogFilePath, {
          mimeType: 'text/plain',
          dialogTitle: 'Share Layerz Wallet Logs',
        });
        return;
      }
      Alert.alert('Error', 'Sharing is not available on this device.');
    } catch (error: any) {
      console.error('Error sharing log file:', error);
      Alert.alert('Error', 'Failed to share log file:' + error.message);
    }
  };

  const handleToggleLogPreview = async () => {
    if (isLogPreviewVisible) {
      setLogPreview('');
      setIsLogPreviewVisible(false);
      return;
    }

    try {
      const logFile = new File(applogFilePath);
      if (!logFile.exists) {
        Alert.alert('Log File Missing', 'The log file was not found. Try enabling logging again.');
        return;
      }

      const handle = logFile.open();
      try {
        const decoder = new TextDecoder();
        const maxLines = 100;
        const chunkSize = 64 * 1024;
        let offset = handle.size ?? 0;
        let buffer = '';

        while (offset > 0) {
          const readSize = Math.min(chunkSize, offset);
          offset -= readSize;
          handle.offset = offset;
          const chunk = decoder.decode(handle.readBytes(readSize));
          buffer = chunk + buffer;

          const lineCount = buffer.split('\n').length - 1;
          if (lineCount >= maxLines || offset === 0) {
            const lines = buffer.replace(/\n$/, '').split('\n');
            const lastLines = lines
              .slice(-maxLines)
              .map((line) => line.split(' ').slice(7).join(' '))
              .join('\n');
            setLogPreview(lastLines || '(log file is empty)');
            break;
          }
        }
      } finally {
        handle.close();
      }
      setIsLogPreviewVisible(true);
    } catch (error: any) {
      console.error('Error loading log preview:', error);
      Alert.alert('Error', 'Failed to load log preview: ' + error.message);
    }
  };

  const backgroundColor = globalDarkBackground;

  const sections = [
    {
      title: 'Self Test',
      key: 'selfTest',
      data: ['selfTest'],
    },
    {
      title: 'Pocket Number',
      key: 'pocketNumber',
      data: ['pocketNumber'],
    },
    {
      title: 'Bitcoin XPUB',
      key: 'bitcoinXpub',
      data: ['bitcoinXpub'],
    },
    {
      title: 'App Settings',
      key: 'appSettings',
      data: ['appSettings'],
    },
    {
      title: 'Developer Options',
      key: 'developerOptions',
      data: ['developerOptions'],
    },
    {
      title: 'Security Actions',
      key: 'securityActions',
      data: ['securityActions'],
    },
  ];

  const renderSectionHeader = ({ section }: { section: { title: string } }) => <ThemedText style={styles.sectionHeader}>{section.title}</ThemedText>;

  const renderItem = ({ item, section }: { item: string; section: { key: string } }) => {
    switch (section.key) {
      case 'selfTest':
        return (
          <View style={styles.settingsGroup}>
            <Pressable style={[styles.testButton, testState === 'running' && styles.testButtonDisabled]} onPress={handleSelfTest} disabled={testState === 'running'} testID="RunSelfTestButton">
              <ThemedText style={styles.testButtonText}>{testState === 'running' ? 'Running...' : 'Run Self Test'}</ThemedText>
            </Pressable>
            {testState === 'ok' && (
              <View style={styles.testResult}>
                <ThemedText style={styles.testResultSuccess} testID="SelfTestSuccess">
                  ✓ Test Passed
                </ThemedText>
              </View>
            )}
            {testState === 'error' && (
              <View style={styles.testResult}>
                <ThemedText style={styles.testResultError}>✗ Test Failed</ThemedText>
                <ThemedText style={styles.testResultErrorMessage}>{errorMessage}</ThemedText>
              </View>
            )}
          </View>
        );

      case 'pocketNumber':
        return (
          <View style={styles.settingsGroup}>
            <View style={styles.pocketSection}>
              <ThemedText style={styles.accountText}>Current Pocket: {accountNumber}</ThemedText>
              <View style={styles.accountButtonContainer}>
                {[0, 1, 2, 3, 4].map((num) => (
                  <Pressable key={num} style={[styles.accountButton, accountNumber === num && styles.accountButtonActive]} onPress={() => handleAccountChange(num)}>
                    <ThemedText style={[styles.accountButtonText, accountNumber === num && styles.accountButtonTextActive]}>{num}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        );

      case 'bitcoinXpub':
        return (
          <View style={styles.settingsGroup}>
            <Pressable style={styles.xpubContainer} onPress={handleCopyXpub} disabled={!btcXpub} testID="XpubCopyButton">
              <ThemedText style={styles.xpubText} selectable testID="XpubText" numberOfLines={2}>
                {btcXpub || 'Not available'}
              </ThemedText>
            </Pressable>
            {!!btcXpub && <ThemedText style={styles.xpubHint}>Tap to copy</ThemedText>}
          </View>
        );

      case 'appSettings':
        return (
          <View style={styles.settingsGroup}>
            {(Object.keys(SETTINGS_CONFIG) as TSettingsKey[])
              .filter((key) => key !== 'biometricAuth' && key !== 'seedBackedUp')
              .map((key, index, array) => {
                const config = SETTINGS_CONFIG[key as keyof typeof SETTINGS_CONFIG];
                const currentValue = settings[key as keyof typeof SETTINGS_CONFIG];

                return (
                  <View key={key}>
                    <View style={styles.settingContainer} testID={`SettingContainer-${key}`}>
                      <ThemedText style={styles.settingLabel} testID={`SettingLabel-${key}`}>
                        {formatSettingName(key)}
                      </ThemedText>
                      <View style={styles.settingOptionsContainer} testID={`SettingOptionsContainer-${key}`}>
                        {config.options.map((option) => (
                          <Pressable
                            key={option}
                            style={[styles.settingOption, currentValue === option && styles.settingOptionActive]}
                            onPress={() => handleSettingChange(key, option)}
                            testID={`SettingOption-${key}-${option}`}
                          >
                            <ThemedText style={[styles.settingOptionText, currentValue === option && styles.settingOptionTextActive]} testID={`SettingOptionText-${key}-${option}`}>
                              {formatOptionName(option)}
                            </ThemedText>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                    {index < array.length - 1 && <View style={styles.divider} />}
                  </View>
                );
              })}
          </View>
        );

      case 'developerOptions':
        return (
          <View style={styles.settingsGroup}>
            <SettingsRow title="Scan QR Code" onPress={handleScanQr} hideChevron />
            {deviceId && (
              <>
                <View style={styles.divider} />
                <Pressable style={({ pressed }: PressableStateCallbackType) => [styles.deviceIdRow, pressed && styles.deviceIdRowPressed]} onPress={handleDeviceIdPress} testID="DeviceIdButton">
                  <ThemedText style={styles.deviceIdText} numberOfLines={2}>
                    Device ID: {deviceId}
                  </ThemedText>
                  <ThemedText style={styles.deviceIdHint}>Tap to send test error & copy</ThemedText>
                </Pressable>
              </>
            )}
            <View style={styles.divider} />
            <View style={styles.settingContainer}>
              <ThemedText style={styles.settingLabel}>App Log</ThemedText>
              <View style={styles.settingOptionsContainer}>
                {['enabled', 'disabled'].map((option) => (
                  <Pressable
                    key={option}
                    style={[styles.settingOption, (option === 'enabled' && isLogFileEnabled) || (option === 'disabled' && !isLogFileEnabled) ? styles.settingOptionActive : null]}
                    onPress={() => handleLogSettingChange(option as 'enabled' | 'disabled')}
                  >
                    <ThemedText style={[styles.settingOptionText, styles.settingOptionTextActive]}>{formatOptionName(option)}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
            {isLogFileEnabled && (
              <>
                <View style={styles.divider} />
                <SettingsRow title="Share log file" onPress={handleShareLogFile} hideChevron />
                <View style={styles.divider} />
                <SettingsRow title={isLogPreviewVisible ? 'Hide log tail' : 'Show log tail'} onPress={handleToggleLogPreview} hideChevron />
                {isLogPreviewVisible && (
                  <View style={styles.logPreviewContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.logPreviewHorizontal}>
                      <ScrollView style={styles.logPreviewScroll} showsVerticalScrollIndicator nestedScrollEnabled>
                        <ThemedText style={styles.logPreviewText} selectable testID="LogPreviewText">
                          {logPreview}
                        </ThemedText>
                      </ScrollView>
                    </ScrollView>
                  </View>
                )}
              </>
            )}
          </View>
        );

      case 'securityActions':
        return (
          <>
            <View style={styles.settingsGroup}>
              <SettingsRow title="Lock App" onPress={handleLockApp} testID="LockAppButton" hideChevron />
              <View style={styles.divider} />
              <SettingsRow title="Clear All Data" onPress={handleClearStorage} disabled={isClearing} testID="ClearStorageButton" hideChevron />
            </View>
            <ThemedText style={styles.warningText}>⚠️ Clear All Data will erase everything including your wallet. Make sure you have backed up your seed phrase!</ThemedText>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ScreenHeader title="Tools" />
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => item + index}
          renderItem={renderItem}
          contentInsetAdjustmentBehavior="automatic"
          automaticallyAdjustContentInsets
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.scrollContent}
          style={styles.scrollContainer}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingsGroup: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  testButton: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
  },
  testButtonDisabled: {
    opacity: 0.5,
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(52, 199, 89, 1)',
  },
  testResult: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  testResultSuccess: {
    fontSize: 16,
    color: 'rgba(52, 199, 89, 1)',
    fontWeight: '600',
  },
  testResultError: {
    fontSize: 16,
    color: 'rgba(255, 59, 48, 1)',
    fontWeight: '600',
  },
  testResultErrorMessage: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 8,
  },
  pocketSection: {
    padding: 16,
  },
  accountText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    marginBottom: 16,
  },
  accountButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  accountButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  accountButtonActive: {
    backgroundColor: 'rgba(100, 149, 237, 0.9)',
    borderColor: 'rgba(100, 149, 237, 1)',
  },
  accountButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  accountButtonTextActive: {
    color: 'white',
  },
  xpubContainer: {
    padding: 16,
  },
  xpubText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: 'monospace',
  },
  xpubHint: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  settingContainer: {
    padding: 16,
  },
  settingLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  settingOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  settingOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  settingOptionActive: {
    backgroundColor: 'rgba(100, 149, 237, 0.9)',
    borderColor: 'rgba(100, 149, 237, 1)',
  },
  settingOptionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  settingOptionButtonActive: {
    backgroundColor: 'rgba(100, 149, 237, 0.9)',
    borderColor: 'rgba(100, 149, 237, 1)',
  },
  settingOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  settingOptionTextActive: {
    color: 'white',
  },
  deviceIdRow: {
    padding: 16,
  },
  deviceIdRowPressed: {
    opacity: 0.7,
  },
  deviceIdTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
  },
  deviceIdValue: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  deviceIdText: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  deviceIdHint: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginLeft: 16,
  },
  logPreviewContainer: {
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  logPreviewHorizontal: {
    flexGrow: 1,
  },
  logPreviewScroll: {
    minHeight: 110,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    padding: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  logPreviewText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 14,
  },
  warningText: {
    fontSize: 12,
    color: 'rgba(255, 59, 48, 0.9)',
    marginTop: 8,
    marginHorizontal: 16,
    lineHeight: 16,
  },
});
