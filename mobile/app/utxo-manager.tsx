import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Stack } from 'expo-router';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import Button from '@/components/Button';
import RadialGradientScreen from '@/components/RadialGradientScreen';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import { ThemedText } from '@/components/ThemedText';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { RgbWallet, type RgbUnspent } from '@shared/class/wallets/rgb-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { NETWORK_RGB, NETWORK_RGB_TESTNET } from '@shared/types/networks';

const DEFAULT_NUM = '5';
const DEFAULT_SIZE = '1000';
// Mirrors RgbWallet.defaultFeeRate(): 1 sat/vB on testnet, 5 on mainnet. Kept
// here so the debug screen doesn't need to widen the public wallet API.
const defaultFeeRateFor = (n: string) => (n === NETWORK_RGB_TESTNET ? '1' : '5');

function truncMid(s: string, head = 8, tail = 8): string {
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export default function UtxoManagerScreen() {
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);

  const [unspents, setUnspents] = useState<RgbUnspent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createdHint, setCreatedHint] = useState<string | null>(null);

  const [numStr, setNumStr] = useState(DEFAULT_NUM);
  const [sizeStr, setSizeStr] = useState(DEFAULT_SIZE);
  const [feeRateStr, setFeeRateStr] = useState(defaultFeeRateFor(network));

  const refresh = useCallback(async () => {
    if (network !== NETWORK_RGB && network !== NETWORK_RGB_TESTNET) return;
    setError(null);
    setIsLoading(true);
    try {
      const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
      if (!(wallet instanceof RgbWallet)) throw new Error('Wallet is not an RgbWallet');
      const list = await wallet.listUnspents();
      setUnspents(list);
    } catch (e: any) {
      console.warn('listUnspents failed:', e);
      setError(e?.message ?? 'Failed to list UTXOs');
    } finally {
      setIsLoading(false);
    }
  }, [network, accountNumber]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (network !== NETWORK_RGB && network !== NETWORK_RGB_TESTNET) {
    return (
      <RadialGradientScreen network={network}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="UTXO Manager" />
        <View style={styles.body}>
          <ThemedText style={styles.error}>Switch to an RGB network to inspect UTXOs.</ThemedText>
        </View>
      </RadialGradientScreen>
    );
  }

  const num = Number(numStr);
  const size = Number(sizeStr);
  const feeRate = Number(feeRateStr);

  const validation =
    !Number.isInteger(num) || num <= 0
      ? 'Num must be a positive integer.'
      : !Number.isInteger(size) || size <= 0
        ? 'Size must be a positive integer (sats).'
        : !Number.isFinite(feeRate) || feeRate <= 0
          ? 'Fee rate must be > 0 (sat/vB).'
          : null;

  const create = async () => {
    if (network !== NETWORK_RGB && network !== NETWORK_RGB_TESTNET) return;
    setError(null);
    setCreatedHint(null);
    setIsCreating(true);
    try {
      const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
      if (!(wallet instanceof RgbWallet)) throw new Error('Wallet is not an RgbWallet');
      const created = await wallet.createUtxos({ num, size, feeRate, upTo: true });
      setCreatedHint(`+${created} UTXO${created === 1 ? '' : 's'} requested (broadcasting…)`);
      await refresh();
    } catch (e: any) {
      console.warn('createUtxos failed:', e);
      const msg = e?.message ?? 'Failed to create UTXOs';
      setError(msg);
      Alert.alert('Create UTXOs failed', msg);
    } finally {
      setIsCreating(false);
    }
  };

  const copy = async (text: string, label: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', `${label} copied to clipboard.`);
  };

  return (
    <RadialGradientScreen network={network}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="UTXO Manager" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor="white" />}>
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Issue UTXOs</ThemedText>

            <View style={styles.row}>
              <View style={styles.col}>
                <ThemedText style={styles.label}>Num</ThemedText>
                <TextInput
                  style={styles.input}
                  value={numStr}
                  onChangeText={(t) => setNumStr(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  testID="UtxoManager.Num"
                />
              </View>
              <View style={styles.col}>
                <ThemedText style={styles.label}>Size (sats)</ThemedText>
                <TextInput
                  style={styles.input}
                  value={sizeStr}
                  onChangeText={(t) => setSizeStr(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  testID="UtxoManager.Size"
                />
              </View>
              <View style={styles.col}>
                <ThemedText style={styles.label}>Fee (sat/vB)</ThemedText>
                <TextInput
                  style={styles.input}
                  value={feeRateStr}
                  onChangeText={(t) => setFeeRateStr(t.replace(/[^0-9.]/g, ''))}
                  keyboardType="decimal-pad"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  testID="UtxoManager.FeeRate"
                />
              </View>
            </View>

            {validation && !error && <ThemedText style={[styles.hint, styles.spaced]}>{validation}</ThemedText>}
            {createdHint && <ThemedText style={[styles.success, styles.spaced]}>{createdHint}</ThemedText>}
            {error && <ThemedText style={[styles.error, styles.spaced]}>{error}</ThemedText>}

            <View style={styles.buttonStack}>
              <Button title="Create UTXOs" onPress={create} loading={isCreating} disabled={!!validation || isCreating} testID="UtxoManager.Create" />
              <Button title="Refresh" variant="lighter" onPress={refresh} loading={isLoading} disabled={isLoading} testID="UtxoManager.Refresh" />
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>UTXOs ({unspents?.length ?? 0})</ThemedText>
            {unspents && unspents.length === 0 && <ThemedText style={[styles.hint, styles.spaced]}>No UTXOs yet — fund the wallet with sats first (run ~/z/rgb-faucet.sh on testnet).</ThemedText>}
            {unspents?.map((u, idx) => {
              const op = `${u.utxo.outpoint.txid}:${u.utxo.outpoint.vout}`;
              return (
                <View key={`${op}-${idx}`} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <TouchableOpacity onPress={() => copy(op, 'Outpoint')}>
                      <ThemedText style={styles.outpoint}>{`${truncMid(u.utxo.outpoint.txid, 10, 6)}:${u.utxo.outpoint.vout}`}</ThemedText>
                    </TouchableOpacity>
                    <ThemedText style={styles.sats}>{u.utxo.btcAmount} sats</ThemedText>
                  </View>
                  <View style={styles.badges}>
                    <View style={[styles.badge, u.utxo.colorable ? styles.badgeOk : styles.badgeMuted]}>
                      <ThemedText style={styles.badgeText}>{u.utxo.colorable ? 'colorable' : 'not colorable'}</ThemedText>
                    </View>
                    {u.pendingBlinded > 0 && (
                      <View style={[styles.badge, styles.badgeWarn]}>
                        <ThemedText style={styles.badgeText}>blinded {u.pendingBlinded}</ThemedText>
                      </View>
                    )}
                    {(u.rgbAllocations?.length ?? 0) === 0 && u.pendingBlinded === 0 && u.utxo.colorable && (
                      <View style={[styles.badge, styles.badgeMuted]}>
                        <ThemedText style={styles.badgeText}>free slot</ThemedText>
                      </View>
                    )}
                  </View>
                  {u.rgbAllocations?.map((a, i) => (
                    <View key={`alloc-${i}`} style={styles.allocation}>
                      <TouchableOpacity onPress={() => a.assetId && copy(a.assetId, 'Asset ID')} disabled={!a.assetId}>
                        <ThemedText style={styles.allocAssetId}>{a.assetId ? truncMid(a.assetId, 10, 8) : '(no asset id)'}</ThemedText>
                      </TouchableOpacity>
                      {/* Dump the raw assignment JSON: the iOS RN binding's serialization
                          of `Assignment` doesn't match the SDK's TS type (emits
                          `{type:"type",amount:null}`), and for a debug screen the raw
                          shape is more useful than a guess. Tracked upstream:
                          https://github.com/UTEXO-Protocol/rgb-sdk-rn/issues/22 */}
                      <ThemedText style={styles.allocLine}>
                        {JSON.stringify(a.assignment)} · {a.settled ? 'settled' : 'pending'}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </RadialGradientScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  col: {
    flex: 1,
  },
  label: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
  },
  spaced: { marginTop: 12 },
  input: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    color: 'white',
    fontSize: 14,
  },
  hint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
  error: {
    color: '#ff8a8a',
    fontSize: 13,
  },
  success: {
    color: '#9ce39c',
    fontSize: 13,
  },
  buttonStack: {
    marginTop: 16,
    gap: 8,
  },
  card: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  outpoint: {
    color: 'white',
    fontSize: 13,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  sats: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeOk: { backgroundColor: 'rgba(80, 200, 120, 0.25)' },
  badgeWarn: { backgroundColor: 'rgba(255, 165, 0, 0.30)' },
  badgeMuted: { backgroundColor: 'rgba(255,255,255,0.10)' },
  badgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '500',
  },
  allocation: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  allocAssetId: {
    color: 'white',
    fontSize: 12,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  allocLine: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
});
