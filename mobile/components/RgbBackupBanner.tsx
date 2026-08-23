import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import Pressable from '@/components/Pressable';
import SectionContainer from '@/components/SectionContainer';
import { ThemedText } from '@/components/ThemedText';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useRgbBackupStatus } from '@shared/hooks/useRgbBackupStatus';

// Keeps the banner persistent until the user retries or a fresh mutation
// succeeds — see tasks/ship-rgb.md.

const RgbBackupBanner: React.FC = () => {
  const { network } = React.useContext(NetworkContext);
  const { accountNumber } = React.useContext(AccountNumberContext);
  const { status, pendingCount, lastError, retry } = useRgbBackupStatus(network, accountNumber, BackgroundExecutor);
  const [isRetrying, setIsRetrying] = useState(false);

  if (status === 'synced') return null;

  const isFailed = status === 'failed';
  const title = isFailed ? 'Backup failed' : 'Backup pending';
  const detail = isFailed
    ? `${pendingCount} change${pendingCount === 1 ? '' : 's'} not yet saved to backup. Tap to retry — until then, recovery on a new device may be missing recent activity.`
    : `${pendingCount} change${pendingCount === 1 ? '' : 's'} are syncing to backup. Usually clears within seconds.`;

  const handlePress = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    try {
      const ok = await retry();
      if (!ok) {
        Alert.alert('Backup retry failed', lastError?.message ?? 'Unknown error. Try again in a moment, or check your network.');
      }
    } catch (e: any) {
      Alert.alert('Backup retry failed', e?.message ?? 'Unknown error.');
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <Pressable onPress={handlePress} activeOpacity={0.8} disabled={isRetrying} testID="RgbBackupBanner">
      <SectionContainer contentStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.icon}>
            {isRetrying ? (
              <ActivityIndicator color="rgba(255, 255, 255, 0.9)" />
            ) : (
              <Ionicons name={isFailed ? 'warning-outline' : 'cloud-upload-outline'} size={24} color={isFailed ? '#ffb86b' : 'rgba(255, 255, 255, 0.9)'} />
            )}
          </View>
          <ThemedText style={styles.title}>{title}</ThemedText>
        </View>
        <View style={styles.textRow}>
          <ThemedText style={styles.text}>{detail}</ThemedText>
        </View>
      </SectionContainer>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingTop: 12,
    paddingRight: 16,
    paddingBottom: 12,
    paddingLeft: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    color: 'white',
    fontWeight: '600',
    flex: 1,
  },
  textRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingLeft: 10,
  },
  text: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '400',
    flex: 1,
  },
});

export default RgbBackupBanner;
