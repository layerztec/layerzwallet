import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

import Button from '@/components/Button';
import Pressable from '@/components/Pressable';
import RadialGradientScreen from '@/components/RadialGradientScreen';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import { ThemedText } from '@/components/ThemedText';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { wcService } from '@/src/features/walletconnect/modules/wc-service';
import { NETWORK_RGB_TESTNET } from '@shared/types/networks';

/**
 * "Connected dApps": pair with a WebRGB dApp over WalletConnect (scan or
 * paste a wc: URI) and manage active sessions. v1 serves the RGB testnet
 * wallet; the dApp sees read methods + blindReceive, every invoice asks
 * for confirmation.
 */
export default function WalletConnectSessionsScreen() {
  const state = useSyncExternalStore(wcService.subscribe, wcService.snapshot, wcService.snapshot);
  const { scanQr } = React.useContext(ScanQrContext);
  const [uriInput, setUriInput] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    void wcService.ensureStarted();
  }, []);

  const pair = async (raw: string) => {
    setLocalError('');
    try {
      await wcService.pair(raw);
      setUriInput('');
    } catch (e: any) {
      setLocalError(e?.message ?? 'Pairing failed');
    }
  };

  const handleScan = async () => {
    const scanned = await scanQr();
    if (scanned) await pair(scanned);
  };

  const unconfigured = state.status === 'unconfigured' || !wcService.hasProjectId();

  return (
    <RadialGradientScreen network={NETWORK_RGB_TESTNET}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Connected dApps" />
      <View style={styles.body}>
        {unconfigured ? (
          <View style={styles.card}>
            <ThemedText style={styles.cardTitle}>WalletConnect is not configured</ThemedText>
            <ThemedText style={styles.cardText}>
              Set EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID in the build environment (create a free project at cloud.reown.com) and rebuild the app.
            </ThemedText>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <ThemedText style={styles.cardTitle}>Connect to a website</ThemedText>
              <ThemedText style={styles.cardText}>Scan the dApp's WalletConnect QR, or paste the wc: link below.</ThemedText>
              <View style={styles.pairRow}>
                <TextInput
                  style={styles.input}
                  value={uriInput}
                  onChangeText={setUriInput}
                  placeholder="wc:…"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  testID="wc-uri-input"
                />
              </View>
              <View style={styles.buttonsRow}>
                <Button title="Scan QR" onPress={handleScan} testID="wc-scan" />
                <Button title="Connect" onPress={() => pair(uriInput)} disabled={!uriInput.trim() || state.pairing} testID="wc-connect" />
              </View>
              {state.pairing ? (
                <View style={styles.busyRow}>
                  <ActivityIndicator size="small" color="#fff" />
                  <ThemedText style={styles.cardText}> Waiting for the website…</ThemedText>
                </View>
              ) : null}
            </View>

            <ThemedText style={styles.sectionTitle}>Active sessions</ThemedText>
            {state.sessions.length === 0 ? (
              <ThemedText style={styles.cardText}>No connected dApps yet.</ThemedText>
            ) : (
              state.sessions.map((s) => (
                <View key={s.topic} style={styles.sessionRow} testID={`wc-session-${s.topic.slice(0, 8)}`}>
                  <View style={styles.sessionInfo}>
                    <ThemedText style={styles.sessionName}>{s.name || 'Unknown dApp'}</ThemedText>
                    <ThemedText style={styles.sessionUrl} selectable>
                      {s.url}
                    </ThemedText>
                    <ThemedText style={styles.sessionNet}>Connected · {s.network}</ThemedText>
                  </View>
                  <Pressable
                    onPress={() => wcService.disconnect(s.topic)}
                    style={styles.disconnectBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Disconnect ${s.name || 'Unknown dApp'}`}
                    testID={`wc-disconnect-${s.topic.slice(0, 8)}`}
                  >
                    <Ionicons name="close-circle-outline" size={22} color="#FF6B6B" />
                  </Pressable>
                </View>
              ))
            )}
          </>
        )}

        {localError || state.error ? (
          <ThemedText style={styles.error} accessibilityRole="alert">
            {localError || state.error}
          </ThemedText>
        ) : null}
        {state.message && !localError ? <ThemedText style={styles.message}>{state.message}</ThemedText> : null}
      </View>
    </RadialGradientScreen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  card: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 14, marginBottom: 16 },
  cardTitle: { fontSize: 17, lineHeight: 22, fontWeight: '600', color: '#fff', marginBottom: 6 },
  cardText: { fontSize: 14, lineHeight: 19, color: 'rgba(255,255,255,0.75)' },
  pairRow: { marginTop: 10 },
  input: {
    minHeight: 44,
    maxHeight: 96,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    color: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  buttonsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  busyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  sectionTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: 'rgba(255,255,255,0.85)', marginBottom: 8 },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  sessionInfo: { flex: 1 },
  sessionName: { fontSize: 15, lineHeight: 20, color: '#fff', fontWeight: '600' },
  sessionUrl: { fontSize: 13, lineHeight: 18, color: '#7FB7FF' },
  sessionNet: { fontSize: 12, lineHeight: 16, color: 'rgba(255,255,255,0.6)' },
  disconnectBtn: { padding: 6 },
  error: { color: '#FF6B6B', fontSize: 14, lineHeight: 19, marginTop: 10 },
  message: { color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 19, marginTop: 10 },
});
