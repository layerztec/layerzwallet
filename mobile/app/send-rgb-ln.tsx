import { Ionicons } from '@expo/vector-icons';
import bolt11lib from 'bolt11';
import { Stack, useRouter } from 'expo-router';
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';

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

/** Best-effort BOLT11 preview: amount + expiry + description. Returns null
 *  for non-BOLT11 or malformed input. Runs on every keystroke because
 *  bolt11.decode is pure JS + fast; we never touch the RLN node here. */
type Bolt11Preview = { satoshis: number | null; expirySec: number | null; description: string | null; expired: boolean };
// `bolt11` (1.4.1) hard-codes network prefixes bc/tb/bcrt/sb; signet
// (`lntbs…` = bech32 `tbs`) isn't in the table so a bare `.decode()`
// throws "Unknown coin bech32 prefix". Pass an explicit network only
// when we spot the signet prefix, otherwise let the lib auto-detect.
const SIGNET_LN_NETWORK = { bech32: 'tbs', pubKeyHash: 0x6f, scriptHash: 0xc4, validWitnessVersions: [0, 1] };

function decodeBolt11(invoice: string): Bolt11Preview | null {
  try {
    const network = /^lntbs/i.test(invoice) ? SIGNET_LN_NETWORK : undefined;
    const decoded = network ? (bolt11lib as any).decode(invoice, network) : bolt11lib.decode(invoice);
    const description = decoded.tags?.find((t: { tagName: string }) => t.tagName === 'description')?.data ?? null;
    const expiryTag = decoded.tags?.find((t: { tagName: string }) => t.tagName === 'expire_time')?.data;
    const expirySec = typeof expiryTag === 'number' ? expiryTag : 3600;
    const nowSec = Math.floor(Date.now() / 1000);
    const expired = typeof decoded.timestamp === 'number' && nowSec > decoded.timestamp + expirySec;
    return {
      satoshis: typeof decoded.satoshis === 'number' ? decoded.satoshis : null,
      expirySec,
      description: typeof description === 'string' ? description : null,
      expired,
    };
  } catch {
    return null;
  }
}

