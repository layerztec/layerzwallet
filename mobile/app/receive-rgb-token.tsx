import { Ionicons } from '@expo/vector-icons';
import BigNumber from 'bignumber.js';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import Button from '@/components/Button';
import Pressable from '@/components/Pressable';
import RadialGradientScreen from '@/components/RadialGradientScreen';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import { ThemedText } from '@/components/ThemedText';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { RgbWallet } from '@shared/class/wallets/rgb-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { NETWORK_RGB, NETWORK_RGB_TESTNET } from '@shared/types/networks';
import { CachedTokenInfo } from '@shared/types/token-info';

type ReceiveResult = {
  invoice: string;
  type: 'blind' | 'witness';
  expirationTimestamp: number | null;
};

const ANY_ASSET = '__any__';

export default function ReceiveRgbTokenScreen() {
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);

  const [knownAssets, setKnownAssets] = useState<CachedTokenInfo[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>(ANY_ASSET);
  const [amountStr, setAmountStr] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReceiveResult | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const [received, setReceived] = useState<{ symbol: string; name: string; decimals: number; delta: string } | null>(null);
  const initialBalancesRef = useRef<Map<string, string> | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | number | null>(null);

  // Cache the wallet's known token list for the asset dropdown. RGB asset
  // discovery already happens via `prepareWallet` + ongoing `fetchTokenBalances`
  // so this is just reading the current snapshot.
  useEffect(() => {
    if (network !== NETWORK_RGB && network !== NETWORK_RGB_TESTNET) return;
    let cancelled = false;
    (async () => {
      try {
        const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
        if (cancelled || !(wallet instanceof RgbWallet)) return;
        await wallet.fetchTokenBalances();
        if (cancelled) return;
        setKnownAssets(wallet.getTokenBalances());
      } catch (e) {
        console.warn('failed to load asset list:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [network, accountNumber]);

  // Snapshot current balances right after we've generated an invoice, then
  // poll every 4s for an increase. First detected delta wins; we stop polling
  // and show a success card.
  useEffect(() => {
    if (!result) return;
    if (network !== NETWORK_RGB && network !== NETWORK_RGB_TESTNET) return;
    let cancelled = false;
    (async () => {
      const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
      if (cancelled || !(wallet instanceof RgbWallet)) return;
      await wallet.fetchTokenBalances();
      if (cancelled) return;
      const initial = new Map<string, string>();
      for (const t of wallet.getTokenBalances()) initial.set(t.id, String(t.balance ?? '0'));
      initialBalancesRef.current = initial;

      const tick = async () => {
        const w = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
        if (cancelled || !(w instanceof RgbWallet)) return;
        await w.fetchTokenBalances();
        if (cancelled) return;
        for (const t of w.getTokenBalances()) {
          const cur = new BigNumber(String(t.balance ?? '0'));
          const ini = new BigNumber(initialBalancesRef.current?.get(t.id) ?? '0');
          if (cur.gt(ini)) {
            setReceived({ symbol: t.symbol, name: t.name, decimals: t.decimals, delta: cur.minus(ini).toString(10) });
            if (pollTimerRef.current) clearInterval(pollTimerRef.current as number);
            pollTimerRef.current = null;
            return;
          }
        }
      };
      pollTimerRef.current = setInterval(tick, 4_000);
    })();
    return () => {
      cancelled = true;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current as number);
      pollTimerRef.current = null;
    };
  }, [result, network, accountNumber]);

  if (network !== NETWORK_RGB && network !== NETWORK_RGB_TESTNET) {
    return (
      <RadialGradientScreen network={network}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Receive RGB Asset" />
        <View style={styles.body}>
          <ThemedText style={styles.error}>Switch to an RGB network to receive assets.</ThemedText>
        </View>
      </RadialGradientScreen>
    );
  }

  const generate = async () => {
    setError(null);
    setIsGenerating(true);
    try {
      const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
      if (!(wallet instanceof RgbWallet)) throw new Error('Wallet is not an RgbWallet');

      // SDK bug workaround: passing `amount: undefined` to blindReceive /
      // witnessReceive crashes the native iOS module via a Swift `fatalError`
      // (assignment is hardcoded to `Fungible`, which requires an amount).
      // Until upstream fixes it, force the caller to enter an amount.
      const n = Number(amountStr);
      if (!amountStr.trim() || !Number.isFinite(n) || n <= 0 || !Number.isSafeInteger(n)) {
        setError('Amount is required and must be a positive integer (in base units).');
        setIsGenerating(false);
        return;
      }
      const params: { assetId?: string; amount: number } = { amount: n };
      if (selectedAssetId !== ANY_ASSET) params.assetId = selectedAssetId;

      const r = await wallet.requestReceive(params);
      setResult({ invoice: r.invoice, type: r.type, expirationTimestamp: r.expirationTimestamp });
    } catch (e: any) {
      console.warn('requestReceive failed:', e);
      setError(e?.message ?? 'Failed to generate invoice');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyInvoice = async () => {
    if (!result) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(result.invoice);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const shareInvoice = async () => {
    if (!result) return;
    try {
      await Share.share({ message: result.invoice });
    } catch {
      /* user cancelled */
    }
  };

  // Success card — shown when balance polling detects an asset increase.
  if (received) {
    const display = formatTokenAmount(received.delta, received.decimals);
    return (
      <RadialGradientScreen network={network}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Asset Received" />
        <View style={styles.body}>
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={64} color="#4CAF50" style={styles.successIcon} />
            <ThemedText style={styles.successTitle}>
              +{display} {received.symbol}
            </ThemedText>
            <ThemedText style={styles.successSubtitle}>{received.name}</ThemedText>
          </View>
          <Button title="Done" onPress={() => router.back()} />
        </View>
      </RadialGradientScreen>
    );
  }

  // Generated invoice view.
  if (result) {
    return (
      <RadialGradientScreen network={network}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="RGB Invoice" />
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.typeBadgeRow}>
            <View style={styles.typeBadge}>
              <ThemedText style={styles.typeBadgeText}>{result.type === 'blind' ? 'Private (blind)' : 'Witness invoice'}</ThemedText>
            </View>
            {result.expirationTimestamp ? <ThemedText style={styles.expiryText}>Expires {formatExpiry(result.expirationTimestamp)}</ThemedText> : null}
          </View>

          <View style={styles.qrContainer}>
            <QRCode value={result.invoice} size={280} backgroundColor="#ffffff" color="black" />
          </View>

          <Pressable onPress={copyInvoice} style={styles.invoicePressable}>
            <ThemedText style={styles.invoiceText} selectable>
              {result.invoice}
            </ThemedText>
            <ThemedText style={styles.copyHint}>{isCopied ? 'Copied ✓' : 'Tap to copy'}</ThemedText>
          </Pressable>

          <ThemedText style={styles.helpText}>
            {result.type === 'blind'
              ? 'Share this invoice with the sender. Their payment will land on a UTXO known only to you.'
              : 'No free allocation slot was available, so this invoice creates a fresh slot when paid. Slightly less private than a blind invoice.'}
          </ThemedText>

          <View style={styles.buttonStack}>
            <Button title="Share" variant="lighter" onPress={shareInvoice} />
            <Button title="Done" onPress={() => router.back()} />
          </View>
        </ScrollView>
      </RadialGradientScreen>
    );
  }

  // Form view.
  return (
    <RadialGradientScreen network={network}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Receive RGB Asset" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <ThemedText style={styles.label}>Asset</ThemedText>
          <View style={styles.assetChips}>
            <AssetChip label="Any asset" selected={selectedAssetId === ANY_ASSET} onPress={() => setSelectedAssetId(ANY_ASSET)} testID="ReceiveRgb.AssetAny" />
            {knownAssets.map((a) => (
              <AssetChip key={a.id} label={a.symbol || a.name} selected={selectedAssetId === a.id} onPress={() => setSelectedAssetId(a.id)} testID={`ReceiveRgb.Asset.${a.id}`} />
            ))}
          </View>

          <ThemedText style={[styles.label, styles.spaced]}>Amount (base units)</ThemedText>
          <TextInput
            style={styles.input}
            value={amountStr}
            onChangeText={(t) => setAmountStr(t.replace(/[^0-9]/g, ''))}
            placeholder="e.g. 100"
            placeholderTextColor="rgba(255,255,255,0.4)"
            keyboardType="number-pad"
            testID="ReceiveRgb.Amount"
          />

          {error && <ThemedText style={[styles.error, styles.spaced]}>{error}</ThemedText>}

          <View style={styles.buttonStack}>
            <Button title="Generate Invoice" onPress={generate} loading={isGenerating} disabled={isGenerating} testID="ReceiveRgb.Submit" />
          </View>
          {isGenerating && (
            <View style={styles.inlineLoader}>
              <ActivityIndicator color="rgba(255,255,255,0.7)" />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </RadialGradientScreen>
  );
}

function AssetChip({ label, selected, onPress, testID }: { label: string; selected: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]} testID={testID}>
      <ThemedText style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</ThemedText>
    </Pressable>
  );
}

function formatTokenAmount(deltaBase: string, decimals: number): string {
  if (decimals <= 0) return deltaBase;
  return new BigNumber(deltaBase).dividedBy(new BigNumber(10).pow(decimals)).toString(10);
}

function formatExpiry(unix: number): string {
  const ms = unix * 1000;
  const diff = ms - Date.now();
  if (diff < 0) return 'expired';
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `in ${hrs}h`;
  const days = Math.round(hrs / 24);
  return `in ${days}d`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  label: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
  },
  spaced: { marginTop: 16 },
  input: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    color: 'white',
    fontSize: 16,
  },
  error: {
    color: '#ff8a8a',
    fontSize: 13,
  },
  buttonStack: {
    marginTop: 32,
    gap: 12,
  },
  inlineLoader: {
    marginTop: 16,
    alignItems: 'center',
  },
  assetChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chipSelected: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderColor: 'rgba(255,255,255,0.6)',
  },
  chipText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  chipTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  typeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  typeBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  expiryText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  qrContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    alignSelf: 'center',
    marginBottom: 16,
  },
  invoicePressable: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  invoiceText: {
    color: 'white',
    fontSize: 12,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  copyHint: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  helpText: {
    marginTop: 16,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    lineHeight: 18,
  },
  successCard: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    color: 'white',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  successSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
});
