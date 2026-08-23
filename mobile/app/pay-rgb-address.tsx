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
import type { RgbLnAssetSelection, RgbLnDiscovery } from '@shared/types/rgb-adapter';

/**
 * "Pay to Lightning address" (rgb-sdk-rn beta.29 two-asset flow). Resolves an
 * LSP-hosted Lightning Address, then pays it. Omitting `asset.assetId` lets the
 * SDK pick the payout asset when we hold enough, converting a bridge asset 1:1
 * otherwise — the choice comes back as `assetSelection.converted`.
 */
export default function PayRgbAddressScreen() {
  const router = useRouter();
  const { scanQr } = useContext(ScanQrContext);
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);

  const [address, setAddress] = useState('');
  const [satsStr, setSatsStr] = useState('');
  const [assetStr, setAssetStr] = useState('');
  const [discovery, setDiscovery] = useState<RgbLnDiscovery | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ txid: string; status?: string; assetSelection?: RgbLnAssetSelection } | null>(null);

  const trimmedAddr = address.trim();

  // Preview the address's payout + accepted assets as the user types a
  // plausible `user@host`. Best-effort; failures just hide the preview.
  useEffect(() => {
    let cancelled = false;
    if (network !== NETWORK_RGB_TESTNET || !/^[^@\s]+@[^@\s]+$/.test(trimmedAddr)) {
      setDiscovery(null);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
        if (cancelled || !(wallet instanceof RgbWallet) || !wallet.discoverAddress) return;
        const d = await wallet.discoverAddress(trimmedAddr);
        if (!cancelled) setDiscovery(d);
      } catch {
        if (!cancelled) setDiscovery(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trimmedAddr, network, accountNumber]);

  const handleScan = async () => {
    const scanned = await scanQr();
    if (scanned) setAddress(scanned.replace(/^lightning:/i, '').trim());
  };

  const doPay = async () => {
    setError(null);
    if (network !== NETWORK_RGB_TESTNET) return;
    const sats = Number(satsStr);
    const assetAmount = Number(assetStr);
    if (!/^[^@\s]+@[^@\s]+$/.test(trimmedAddr)) {
      setError('Enter a valid Lightning address (user@host).');
      return;
    }
    // `sats * 1000` below must itself stay a safe integer.
    if (!Number.isFinite(sats) || sats <= 0 || !Number.isSafeInteger(sats) || !Number.isSafeInteger(sats * 1000)) {
      setError('Sats amount must be a positive integer.');
      return;
    }
    if (!Number.isFinite(assetAmount) || assetAmount <= 0 || !Number.isSafeInteger(assetAmount)) {
      setError('Asset amount must be a positive integer (base units).');
      return;
    }
    setSending(true);
    try {
      const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
      if (!(wallet instanceof RgbWallet)) throw new Error('Wallet is not an RgbWallet');
      if (!wallet.payAddress) throw new Error('payAddress not supported by this build');
      // Omit asset.assetId → SDK selects payout (no conversion) when liquidity
      // covers, else a bridge asset the LSP converts 1:1.
      const r = await wallet.payAddress({ address: trimmedAddr, amtMsat: sats * 1000, asset: { assetAmount } });
      setResult(r);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to pay Lightning address');
    } finally {
      setSending(false);
    }
  };

  if (result) {
    const norm = (result.status ?? '').toString().toLowerCase();
    const ok = norm.includes('succe');
    return (
      <RadialGradientScreen network={network}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title={ok ? 'Sent' : 'Pending'} />
        <View style={styles.body}>
          <View style={styles.card}>
            <Ionicons name={ok ? 'checkmark-circle' : 'time'} size={64} color={ok ? '#4CAF50' : '#F5C518'} />
            <ThemedText style={styles.title}>{ok ? 'Payment sent' : 'Payment pending'}</ThemedText>
            <ThemedText style={styles.sub}>Status: {result.status ?? 'unknown'}</ThemedText>
            {result.assetSelection ? (
              <ThemedText style={styles.sub}>
                Paid in {result.assetSelection.asset?.ticker ?? 'asset'} {result.assetSelection.converted ? '(LSP converted 1:1)' : '(no conversion)'}
              </ThemedText>
            ) : null}
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
      <ScreenHeader title="Pay Lightning address" />
      <ScrollView contentContainerStyle={styles.body}>
        {network !== NETWORK_RGB_TESTNET ? (
          <ThemedText style={styles.error}>Only enabled on RGB signet right now.</ThemedText>
        ) : (
          <>
            <ThemedText style={styles.label}>Lightning address</ThemedText>
            <View style={styles.inputRow}>
              <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="user@lsp-signet.utexo.com" placeholderTextColor="#888" autoCapitalize="none" autoCorrect={false} />
              <Pressable onPress={handleScan} style={styles.scanButton}>
                <Ionicons name="scan-outline" size={22} color="white" />
              </Pressable>
            </View>

            {discovery ? (
              <View style={styles.previewCard}>
                <ThemedText style={styles.previewRow}>Pays out in: {discovery.payoutAsset?.ticker ?? '(no asset channel yet)'}</ThemedText>
                {discovery.acceptedAssets?.length ? (
                  <ThemedText style={styles.previewRow}>Accepts: {discovery.acceptedAssets.map((a) => a.ticker ?? a.assetId.slice(0, 8)).join(', ')}</ThemedText>
                ) : null}
              </View>
            ) : null}

            <ThemedText style={styles.label}>Amount in sats</ThemedText>
            <TextInput style={styles.inputSingle} value={satsStr} onChangeText={setSatsStr} placeholder="e.g. 3000" placeholderTextColor="#888" keyboardType="numeric" />
            <ThemedText style={styles.label}>Asset amount (base units)</ThemedText>
            <TextInput style={styles.inputSingle} value={assetStr} onChangeText={setAssetStr} placeholder="e.g. 1000000" placeholderTextColor="#888" keyboardType="numeric" />

            {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
            <Button title={sending ? 'Paying…' : 'Pay'} onPress={doPay} disabled={sending} />
            <ThemedText style={styles.help}>The SDK pays in your payout asset when you hold enough, otherwise a bridge asset the LSP converts 1:1.</ThemedText>
          </>
        )}
      </ScrollView>
    </RadialGradientScreen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 12 },
  label: { fontSize: 14, opacity: 0.7 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  input: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', color: 'white', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'Courier' },
  inputSingle: { backgroundColor: 'rgba(255,255,255,0.08)', color: 'white', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  scanButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  error: { color: '#FF6B6B', fontSize: 14 },
  help: { color: '#888', fontSize: 13, marginVertical: 4 },
  previewCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 12, gap: 4 },
  previewRow: { color: '#ccc', fontSize: 13 },
  card: { alignItems: 'center', padding: 24, gap: 8 },
  title: { color: 'white', fontSize: 22, fontWeight: '700' },
  sub: { color: '#aaa', fontSize: 14, textAlign: 'center' },
  hash: { color: '#888', fontSize: 11, fontFamily: 'Courier', marginTop: 4, textAlign: 'center' },
});