export default function SendRgbLnScreen() {
  const router = useRouter();
  const { scanQr } = useContext(ScanQrContext);
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);

  const [invoice, setInvoice] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RgbLnSendResult | null>(null);

  const trimmed = invoice.trim();
  const isBolt11 = /^ln(bc|tb|tbs)/i.test(trimmed);
  const isRgbInvoice = trimmed.startsWith('rgb:') || trimmed.startsWith('utxob:');
  const preview = useMemo(() => (isBolt11 ? decodeBolt11(trimmed) : null), [trimmed, isBolt11]);
  const [assetPreview, setAssetPreview] = useState<{ assetId?: string; assetAmount?: number; symbol?: string } | null>(null);

  // The pure-JS bolt11 lib exposes sat amount + description, but the RGB
  // asset tags (assetId / assetAmount) live in TLV fields it doesn't parse.
  // Ask the SDK for a full decode so the user can see whether their pay
  // will move USDT (colored channel routing sends 1 UTST with every 3000-sat
  // pay on our current channel, which was previously invisible). Also
  // resolve the assetId → ticker via the wallet's token cache so "1 UTST"
  // renders instead of "1 units — rgb:2l_MeWlj…" — the raw id is copyable
  // in the details sheet if the user needs it.
  useEffect(() => {
    let cancelled = false;
    if (!isBolt11 || !trimmed || network !== NETWORK_RGB_TESTNET) {
      setAssetPreview(null);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
        if (cancelled || !(wallet instanceof RgbWallet)) return;
        const decoded = await wallet.decodeLnInvoice(trimmed);
        if (cancelled) return;
        if (!decoded.assetId) {
          setAssetPreview(null);
          return;
        }
        // fetchTokenBalances is a no-op after warm cache; call it so a
        // just-installed wallet still resolves the ticker.
        await wallet.fetchTokenBalances();
        if (cancelled) return;
        const token = wallet.getTokenBalances().find((t) => t.id === decoded.assetId);
        setAssetPreview({ assetId: decoded.assetId, assetAmount: decoded.assetAmount, symbol: token?.symbol });
      } catch {
        if (!cancelled) setAssetPreview(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trimmed, isBolt11, network, accountNumber]);

  // Decode rgb:/utxob: invoices so the user sees WHAT they're paying before
  // the LSP fronts a BOLT11 for it. Without this, tapping Send on a pasted
  // RGB invoice moved assets for an amount the user never saw.
  const [rgbPreview, setRgbPreview] = useState<{ assetId?: string; amount?: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!isRgbInvoice || !trimmed || network !== NETWORK_RGB_TESTNET) {
      setRgbPreview(null);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
        if (cancelled || !(wallet instanceof RgbWallet)) return;
        const d = await wallet.decodeInvoice(trimmed);
        if (cancelled) return;
        setRgbPreview(d ? { assetId: d.assetId, amount: d.amount } : null);
      } catch {
        if (!cancelled) setRgbPreview(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trimmed, isRgbInvoice, network, accountNumber]);

  const handleScan = async () => {
    const scanned = await scanQr();
    if (scanned) setInvoice(scanned.trim());
  };

  const doSend = async () => {
    if (network !== NETWORK_RGB_TESTNET) return; // render gate lives below the hooks
    setIsSending(true);
    try {
      const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
      if (!(wallet instanceof RgbWallet)) throw new Error('Wallet is not an RgbWallet');
      // Pass the decoded sat amount so the outbound-liquidity pre-gate waits
      // for the real msat requirement instead of its 1000-sat floor.
      const r = isBolt11 ? await wallet.payLightningInvoice({ lnInvoice: trimmed, amountSats: preview?.satoshis ?? undefined }) : await wallet.lightningSendAsset({ rgbInvoice: trimmed });
      setResult(r);
    } catch (e: any) {
      console.warn('LN send failed:', e);
      setError(e?.message ?? 'Failed to send over Lightning');
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = async () => {
    setError(null);
    if (!trimmed) {
      setError('Paste or scan an invoice.');
      return;
    }
    // BOLT11 invoices start with `ln` (lnbc/lntb/lntbs). RGB on-chain
    // invoices start with `rgb:` or `utxob:`. Auto-route by prefix:
    //  - `ln…` → payLightningInvoice (direct LN pay through our channel)
    //  - `rgb:` / `utxob:` → lightningSendAsset (LSP-mediated send)
    if (!isBolt11 && !isRgbInvoice) {
      setError('Expected a BOLT11 (ln…) or RGB (rgb:/utxob:) invoice.');
      return;
    }
    if (isRgbInvoice) {
      // LSP-mediated asset send: the BOLT11 amount the LSP fronts is only
      // known server-side, so make the user confirm what we CAN show
      // (decoded asset amount) instead of firing blind.
      const amountLine = rgbPreview?.amount != null ? `${rgbPreview.amount} asset units` : 'an amount set by the recipient (could not decode)';
      Alert.alert('Confirm send', `This pays ${amountLine} via the LSP. The LSP will front a Lightning payment that your wallet then pays. Continue?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', style: 'default', onPress: () => void doSend() },
      ]);
      return;
    }
    await doSend();
  };

  // Poll listPaymentsRaw while the initial result is Pending so the
  // "Payment pending" screen flips to Sent/Failed once the SDK observes
  // the final HTLC outcome. Without this, a payment that started Pending
  // and later Failed would sit forever on the pending screen and mislead
  // the user. `result.txid` is the paymentHash from payLightningInvoice.
  useEffect(() => {
    if (!result?.txid) return;
    const initial = (result.status ?? '').toString().toUpperCase();
    if (initial === 'SUCCEEDED' || initial === 'FAILED' || initial === 'CANCELLED') return;
    if (network !== NETWORK_RGB_TESTNET) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
        if (cancelled || !(wallet instanceof RgbWallet)) return;
        const payments = await wallet.listLnPayments();
        const p = payments.find((x) => x.paymentHash === result.txid);
        if (!p || cancelled) return;
        const nextStatus = (p.status ?? '').toString();
        const nextNorm = nextStatus.toUpperCase();
        if (nextNorm !== initial) {
          setResult({ ...result, status: nextStatus });
        }
        if (nextNorm === 'SUCCEEDED' || nextNorm === 'FAILED' || nextNorm === 'CANCELLED') {
          clearInterval(interval);
        }
      } catch {
        // best-effort — next tick will retry
      }
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [result, network, accountNumber]);

  // Network gate lives BELOW every hook call — an early return between
  // hooks violates the Rules of Hooks (hook count changes when `network`
  // changes, which crashes the reconciler).
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

  if (result) {
    // The RLN SDK's payLightningInvoice returns a status field: 'Succeeded' /
    // 'Pending' / 'Failed'. Absent status = older/unknown format, treat as
    // pending. Anything not-Succeeded is NOT a green check — surface the
    // failure loudly so the user knows to retry, and don't hide the txid /
    // status so we can attribute it in the log.
    const rawStatus = result.status ?? 'unknown';
    const normalized = rawStatus.toString().toLowerCase();
    const outcome: 'success' | 'pending' | 'failed' = normalized.includes('succe') ? 'success' : normalized.includes('pend') ? 'pending' : normalized.includes('fail') ? 'failed' : 'pending';
    const iconName = outcome === 'success' ? 'checkmark-circle' : outcome === 'failed' ? 'close-circle' : 'time';
    const iconColor = outcome === 'success' ? '#4CAF50' : outcome === 'failed' ? '#FF6B6B' : '#F5C518';
    const title = outcome === 'success' ? 'Payment sent' : outcome === 'failed' ? 'Payment failed' : 'Payment pending';

    return (
      <RadialGradientScreen network={network}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title={outcome === 'success' ? 'Sent' : outcome === 'failed' ? 'Failed' : 'Pending'} />
        <View style={styles.body}>
          <View style={styles.successCard}>
            <Ionicons name={iconName} size={64} color={iconColor} style={styles.successIcon} />
            <ThemedText style={styles.successTitle}>{title}</ThemedText>
            <ThemedText style={styles.successSubtitle}>Status: {rawStatus}</ThemedText>
            {result.txid ? <ThemedText style={styles.hash}>Txid: {result.txid}</ThemedText> : null}
            {outcome === 'failed' ? (
              <ThemedText style={styles.failedHint}>
                The payment was submitted to the LN node but did not settle. Check channel liquidity and route availability; the funds stay in your wallet.
              </ThemedText>
            ) : null}
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

        {trimmed && isBolt11 && preview ? (
          <View style={styles.previewCard}>
            <ThemedText style={styles.previewTitle}>Invoice preview</ThemedText>
            <ThemedText style={styles.previewRow}>Amount: {preview.satoshis != null ? `${preview.satoshis.toLocaleString()} sat` : 'not specified (variable)'}</ThemedText>
            {assetPreview?.assetId ? (
              <ThemedText style={styles.previewRow}>
                Asset: {assetPreview.assetAmount ?? '?'} {assetPreview.symbol ?? 'units'}
              </ThemedText>
            ) : null}
            {preview.description ? <ThemedText style={styles.previewRow}>Note: {preview.description}</ThemedText> : null}
            <ThemedText style={[styles.previewRow, preview.expired ? styles.previewExpired : null]}>
              {preview.expired ? 'Expired' : `Expires in ${Math.round(preview.expirySec ?? 3600)}s from issue`}
            </ThemedText>
          </View>
        ) : null}
        {trimmed && isBolt11 && !preview ? <ThemedText style={styles.previewMuted}>Could not decode BOLT11 — check the invoice text.</ThemedText> : null}
        {trimmed && isRgbInvoice ? (
          <View style={styles.previewCard}>
            <ThemedText style={styles.previewTitle}>RGB invoice preview</ThemedText>
            <ThemedText style={styles.previewRow}>Asset amount: {rgbPreview?.amount != null ? rgbPreview.amount.toLocaleString() : 'not specified in invoice'}</ThemedText>
            <ThemedText style={styles.previewMuted}>The LSP fronts a BOLT11 for this send; you confirm before paying.</ThemedText>
          </View>
        ) : null}

        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

        <Button title={isSending ? 'Sending…' : 'Send'} onPress={handleSend} disabled={isSending} />

        <ThemedText style={styles.helpText}>
          {isBolt11
            ? 'Pays the BOLT11 directly through your LN channel. Route hints in the invoice pick the intermediary node.'
            : isRgbInvoice
              ? 'The LSP fronts the BOLT11 payment; our wallet pays it, the LSP forwards the RGB asset to the recipient on settle.'
              : 'Paste a BOLT11 (ln…) invoice for direct LN pay, or an RGB invoice (rgb:/utxob:) for LSP-mediated send.'}
        </ThemedText>
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
  previewCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 12, gap: 4 },
  previewTitle: { color: '#ddd', fontSize: 13, fontWeight: '600' },
  previewRow: { color: '#ccc', fontSize: 13 },
  previewExpired: { color: '#FF6B6B' },
  previewMuted: { color: '#888', fontSize: 12 },
  failedHint: { color: '#FF6B6B', fontSize: 12, textAlign: 'center', marginTop: 8, paddingHorizontal: 16 },
});
