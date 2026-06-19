import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import Button from '@/components/Button';
import Pressable from '@/components/Pressable';
import RadialGradientScreen from '@/components/RadialGradientScreen';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import { ThemedText } from '@/components/ThemedText';
import { RGB_LN_ASSETS, RGB_LSP_BASE_URL } from '@/src/constants/rgb-lsp';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { RgbWallet } from '@shared/class/wallets/rgb-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { NETWORK_RGB_TESTNET } from '@shared/types/networks';
import type { RgbLnReceiveResult, RgbLnSettlementOutcome } from '@shared/types/rgb-adapter';

// The LN-receive flow is signet-only for now; mainnet stays gated behind
// flag `showTestnets` *and* hidden in ActionButtons. This screen also guards
// itself (below) so a deep link can't bypass the action sheet.

export default function ReceiveRgbLnScreen() {
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);

  const [amountSatsStr, setAmountSatsStr] = useState('');
  const [amountUsdtStr, setAmountUsdtStr] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RgbLnReceiveResult | null>(null);
  const [activeTab, setActiveTab] = useState<'ln' | 'rgb'>('ln');
  const [isCopied, setIsCopied] = useState(false);
  const [settlement, setSettlement] = useState<'waiting' | RgbLnSettlementOutcome | 'error'>('waiting');
  const [settlementError, setSettlementError] = useState<string | null>(null);
  // `cancelled` guards against a state update after the user navigated away.
  // It's a ref so the cleanup closure sees the latest value without rebinding.
  const settlementCancelledRef = useRef(false);

  const usdtAssetId = RGB_LN_ASSETS.signet.usdt;
  const lspBaseUrl = RGB_LSP_BASE_URL.signet;

  const configurationError = !lspBaseUrl ? 'LSP base URL not configured for signet' : !usdtAssetId ? 'USDT asset id not configured for signet' : null;

  const generate = async () => {
    setError(null);
    if (network !== NETWORK_RGB_TESTNET) return; // gated at the top of the render too
    if (configurationError) {
      setError(configurationError);
      return;
    }
    const amountSats = Number(amountSatsStr);
    const amountRgb = Number(amountUsdtStr);
    if (!Number.isFinite(amountSats) || amountSats <= 0 || !Number.isSafeInteger(amountSats)) {
      setError('Sats amount must be a positive integer.');
      return;
    }
    if (!Number.isFinite(amountRgb) || amountRgb <= 0 || !Number.isSafeInteger(amountRgb)) {
      setError('USDT amount must be a positive integer (base units).');
      return;
    }
    setIsGenerating(true);
    try {
      const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
      if (!(wallet instanceof RgbWallet)) throw new Error('Wallet is not an RgbWallet');
      const r = await wallet.lightningReceiveAsset({
        assetId: usdtAssetId!,
        amountSats,
        amountRgb,
      });
      setResult(r);
    } catch (e: any) {
      console.warn('lightningReceiveAsset failed:', e);
      setError(e?.message ?? 'Failed to generate Lightning invoice');
    } finally {
      setIsGenerating(false);
    }
  };

  // Kick the settlement watcher once the invoice exists. 90s window strikes
  // a balance between "user gets prompt feedback" and "real-world LSP routing
  // latency"; the underlying SDK happily polls forever if we let it.
  useEffect(() => {
    if (!result) return;
    if (network !== NETWORK_RGB_TESTNET) return;
    settlementCancelledRef.current = false;
    setSettlement('waiting');
    setSettlementError(null);
    (async () => {
      try {
        const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
        if (settlementCancelledRef.current) return;
        if (!(wallet instanceof RgbWallet)) return;
        const outcome = await wallet.awaitLightningReceiveSettlement({ lnInvoice: result.lnInvoice, timeoutMs: 90_000 });
        if (settlementCancelledRef.current) return;
        setSettlement(outcome);
      } catch (e: any) {
        if (settlementCancelledRef.current) return;
        setSettlement('error');
        setSettlementError(e?.message ?? 'Settlement check failed');
      }
    })();
    return () => {
      settlementCancelledRef.current = true;
    };
  }, [result, network, accountNumber]);

  const copyActive = async () => {
    if (!result) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(activeTab === 'ln' ? result.lnInvoice : result.rgbInvoice);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (network !== NETWORK_RGB_TESTNET) {
    return (
      <RadialGradientScreen network={network}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Receive USDT (Lightning)" />
        <View style={styles.body}>
          <ThemedText style={styles.error}>USDT Lightning receive is only enabled on RGB signet right now.</ThemedText>
        </View>
      </RadialGradientScreen>
    );
  }

  if (result) {
    const active = activeTab === 'ln' ? result.lnInvoice : result.rgbInvoice;
    return (
      <RadialGradientScreen network={network}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="USDT over Lightning" />
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.tabRow}>
            <Pressable style={[styles.tab, activeTab === 'ln' && styles.tabActive]} onPress={() => setActiveTab('ln')}>
              <ThemedText style={styles.tabText}>Lightning</ThemedText>
            </Pressable>
            <Pressable style={[styles.tab, activeTab === 'rgb' && styles.tabActive]} onPress={() => setActiveTab('rgb')}>
              <ThemedText style={styles.tabText}>RGB on-chain</ThemedText>
            </Pressable>
          </View>

          <View style={styles.qrContainer}>
            <QRCode value={active} size={280} backgroundColor="#ffffff" color="black" />
          </View>

          <Pressable onPress={copyActive} style={styles.invoicePressable}>
            <ThemedText style={styles.invoiceText} selectable>
              {active}
            </ThemedText>
            <ThemedText style={styles.copyHint}>{isCopied ? 'Copied ✓' : 'Tap to copy'}</ThemedText>
          </Pressable>

          <ThemedText style={styles.helpText}>
            {activeTab === 'ln'
              ? 'Sender pays in sats. The LSP fronts the USDT to your channel on settle.'
              : 'Sender pays the RGB asset directly on-chain. Same logical receive — only one path settles.'}
          </ThemedText>

          <View style={styles.settlementRow}>
            {settlement === 'waiting' ? (
              <>
                <ActivityIndicator color="#4FC3F7" />
                <ThemedText style={styles.settlementText}>Waiting for payment…</ThemedText>
              </>
            ) : settlement === 'settled' ? (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                <ThemedText style={styles.settlementText}>Settled</ThemedText>
              </>
            ) : settlement === 'timed_out' ? (
              <>
                <Ionicons name="time-outline" size={20} color="#FFAB00" />
                <ThemedText style={styles.settlementText}>Still pending — close this screen and check transactions later.</ThemedText>
              </>
            ) : (
              <>
                <Ionicons name="alert-circle-outline" size={20} color="#FF6B6B" />
                <ThemedText style={styles.settlementText}>{settlementError ?? 'Settlement failed'}</ThemedText>
              </>
            )}
          </View>

          <Button title="Done" onPress={() => router.back()} />
        </ScrollView>
      </RadialGradientScreen>
    );
  }

  return (
    <RadialGradientScreen network={network}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Receive USDT (Lightning)" />
      <ScrollView contentContainerStyle={styles.body}>
        {configurationError ? <ThemedText style={styles.warn}>{configurationError}. Receive will fail until upstream values are populated.</ThemedText> : null}

        <ThemedText style={styles.label}>Amount in sats</ThemedText>
        <TextInput style={styles.input} keyboardType="number-pad" value={amountSatsStr} onChangeText={setAmountSatsStr} placeholder="e.g. 5000" placeholderTextColor="#888" />

        <ThemedText style={styles.label}>Amount in USDT (base units)</ThemedText>
        <TextInput style={styles.input} keyboardType="number-pad" value={amountUsdtStr} onChangeText={setAmountUsdtStr} placeholder="e.g. 1000000" placeholderTextColor="#888" />

        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

        <Button title={isGenerating ? 'Generating…' : 'Generate invoice'} onPress={generate} disabled={isGenerating} />
      </ScrollView>
    </RadialGradientScreen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 12 },
  label: { fontSize: 14, opacity: 0.7 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: 'white',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  warn: { color: '#FFAB00', fontSize: 13 },
  error: { color: '#FF6B6B', fontSize: 14 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' },
  tabActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  tabText: { color: 'white', fontSize: 14, fontWeight: '600' },
  qrContainer: { alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16 },
  invoicePressable: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 12 },
  invoiceText: { color: 'white', fontSize: 12, fontFamily: 'Courier' },
  copyHint: { color: '#888', fontSize: 12, marginTop: 6, textAlign: 'center' },
  helpText: { color: '#aaa', fontSize: 13, marginVertical: 8 },
  settlementRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  settlementText: { color: 'white', fontSize: 14, flex: 1 },
});
