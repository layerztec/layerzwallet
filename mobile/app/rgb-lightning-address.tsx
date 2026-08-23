import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Stack, useRouter } from 'expo-router';
import React, { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
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
import type { RgbLnAddressInfo } from '@shared/types/rgb-adapter';

/**
 * "My Lightning address" — registers (idempotently) this wallet's LSP-hosted
 * Lightning Address for offline receive (rgb-sdk-rn beta.29 two-asset flow).
 * A payer resolves the address via LNURL and pays in any accepted asset; the
 * LSP delivers our payout asset (LNUSDT).
 */
export default function RgbLightningAddressScreen() {
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);

  const [info, setInfo] = useState<RgbLnAddressInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (network !== NETWORK_RGB_TESTNET) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
        if (cancelled || !(wallet instanceof RgbWallet)) return;
        if (!wallet.enableLightningAddress) throw new Error('Lightning address not supported by this build');
        const a = await wallet.enableLightningAddress();
        if (!cancelled) setInfo(a);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to enable Lightning address');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [network, accountNumber]);

  const copy = async () => {
    if (!info?.address) return;
    await Clipboard.setStringAsync(info.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <RadialGradientScreen network={network}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="My Lightning address" />
      <ScrollView contentContainerStyle={styles.body}>
        {network !== NETWORK_RGB_TESTNET ? (
          <ThemedText style={styles.error}>Lightning addresses are only enabled on RGB signet right now.</ThemedText>
        ) : loading ? (
          <ActivityIndicator />
        ) : error ? (
          <ThemedText style={styles.error}>{error}</ThemedText>
        ) : info ? (
          <>
            <View style={styles.qrWrap}>
              <QRCode value={`lightning:${info.address}`} size={220} backgroundColor="white" />
            </View>
            <Pressable onPress={copy} style={styles.addrRow}>
              <ThemedText style={styles.addr}>{info.address}</ThemedText>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color="#aaa" />
            </Pressable>
            {typeof info.unusedHashes === 'number' ? <ThemedText style={styles.hint}>{info.unusedHashes} receive slots available</ThemedText> : null}
            <ThemedText style={styles.help}>Share this address to receive. Anyone can pay it from a compatible wallet; the LSP delivers your payout asset (LNUSDT).</ThemedText>
          </>
        ) : null}
        <Button title="Done" onPress={() => router.back()} />
      </ScrollView>
    </RadialGradientScreen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 16, alignItems: 'center' },
  qrWrap: { backgroundColor: 'white', padding: 16, borderRadius: 12 },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addr: { color: 'white', fontSize: 15, fontFamily: 'Courier' },
  hint: { color: '#aaa', fontSize: 13 },
  help: { color: '#888', fontSize: 13, textAlign: 'center', paddingHorizontal: 8 },
  error: { color: '#FF6B6B', fontSize: 14, textAlign: 'center' },
});
