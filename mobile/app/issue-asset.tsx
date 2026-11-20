import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import React, { useContext, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import Button from '@/components/Button';
import RadialGradientScreen from '@/components/RadialGradientScreen';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import { ThemedText } from '@/components/ThemedText';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { RgbWallet } from '@shared/class/wallets/rgb-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { NETWORK_RGB, NETWORK_RGB_TESTNET } from '@shared/types/networks';

type IssuedAsset = { assetId: string; ticker: string; name: string; precision: number };

// rgb-lib's "no spendable colorable UTXO available for issuance" error name. The
// RN binding surfaces it via `code` and as a substring of the message; either
// form means the user needs to run createUtxos() first.
function isNoUtxoSlots(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  if (err?.code === 'InsufficientAllocationSlots') return true;
  const msg = String(err?.message ?? e);
  return /InsufficientAllocationSlots|insufficient.*allocation/i.test(msg);
}

export default function IssueAssetScreen() {
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);

  const [ticker, setTicker] = useState('');
  const [name, setName] = useState('');
  const [precisionStr, setPrecisionStr] = useState('8');
  const [amountStr, setAmountStr] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [needsUtxos, setNeedsUtxos] = useState(false);
  const [isCreatingUtxos, setIsCreatingUtxos] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);
  const [result, setResult] = useState<IssuedAsset | null>(null);

  if (network !== NETWORK_RGB && network !== NETWORK_RGB_TESTNET) {
    return (
      <RadialGradientScreen network={network}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Issue RGB Asset" />
        <View style={styles.body}>
          <ThemedText style={styles.error}>Switch to an RGB network to issue assets.</ThemedText>
        </View>
      </RadialGradientScreen>
    );
  }

  const precision = Number(precisionStr);
  const amount = Number(amountStr);
  const trimmedTicker = ticker.trim();
  const trimmedName = name.trim();

  const validation =
    !trimmedTicker || trimmedTicker.length > 8
      ? 'Ticker must be 1-8 characters.'
      : !trimmedName
        ? 'Name is required.'
        : !Number.isInteger(precision) || precision < 0 || precision > 18
          ? 'Precision must be an integer between 0 and 18.'
          : !Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(amount)
            ? 'Amount must be a positive integer (in base units).'
            : null;

  const submit = async () => {
    setError(null);
    setIsIssuing(true);
    try {
      const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
      if (!(wallet instanceof RgbWallet)) throw new Error('Wallet is not an RgbWallet');
      const issued = await wallet.issueAssetNia({
        ticker: trimmedTicker,
        name: trimmedName,
        precision,
        amounts: [amount],
      });
      setResult(issued);
      setNeedsUtxos(false);
    } catch (e: any) {
      console.warn('issueAssetNia failed:', e);
      if (isNoUtxoSlots(e)) {
        setNeedsUtxos(true);
        setError('You need a colorable UTXO before issuing an asset. Tap "Create UTXO" to make one (uses a small amount of testnet sats).');
      } else {
        setError(e?.message ?? 'Failed to issue asset');
      }
    } finally {
      setIsIssuing(false);
    }
  };

  const createUtxos = async () => {
    setError(null);
    setIsCreatingUtxos(true);
    try {
      const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
      if (!(wallet instanceof RgbWallet)) throw new Error('Wallet is not an RgbWallet');
      await wallet.createUtxos();
      setNeedsUtxos(false);
      // Auto-retry the issuance after the UTXO-creation tx is broadcast. The
      // SDK confirms this synchronously enough that issueAssetNia can proceed.
      await submit();
    } catch (e: any) {
      console.warn('createUtxos failed:', e);
      setError(e?.message ?? 'Failed to create UTXO. Make sure the wallet has some testnet sats.');
    } finally {
      setIsCreatingUtxos(false);
    }
  };

  const copyAssetId = async () => {
    if (!result) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(result.assetId);
    Alert.alert('Copied', 'Asset ID copied to clipboard.');
  };

  if (result) {
    return (
      <RadialGradientScreen network={network}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Asset Issued" />
        <View style={styles.body}>
          <ThemedText style={styles.label}>Ticker</ThemedText>
          <ThemedText style={styles.value}>{result.ticker}</ThemedText>
          <ThemedText style={[styles.label, styles.spaced]}>Name</ThemedText>
          <ThemedText style={styles.value}>{result.name}</ThemedText>
          <ThemedText style={[styles.label, styles.spaced]}>Asset ID</ThemedText>
          <ThemedText style={[styles.value, styles.assetId]} selectable>
            {result.assetId}
          </ThemedText>
          <View style={styles.buttonStack}>
            <Button title="Copy Asset ID" variant="lighter" onPress={copyAssetId} />
            <Button title="Done" onPress={() => router.back()} />
          </View>
        </View>
      </RadialGradientScreen>
    );
  }

  const submitDisabled = isIssuing || isCreatingUtxos || !!validation;

  return (
    <RadialGradientScreen network={network}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Issue RGB Asset" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <ThemedText style={styles.label}>Ticker</ThemedText>
          <TextInput
            style={styles.input}
            value={ticker}
            onChangeText={(t) => setTicker(t.toUpperCase().replace(/\s+/g, ''))}
            placeholder="e.g. DEMO"
            placeholderTextColor="rgba(255,255,255,0.4)"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            testID="IssueAsset.Ticker"
          />

          <ThemedText style={[styles.label, styles.spaced]}>Name</ThemedText>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Demo Token" placeholderTextColor="rgba(255,255,255,0.4)" maxLength={256} testID="IssueAsset.Name" />

          <ThemedText style={[styles.label, styles.spaced]}>Precision (decimals)</ThemedText>
          <TextInput
            style={styles.input}
            value={precisionStr}
            onChangeText={(t) => setPrecisionStr(t.replace(/[^0-9]/g, ''))}
            placeholder="8"
            placeholderTextColor="rgba(255,255,255,0.4)"
            keyboardType="number-pad"
            maxLength={2}
            testID="IssueAsset.Precision"
          />

          <ThemedText style={[styles.label, styles.spaced]}>Amount (base units)</ThemedText>
          <TextInput
            style={styles.input}
            value={amountStr}
            onChangeText={(t) => setAmountStr(t.replace(/[^0-9]/g, ''))}
            placeholder="1000"
            placeholderTextColor="rgba(255,255,255,0.4)"
            keyboardType="number-pad"
            testID="IssueAsset.Amount"
          />

          {validation && !error && <ThemedText style={[styles.hint, styles.spaced]}>{validation}</ThemedText>}
          {error && <ThemedText style={[styles.error, styles.spaced]}>{error}</ThemedText>}

          <View style={styles.buttonStack}>
            {needsUtxos && <Button title="Create UTXO" variant="lighter" onPress={createUtxos} loading={isCreatingUtxos} disabled={isIssuing} />}
            <Button title="Issue Asset" onPress={submit} loading={isIssuing} disabled={submitDisabled} testID="IssueAsset.Submit" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </RadialGradientScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
  spaced: {
    marginTop: 16,
  },
  value: {
    color: 'white',
    fontSize: 16,
  },
  assetId: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 12,
  },
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
  hint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
  error: {
    color: '#ff8a8a',
    fontSize: 13,
  },
  buttonStack: {
    marginTop: 32,
    gap: 12,
  },
});
