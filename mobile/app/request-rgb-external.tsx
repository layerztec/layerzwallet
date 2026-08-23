import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Stack, useRouter } from 'expo-router';
import React, { useContext, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
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
import { NETWORK_RGB_TESTNET } from '@shared/types/networks';
import type { RgbLnExternalInvoice } from '@shared/types/rgb-adapter';

/**
 * "Request an invoice for an external payer" (rgb-sdk-rn beta.29). Quotes a
 * plain, hosted BOLT11 that ANY Lightning node can pay — the RGB contract id
 * and amount ride inside the invoice, so the payer never learns APay/LNURL/this
 * SDK exist. The LSP delivers our payout asset once the payer settles.
 */
export default function RequestRgbExternalScreen() {
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);

  const [satsStr, setSatsStr] = useState('');
  const [assetStr, setAssetStr] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<RgbLnExternalInvoice | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setError(null);
    if (network !== NETWORK_RGB_TESTNET) return;
    const sats = Number(satsStr);
    const assetAmount = Number(assetStr);
    if (!Number.isFinite(sats) || sats <= 0 || !Number.isSafeInteger(sats)) {
      setError('Sats amount must be a positive integer.');
      return;
    }
    if (!Number.isFinite(assetAmount) || assetAmount <= 0 || !Number.isSafeInteger(assetAmount)) {
      setError('Asset amount must be a positive integer (base units).');
      return;
    }
    setLoading(true);
    try {
      const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
      if (!(wallet instanceof RgbWallet)) throw new Error('Wallet is not an RgbWallet');
      if (!wallet.requestExternalInvoice) throw new Error('requestExternalInvoice not supported by this build');
      const inv = await wallet.requestExternalInvoice({ amtMsat: sats * 1000, assetAmount });
      setInvoice(inv);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to request external invoice');
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!invoice?.invoice) return;
    await Clipboard.setStringAsync(invoice.invoice);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <RadialGradientScreen network={network}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="External invoice" />
      <ScrollView contentContainerStyle={styles.body}>
        {network !== NETWORK_RGB_TESTNET ? (
          <ThemedText style={styles.error}>Only enabled on RGB signet right now.</ThemedText>
        ) : invoice ? (
          <>
            <View style={styles.qrWrap}>
              <QRCode value={invoice.invoice} size={220} backgroundColor="white" />
            </View>
            <Pressable onPress={copy} style={styles.addrRow}>
              <ThemedText style={styles.mono} numberOfLines={3}>
                {invoice.invoice}
              </ThemedText>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color="#aaa" />
            </Pressable>
            <ThemedText style={styles.hint}>
              Quoted in {invoice.asset?.ticker ?? 'asset'} {invoice.converted ? '(you receive your payout asset, LSP converts 1:1)' : '(no conversion)'}
            </ThemedText>
            <ThemedText style={styles.help}>Any Lightning node can pay this BOLT11. The RGB contract id + amount are inside it.</ThemedText>
            <Button title="Done" onPress={() => router.back()} />
          </>
        ) : (
          <>
            <ThemedText style={styles.label}>Amount in sats</ThemedText>
            <TextInput style={styles.inputSingle} value={satsStr} onChangeText={setSatsStr} placeholder="e.g. 3000" placeholderTextColor="#888" keyboardType="numeric" />
            <ThemedText style={styles.label}>Asset amount (base units)</ThemedText>
            <TextInput style={styles.inputSingle} value={assetStr} onChangeText={setAssetStr} placeholder="e.g. 1000000" placeholderTextColor="#888" keyboardType="numeric" />
            {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
            <Button title={loading ? 'Requesting…' : 'Generate invoice'} onPress={generate} disabled={loading} />
          </>
        )}
      </ScrollView>
    </RadialGradientScreen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 14, alignItems: 'center' },
  label: { fontSize: 14, opacity: 0.7, alignSelf: 'flex-start' },
  inputSingle: { alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.08)', color: 'white', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  qrWrap: { backgroundColor: 'white', padding: 16, borderRadius: 12 },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 },
  mono: { flex: 1, color: 'white', fontSize: 12, fontFamily: 'Courier' },
  hint: { color: '#aaa', fontSize: 13, textAlign: 'center' },
  help: { color: '#888', fontSize: 13, textAlign: 'center', paddingHorizontal: 8 },
  error: { color: '#FF6B6B', fontSize: 14 },
});
