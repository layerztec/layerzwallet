import React, { useContext, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePreventScreenCapture } from 'expo-screen-capture';

import Button from '@/components/Button';
import GradientScreen from '@/components/GradientScreen';
import { ThemedText } from '@/components/ThemedText';
import { useAskPassword } from '@/src/hooks/AskPasswordContext';
import { useAuthState } from '@/src/hooks/AuthStateContext';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useSettings } from '@shared/hooks/useSettings';

export default function SeedBackupScreen() {
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const { settings } = useSettings();
  const { authenticateWithBiometrics } = useAuthState();
  const { askPassword } = useAskPassword();
  const settingsContext = useSettings();
  const hasBackedUpSeed = settings.seedBackedUp === 'ON';
  const insets = useSafeAreaInsets();

  const [mnemonic, setMnemonic] = useState('');
  const [isRevealed, setIsRevealed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [badgeTapCount, setBadgeTapCount] = useState(0);

  usePreventScreenCapture();

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
      router.push({ pathname: '/SeedBackupVerify', params: { mnemonic } });
    }
  };

  const handleBadgeTap = async () => {
    const newCount = badgeTapCount + 1;
    setBadgeTapCount(newCount);

    if (newCount >= 10) {
      await settingsContext.updateSetting('seedBackedUp', hasBackedUpSeed ? 'OFF' : 'ON');
      setBadgeTapCount(0);
      Alert.alert('Debug', `Seed backup status toggled to ${hasBackedUpSeed ? 'not backed up' : 'backed up'}`);
    }
  };

  const mnemonicWordsData = useMemo(() => {
    if (!mnemonic) return [];
    return mnemonic.split(' ').map((word, index) => ({ word, index, id: index.toString() }));
  }, [mnemonic]);

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
});
