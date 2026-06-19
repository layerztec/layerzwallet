import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useContext, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import Button from '@/components/Button';
import Pressable from '@/components/Pressable';
import RadialGradientScreen from '@/components/RadialGradientScreen';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import { ThemedText } from '@/components/ThemedText';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { RgbWallet } from '@shared/class/wallets/rgb-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { NETWORK_RGB_TESTNET } from '@shared/types/networks';
import type { RgbLnSendResult } from '@shared/types/rgb-adapter';

export default function SendRgbLnScreen() {
  const router = useRouter();
  const { scanQr } = useContext(ScanQrContext);
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);

  const [invoice, setInvoice] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RgbLnSendResult | null>(null);

  if (network !== NETWORK_RGB_TESTNET) {
    return (
      <RadialGradientScreen network={network}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Send USDT (Lightning)" />
        <View style={styles.body}>
          <ThemedText style={styles.error}>USDT Lightning send is only enabled on RGB signet right now.</ThemedText>
        </View>
      </RadialGradientScreen>
    );
  }

  const handleScan = async () => {
    const scanned = await scanQr();
    if (scanned) setInvoice(scanned.trim());
  };

  const handleSend = async () => {
    setError(null);
    const trimmed = invoice.trim();
    if (!trimmed) {
      setError('Paste or scan an RGB invoice.');
      return;
    }
    if (!trimmed.startsWith('rgb:') && !trimmed.startsWith('utxob:')) {
      setError('Expected an rgb: or utxob: invoice.');
      return;
    }
    setIsSending(true);
    try {
      const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
      if (!(wallet instanceof RgbWallet)) throw new Error('Wallet is not an RgbWallet');
      const r = await wallet.lightningSendAsset({ rgbInvoice: trimmed });
      setResult(r);
    } catch (e: any) {
      console.warn('lightningSendAsset failed:', e);
      setError(e?.message ?? 'Failed to send over Lightning');
    } finally {
      setIsSending(false);
    }
  };

  if (result) {
    return (
      <RadialGradientScreen network={network}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Sent" />
        <View style={styles.body}>
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={64} color="#4CAF50" style={styles.successIcon} />
            <ThemedText style={styles.successTitle}>Payment submitted</ThemedText>
            {result.status ? <ThemedText style={styles.successSubtitle}>Status: {result.status}</ThemedText> : null}
            {result.paymentHash ? <ThemedText style={styles.hash}>Hash: {result.paymentHash}</ThemedText> : null}
          </View>
          <Button title="Done" onPress={() => router.back()} />
        </View>
      </RadialGradientScreen>
    );
  }

  return (
    <RadialGradientScreen network={network}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Send USDT (Lightning)" />
      <ScrollView contentContainerStyle={styles.body}>
        <ThemedText style={styles.label}>RGB invoice</ThemedText>
        <View style={styles.inputRow}>
          <TextInput style={styles.input} value={invoice} onChangeText={setInvoice} placeholder="rgb:..." placeholderTextColor="#888" autoCapitalize="none" autoCorrect={false} multiline />
          <Pressable onPress={handleScan} style={styles.scanButton}>
            <Ionicons name="scan-outline" size={22} color="white" />
          </Pressable>
        </View>

        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

        <Button title={isSending ? 'Sending…' : 'Send via LSP'} onPress={handleSend} disabled={isSending} />

        <ThemedText style={styles.helpText}>The LSP fronts the BOLT11 payment; our wallet pays it, the LSP forwards the RGB asset to the recipient on settle.</ThemedText>
      </ScrollView>
    </RadialGradientScreen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 12 },
  label: { fontSize: 14, opacity: 0.7 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: 'white',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: 'Courier',
    minHeight: 80,
  },
  scanButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { color: '#FF6B6B', fontSize: 14 },
  helpText: { color: '#aaa', fontSize: 13, marginVertical: 8 },
  successCard: { alignItems: 'center', padding: 24, gap: 8 },
  successIcon: { marginBottom: 8 },
  successTitle: { color: 'white', fontSize: 22, fontWeight: '700' },
  successSubtitle: { color: '#aaa', fontSize: 14 },
  hash: { color: '#888', fontSize: 11, fontFamily: 'Courier', marginTop: 4, textAlign: 'center' },
});
