import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useContext, useEffect, useState } from 'react';
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
import type { RgbLnExternalPayResult } from '@shared/types/rgb-adapter';

/**
 * "Pay an external BOLT11 in a different asset" (rgb-sdk-rn beta.29). Pays a
 * third party's ordinary BOLT11 out of an asset we hold that differs from the
 * one the invoice names; the LSP relays and converts 1:1. The relay is a HODL
 * invoice bound to the third party's payment hash — atomic across both legs.
 */
export default function PayRgbExternalScreen() {
  const router = useRouter();
  const { scanQr } = useContext(ScanQrContext);
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);

  const [invoiceStr, setInvoiceStr] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RgbLnExternalPayResult | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const trimmed = invoiceStr.trim();

  const handleScan = async () => {
    const scanned = await scanQr();
    if (scanned) setInvoiceStr(scanned.replace(/^lightning:/i, '').trim());
  };

  const doPay = async () => {
    setError(null);
    if (network !== NETWORK_RGB_TESTNET) return;
    if (!/^ln(bc|tb|tbs)/i.test(trimmed)) {
      setError('Paste a BOLT11 (ln…) invoice.');
      return;
    }
    setSending(true);
    try {
      const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
      if (!(wallet instanceof RgbWallet)) throw new Error('Wallet is not an RgbWallet');
      if (!wallet.payExternalInvoice) throw new Error('payExternalInvoice not supported by this build');
      const r = await wallet.payExternalInvoice({ invoice: trimmed });
      setResult(r);
      setStatus(r.status ?? null);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to pay external invoice');
    } finally {
      setSending(false);
    }
  };

  // Poll the relay status until terminal so the screen reflects the real
  // outcome (the initial sendResult may still be in flight).
  useEffect(() => {
    if (!result?.paymentHash) return;
    const terminal = (s: string) => ['settled', 'cancelled', 'failed', 'outbound_claimed'].includes(s.toLowerCase());
    if (status && terminal(status)) return;
    if (network !== NETWORK_RGB_TESTNET) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
        if (cancelled || !(wallet instanceof RgbWallet) || !wallet.externalPaymentStatus) return;
        const s = await wallet.externalPaymentStatus(result.paymentHash);
        if (cancelled) return;
        setStatus(s.status);
        if (terminal(s.status)) clearInterval(interval);
      } catch {
        // best-effort
      }
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [result, status, network, accountNumber]);

  if (result) {
    const norm = (status ?? '').toLowerCase();
    const ok = norm === 'settled' || norm === 'outbound_claimed';
    const failed = norm === 'cancelled' || norm === 'failed';
    return (
      <RadialGradientScreen network={network}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title={ok ? 'Sent' : failed ? 'Failed' : 'Pending'} />
        <View style={styles.body}>
          <View style={styles.card}>
            <Ionicons name={ok ? 'checkmark-circle' : failed ? 'close-circle' : 'time'} size={64} color={ok ? '#4CAF50' : failed ? '#FF6B6B' : '#F5C518'} />
            <ThemedText style={styles.title}>{ok ? 'Payment settled' : failed ? 'Payment failed' : 'Payment pending'}</ThemedText>
            <ThemedText style={styles.sub}>Status: {status ?? 'unknown'}</ThemedText>
            <ThemedText style={styles.sub}>
              You pay {result.inbound.assetAmount ?? '?'} {result.inbound.assetId ? shortAsset(result.inbound.assetId) : ''} → they get {result.outbound.assetAmount ?? '?'}{' '}
              {result.outbound.assetId ? shortAsset(result.outbound.assetId) : ''}
              {result.converted ? ' (LSP converts)' : ''}
            </ThemedText>
            {result.txid ? <ThemedText style={styles.hash}>Txid: {result.txid}</ThemedText> : null}
          </View>
          <Button title="Done" onPress={() => router.back()} />
        </View>
      </RadialGradientScreen>
    );
  }

  return (
    <RadialGradientScreen network={network}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Pay external invoice" />
      <ScrollView contentContainerStyle={styles.body}>
        {network !== NETWORK_RGB_TESTNET ? (
          <ThemedText style={styles.error}>Only enabled on RGB signet right now.</ThemedText>
        ) : (
          <>
            <ThemedText style={styles.label}>BOLT11 invoice</ThemedText>
            <View style={styles.inputRow}>
              <TextInput style={styles.input} value={invoiceStr} onChangeText={setInvoiceStr} placeholder="lntbs..." placeholderTextColor="#888" autoCapitalize="none" autoCorrect={false} multiline />
              <Pressable onPress={handleScan} style={styles.scanButton}>
                <Ionicons name="scan-outline" size={22} color="white" />
              </Pressable>
            </View>
            {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
            <Button title={sending ? 'Paying…' : 'Pay'} onPress={doPay} disabled={sending} />
            <ThemedText style={styles.help}>Pays a third party's plain BOLT11 out of an asset you hold; the LSP relays and converts 1:1 when the assets differ.</ThemedText>
          </>
        )}
      </ScrollView>
    </RadialGradientScreen>
  );
}

function shortAsset(id: string): string {
  return id.length > 14 ? `${id.slice(0, 10)}…` : id;
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 12 },
  label: { fontSize: 14, opacity: 0.7 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  input: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', color: 'white', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'Courier', minHeight: 80 },
  scanButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  error: { color: '#FF6B6B', fontSize: 14 },
  help: { color: '#888', fontSize: 13, marginVertical: 4 },
  card: { alignItems: 'center', padding: 24, gap: 8 },
  title: { color: 'white', fontSize: 22, fontWeight: '700' },
  sub: { color: '#aaa', fontSize: 14, textAlign: 'center' },
  hash: { color: '#888', fontSize: 11, fontFamily: 'Courier', marginTop: 4, textAlign: 'center' },
});
