import { Stack, useRouter } from 'expo-router';
import React, { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import Button from '@/components/Button';
import RadialGradientScreen from '@/components/RadialGradientScreen';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import { ThemedText } from '@/components/ThemedText';
import { RGB_LN_ASSETS } from '@/src/constants/rgb-lsp';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { RgbWallet } from '@shared/class/wallets/rgb-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { NETWORK_RGB_TESTNET } from '@shared/types/networks';
import type { RgbLnChannel } from '@shared/types/rgb-adapter';

/**
 * Debug/tools screen: open an LN channel to an arbitrary peer, e.g. the RGB
 * faucet bot's node (from `/getnodeinfo`). The canonical LSP-JIT path (see
 * `receive-rgb-ln.tsx`) handles the everyday user flow; this screen exists
 * to bootstrap outbound-loaded channels for P2P LN testing where no external
 * payer is available to seed the wallet with LN balance.
 *
 * Signet-only for the same reason as the LN receive/send screens — mainnet
 * constants aren't published yet, and dev-only surface shouldn't leak to
 * production users regardless.
 */
export default function RgbOpenChannelScreen() {
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);

  const [peerUri, setPeerUri] = useState('');
  const [capacitySatStr, setCapacitySatStr] = useState('40000');
  const [assetAmountStr, setAssetAmountStr] = useState('0');
  const [pushAssetAmountStr, setPushAssetAmountStr] = useState('0');
  const [assetIdStr, setAssetIdStr] = useState(RGB_LN_ASSETS.signet.usdt ?? '');
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openResponse, setOpenResponse] = useState<string | null>(null);
  const [channels, setChannels] = useState<RgbLnChannel[] | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (network !== NETWORK_RGB_TESTNET) router.replace('/(tabs)');
  }, [network, router]);

  const refreshChannels = async () => {
    if (network !== NETWORK_RGB_TESTNET) return; // gated by render + effect above
    setIsRefreshing(true);
    setError(null);
    try {
      const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
      if (!(wallet instanceof RgbWallet)) throw new Error('Wallet is not an RgbWallet');
      const list = await wallet.listLnChannels();
      setChannels(list);
    } catch (e: any) {
      setError(e?.message ?? 'listChannels failed');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refreshChannels().catch(() => {});
    // Only trigger once on mount; polling would race with an in-flight open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openChannel = async () => {
    setError(null);
    setOpenResponse(null);

    const peer = peerUri.trim();
    if (!/^[0-9a-f]{66}@[^:]+:\d+$/i.test(peer)) {
      setError('Peer must be in the form `pubkey@host:port`');
      return;
    }
    const capacitySat = Number(capacitySatStr);
    if (!Number.isSafeInteger(capacitySat) || capacitySat < 1_000) {
      setError('Capacity must be a positive integer sat value ≥ 1000');
      return;
    }
    const assetAmount = Number(assetAmountStr || '0');
    const pushAssetAmount = Number(pushAssetAmountStr || '0');
    if (!Number.isSafeInteger(assetAmount) || assetAmount < 0) {
      setError('Asset amount must be a non-negative integer');
      return;
    }
    if (!Number.isSafeInteger(pushAssetAmount) || pushAssetAmount < 0 || pushAssetAmount > assetAmount) {
      setError('Push asset amount must be a non-negative integer ≤ asset amount');
      return;
    }
    const assetId = assetIdStr.trim() || null;
    if (assetAmount > 0 && !assetId) {
      setError('Asset id is required when opening a colored channel');
      return;
    }

    if (network !== NETWORK_RGB_TESTNET) return;
    setIsOpening(true);
    try {
      const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
      if (!(wallet instanceof RgbWallet)) throw new Error('Wallet is not an RgbWallet');
      const response = await wallet.openLnChannel({
        peerPubkeyAndOptAddr: peer,
        capacitySat,
        pushMsat: 0,
        public: false,
        withAnchors: true,
        assetId: assetAmount > 0 ? assetId : null,
        assetAmount: assetAmount > 0 ? assetAmount : null,
        pushAssetAmount: assetAmount > 0 ? pushAssetAmount : null,
      });
      setOpenResponse(response.temporaryChannelId);
      await refreshChannels();
    } catch (e: any) {
      setError(e?.message ?? 'openChannel failed');
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <RadialGradientScreen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Open RGB LN Channel" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <ThemedText style={styles.hint}>Debug: open a channel to an arbitrary LN peer. Use for the faucet bot's node (from `/getnodeinfo`) when the LSP-JIT path isn&apos;t available.</ThemedText>

        <ThemedText style={styles.label}>Peer (pubkey@host:port)</ThemedText>
        <TextInput
          style={styles.input}
          placeholder="02abc…@lsp-signet.utexo.com:9735"
          placeholderTextColor="#999"
          autoCapitalize="none"
          autoCorrect={false}
          value={peerUri}
          onChangeText={setPeerUri}
        />

        <ThemedText style={styles.label}>Capacity (sats)</ThemedText>
        <TextInput style={styles.input} placeholder="40000" placeholderTextColor="#999" keyboardType="numeric" value={capacitySatStr} onChangeText={setCapacitySatStr} />

        <ThemedText style={styles.label}>Asset id (leave blank for plain-BTC channel)</ThemedText>
        <TextInput style={styles.input} placeholder="rgb:…" placeholderTextColor="#999" autoCapitalize="none" autoCorrect={false} value={assetIdStr} onChangeText={setAssetIdStr} />

        <ThemedText style={styles.label}>Asset amount (base units, local balance)</ThemedText>
        <TextInput style={styles.input} placeholder="0" placeholderTextColor="#999" keyboardType="numeric" value={assetAmountStr} onChangeText={setAssetAmountStr} />

        <ThemedText style={styles.label}>Push asset amount (base units, sent to peer)</ThemedText>
        <TextInput style={styles.input} placeholder="0" placeholderTextColor="#999" keyboardType="numeric" value={pushAssetAmountStr} onChangeText={setPushAssetAmountStr} />

        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
        {openResponse ? <ThemedText style={styles.success}>Opened. Temp channel id: {openResponse}</ThemedText> : null}

        <Button title={isOpening ? 'Opening…' : 'Open Channel'} onPress={openChannel} disabled={isOpening} />

        <View style={styles.divider} />

        <View style={styles.channelsHeader}>
          <ThemedText style={styles.sectionTitle}>Channels</ThemedText>
          <Button title={isRefreshing ? 'Refreshing…' : 'Refresh'} onPress={() => refreshChannels().catch(() => {})} disabled={isRefreshing} />
        </View>

        {isRefreshing && !channels ? <ActivityIndicator /> : null}
        {channels?.length === 0 ? <ThemedText style={styles.hint}>No channels yet.</ThemedText> : null}
        {channels?.map((c, i) => (
          <View key={c.channelId ?? i} style={styles.channelRow}>
            <ThemedText style={styles.channelPeer}>{c.peerPubkey ?? c.peer_pubkey ?? '?'}</ThemedText>
            <ThemedText style={styles.channelMeta}>
              usable={String(c.isUsable ?? c.is_usable ?? false)} · ready={String(c.isChannelReady ?? c.is_channel_ready ?? c.isReady ?? c.is_ready ?? false)}
            </ThemedText>
            <ThemedText style={styles.channelMeta}>
              cap={c.channelValueSats ?? c.channel_value_sats ?? '?'} sat · out={Math.round((c.outboundBalanceMsat ?? c.outbound_balance_msat ?? 0) / 1000)} sat
            </ThemedText>
            {c.assetId || c.asset_id ? (
              <ThemedText style={styles.channelMeta}>
                asset={c.assetId ?? c.asset_id} local={c.assetLocalAmount ?? c.asset_local_amount ?? 0} remote={c.assetRemoteAmount ?? c.asset_remote_amount ?? 0}
              </ThemedText>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </RadialGradientScreen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 8 },
  hint: { fontSize: 12, opacity: 0.7 },
  label: { fontSize: 12, marginTop: 8, opacity: 0.8 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: 'white',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
  },
  error: { color: '#ff6b6b', marginTop: 8 },
  success: { color: '#4ade80', marginTop: 8 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  channelsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  channelRow: { padding: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, gap: 4 },
  channelPeer: { fontSize: 12, fontFamily: 'Menlo', color: '#8bd' },
  channelMeta: { fontSize: 11, opacity: 0.75 },
});
