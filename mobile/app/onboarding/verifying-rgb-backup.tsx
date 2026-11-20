/**
 * Restore-from-seed gate. Sits between import-wallet and TOS.
 *
 * The new init() flow refuses to silently create a fresh RGB wallet when VSS
 * is unreachable (would overwrite the real backup with empty state). We
 * surface that *during onboarding* — not on first RGB tap — so a user
 * restoring on a flaky network gets a clear "VSS server unreachable, retry?"
 * before they're dropped into the wallet UI.
 *
 * On Skip the user proceeds to TOS; subsequent RGB inits still fail with
 * the same typed error, so the safety net is never bypassed.
 *
 * See tasks/ship-rgb.md.
 */
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import Button from '@/components/Button';
import RadialGradientScreen from '@/components/RadialGradientScreen';
import { ThemedText } from '@/components/ThemedText';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { RgbBackupServerUnreachableError } from '@shared/class/wallets/rgb-wallet';
import { NETWORK_RGB_TESTNET } from '@shared/types/networks';

type ProbeStatus = 'probing' | 'failed';

const TARGET_NEXT = '/onboarding/tos' as const;

export default function VerifyingRgbBackupScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<ProbeStatus>('probing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<'unreachable' | 'other'>('unreachable');

  const probe = useCallback(async () => {
    setStatus('probing');
    setErrorMessage(null);

    // We init testnet because the VSS server URL is shared with mainnet —
    // reachability is correlated. Successful init pre-warms the cache so
    // first RGB tap is instant.
    try {
      await BackgroundExecutor.lazyInitWallet(NETWORK_RGB_TESTNET, 0);
      router.replace(TARGET_NEXT);
    } catch (e: any) {
      if (e instanceof RgbBackupServerUnreachableError) {
        setErrorKind('unreachable');
        setErrorMessage('Backup server is unreachable. We can’t verify your RGB backup right now.');
      } else {
        // E.g. Esplora chain backend timeout, or other init failure. Treat as
        // recoverable — let the user skip into the rest of the app and retry
        // later from the home banner.
        setErrorKind('other');
        setErrorMessage(typeof e?.message === 'string' ? e.message : 'Could not verify your RGB backup.');
      }
      setStatus('failed');
    }
  }, [router]);

  useEffect(() => {
    probe();
  }, [probe]);

  const skip = () => router.replace(TARGET_NEXT);

  return (
    <RadialGradientScreen network="bitcoin">
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          {status === 'probing' ? (
            <ActivityIndicator size="large" color="rgba(255, 255, 255, 0.95)" />
          ) : (
            <Ionicons name={errorKind === 'unreachable' ? 'cloud-offline-outline' : 'warning-outline'} size={80} color={errorKind === 'unreachable' ? 'rgba(255, 255, 255, 0.9)' : '#ffb86b'} />
          )}
        </View>

        <ThemedText style={styles.title}>{status === 'probing' ? 'Verifying RGB backup…' : 'Backup not verified'}</ThemedText>

        <ThemedText style={styles.subtitle}>
          {status === 'probing'
            ? 'Checking that your RGB backup is reachable before we restore your wallet. This is a one-time step.'
            : (errorMessage ?? 'Unknown error') + ' You can skip RGB for now and try again later from the home banner.'}
        </ThemedText>

        {status === 'failed' && (
          <View style={styles.buttons}>
            <Button title="Retry" onPress={probe} testID="VerifyingRgbBackup.Retry" />
            <Button title="Skip RGB for now" variant="lighter" onPress={skip} testID="VerifyingRgbBackup.Skip" />
          </View>
        )}
      </View>
    </RadialGradientScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 96,
    alignItems: 'center',
  },
  iconWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  buttons: {
    marginTop: 32,
    width: '100%',
    gap: 12,
  },
});
