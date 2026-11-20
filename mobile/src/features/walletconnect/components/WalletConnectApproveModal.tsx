import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '@/components/Button';
import DetachedSheet from '@/components/DetachedSheet';
import { ThemedText } from '@/components/ThemedText';
import { wcService } from '@/src/features/walletconnect/modules/wc-service';
import { NETWORK_RGB_TESTNET } from '@shared/types/networks';

/**
 * One approval sheet for every WalletConnect prompt (session connect and
 * receive-invoice consent). Rendered as a transparentModal route; the
 * service pushes it when a prompt appears (see WcBootstrap). Dismissing the
 * sheet (back gesture / tap outside) rejects — a dApp must never get an
 * approval the user didn't explicitly tap.
 */
export default function WalletConnectApproveModal() {
  const router = useRouter();
  const state = useSyncExternalStore(wcService.subscribe, wcService.snapshot, wcService.snapshot);
  const prompt = state.prompt;
  const closedByUs = useRef(false);
  const renderedPrompt = useRef(prompt);
  if (prompt) renderedPrompt.current = prompt;

  // Prompt resolved elsewhere (expiry, abort) → close the sheet; guard so
  // our own finish() doesn't pop the screen UNDER the fading modal twice.
  useEffect(() => {
    if (!prompt && !closedByUs.current && router.canGoBack()) router.back();
  }, [prompt, router]);

  // ANY unmount without an explicit decision rejects — Android hardware
  // back and navigation gestures pop this route straight through
  // react-navigation, bypassing the sheet's onClose; without this, the
  // orphaned prompt would block the dApp serial queue for 4 minutes.
  useEffect(() => {
    return () => {
      renderedPrompt.current?.resolve(false);
    };
  }, []);

  const finish = (approved: boolean) => {
    closedByUs.current = true;
    prompt?.resolve(approved);
    if (router.canGoBack()) router.back();
  };

  if (!prompt) return null;

  return (
    <DetachedSheet variant={NETWORK_RGB_TESTNET} onClose={() => finish(false)} accessible={false}>
      <SafeAreaView style={styles.safe} edges={Platform.OS === 'ios' ? ['left', 'right', 'bottom'] : ['left', 'right']}>
        <View style={styles.body}>
          <MaterialCommunityIcons name="link-variant" size={44} color="rgba(255,255,255,0.95)" style={styles.icon} />
          <ThemedText type="sfProRounded" style={styles.title}>
            {prompt.title}
          </ThemedText>
          <ThemedText style={styles.origin} selectable>
            {prompt.origin}
          </ThemedText>
          {prompt.verification === 'UNKNOWN' ? (
            <View style={styles.unverified}>
              <ThemedText style={styles.unverifiedText}>Unverified website — this address is self-declared and was not confirmed by WalletConnect. Approve only if you opened it yourself.</ThemedText>
            </View>
          ) : null}
          <ScrollView style={styles.detailsBox} contentContainerStyle={styles.detailsContent}>
            <ThemedText style={styles.details} selectable>
              {prompt.details}
            </ThemedText>
          </ScrollView>
          <View style={styles.buttons}>
            <Button title="Approve" onPress={() => finish(true)} testID="wc-approve" />
            <Button title="Reject" onPress={() => finish(false)} testID="wc-reject" />
          </View>
        </View>
      </SafeAreaView>
    </DetachedSheet>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  body: { marginHorizontal: 20, paddingBottom: 20, paddingTop: 8, alignItems: 'center' },
  icon: { marginBottom: 10 },
  title: { fontSize: 24, lineHeight: 30, color: '#fff', fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  origin: { fontSize: 15, lineHeight: 20, color: '#7FB7FF', marginBottom: 12, textAlign: 'center' },
  unverified: {
    backgroundColor: 'rgba(255, 204, 0, 0.12)',
    borderColor: 'rgba(255, 204, 0, 0.5)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    alignSelf: 'stretch',
  },
  unverifiedText: { color: '#FFCC00', fontSize: 13, lineHeight: 18 },
  detailsBox: { alignSelf: 'stretch', maxHeight: 220, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, marginBottom: 16 },
  detailsContent: { padding: 12 },
  details: { fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.9)' },
  buttons: { alignSelf: 'stretch', gap: 10 },
});
