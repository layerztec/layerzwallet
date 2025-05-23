import type { AssetBalance, PrepareSendRequest, PrepareSendResponse } from '@breeztech/breez-sdk-liquid';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { getBreezNetwork } from '@/src/modules/breeze-adapter';
import { BreezWallet } from '@shared/class/wallets/breez-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { formatBalance } from '@shared/modules/string-utils';
import { NETWORK_BREEZ, NETWORK_BREEZTESTNET } from '@shared/types/networks';

const SendLiquid = () => {
  const router = useRouter();
  const network = useContext(NetworkContext).network as typeof NETWORK_BREEZ | typeof NETWORK_BREEZTESTNET;
  const { accountNumber } = useContext(AccountNumberContext);
  const { scanQr } = useContext(ScanQrContext);
  const [address, setAddress] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [selectedAsset, setSelectedAsset] = useState<AssetBalance | null>(null);
  const [assets, setAssets] = useState<AssetBalance[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [prepareResult, setPrepareResult] = useState<PrepareSendResponse | null>(null);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  const getAssetName = (asset: AssetBalance): string => {
    return asset.ticker || asset.assetId.substring(0, 8) + '...';
  };

  useEffect(() => {
    const loadAssets = async () => {
      try {
        const mnemonic = await BackgroundExecutor.getSubMnemonic(accountNumber);
        const wallet = new BreezWallet(mnemonic, getBreezNetwork(network));
        const balances = await wallet.getAssetBalances();
        setAssets(balances);
        if (balances.length > 0) {
          setSelectedAsset(balances[0]);
        }
      } catch (err: any) {
        console.error('Failed to load assets:', err);
        setError('Failed to load assets: ' + err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadAssets();
  }, [network, accountNumber]);

  const handleAmountChange = (text: string) => {
    // Only allow numbers and decimal point
    if (text === '' || /^\d*\.?\d*$/.test(text)) {
      setAmount(text);
      setError('');
    }
  };

  const handleAddressChange = (text: string) => {
    setAddress(text);
    setError('');
  };

  const handleScanQR = async () => {
    const scanned = await scanQr();
    if (scanned) {
      setAddress(scanned);
    }
  };

  const validateInputs = (): boolean => {
    if (!address || address.trim() === '') {
      setError('Please enter a valid Liquid address');
      return false;
    }

    if (!amount || amount === '') {
      setError('Please enter an amount');
      return false;
    }

    if (!selectedAsset) {
      setError('Please select an asset');
      return false;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      return false;
    }

    const balanceNum = selectedAsset.balanceSat;
    if (amountNum > balanceNum) {
      setError('Insufficient balance');
      return false;
    }

    return true;
  };

  const handleSend = async () => {
    if (!validateInputs() || !selectedAsset) {
      return;
    }

    setIsSending(true);
    setError('');

    try {
      const mnemonic = await BackgroundExecutor.getSubMnemonic(accountNumber);
      const wallet = new BreezWallet(mnemonic, getBreezNetwork(network));

      // Prepare the send payment
      const prepareRequest: PrepareSendRequest = {
        destination: address,
        amount: {
          type: 'asset',
          assetId: selectedAsset.assetId,
          receiverAmount: parseFloat(amount),
        },
      };

      const prepareResponse = await wallet.prepareSendPayment(prepareRequest);
      setPrepareResult(prepareResponse);
      setShowConfirm(true);
    } catch (err: any) {
      console.error('Failed to prepare transaction:', err);
      setError('Failed to prepare transaction: ' + err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleConfirmSend = async () => {
    if (!prepareResult || !selectedAsset) {
      return;
    }

    setIsSending(true);
    setError('');

    try {
      const mnemonic = await BackgroundExecutor.getSubMnemonic(accountNumber);
      const wallet = new BreezWallet(mnemonic, getBreezNetwork(network));
      await wallet.sendPayment({ prepareResponse: prepareResult });
      setIsSuccess(true);
    } catch (err: any) {
      console.error('Failed to send transaction:', err);
      setError('Failed to send transaction: ' + err.message);
    } finally {
      setIsSending(false);
      setShowConfirm(false);
    }
  };

  if (isSuccess) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ title: 'Send Liquid', headerShown: true }} />
        <ThemedView style={styles.successContainer}>
          <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
          <ThemedText style={styles.successText}>Transaction Sent!</ThemedText>
          <TouchableOpacity style={styles.button} onPress={() => router.back()}>
            <ThemedText style={styles.buttonText}>Back to Wallet</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ title: 'Send Liquid', headerShown: true }} />
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Loading assets...</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  if (showConfirm && prepareResult) {
    // it is always liquidAddress here, just make TS happy
    if (prepareResult.destination.type !== 'liquidAddress') {
      throw new Error('Invalid destination address');
    }

    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ title: 'Confirm Transaction', headerShown: true }} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedView style={styles.contentContainer}>
            <ThemedText style={styles.subtitle}>Transaction Details</ThemedText>

            <ThemedView style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Amount:</ThemedText>
              <ThemedText style={styles.detailValue}>
                {formatBalance(prepareResult.destination.addressData.amountSat!.toString(), 8, 8)} {selectedAsset?.ticker}
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Fee:</ThemedText>
              <ThemedText style={styles.detailValue}>{formatBalance((prepareResult.feesSat || 0).toString(), 8, 8)} sats</ThemedText>
            </ThemedView>

            <ThemedView>
              <ThemedText style={styles.detailLabel}>To Address:</ThemedText>
              <ThemedText style={styles.detailValue} numberOfLines={3}>
                {prepareResult.destination.addressData.address}
              </ThemedText>
            </ThemedView>

            <TouchableOpacity style={[styles.button, isSending && styles.disabledButton]} onPress={handleConfirmSend} disabled={isSending}>
              <ThemedText style={styles.buttonText}>{isSending ? 'Sending...' : 'Confirm & Send'}</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => setShowConfirm(false)}>
              <ThemedText style={styles.buttonText}>Cancel</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'Send Liquid', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.contentContainer}>
          <ThemedView style={[styles.networkBar, { backgroundColor: '#3498db' }]}>
            <ThemedText style={styles.networkText}>{network?.toUpperCase()} LIQUID</ThemedText>
          </ThemedView>

          <ThemedText style={styles.subtitle}>Select Asset</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.assetsContainer}>
            {assets.map((asset) => (
              <TouchableOpacity key={asset.assetId} onPress={() => setSelectedAsset(asset)} style={[styles.assetButton, selectedAsset?.assetId === asset.assetId && styles.selectedAssetButton]}>
                <ThemedText style={styles.assetTicker}>{getAssetName(asset)}</ThemedText>
                {asset.name && <ThemedText style={styles.assetFullName}>({asset.name})</ThemedText>}
                <ThemedText style={styles.assetBalance}>
                  {formatBalance(asset.balanceSat.toString(), 8, 8)} {asset.ticker}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ThemedText style={styles.inputLabel}>Recipient Address</ThemedText>
          <ThemedView style={styles.addressInputContainer}>
            <TextInput
              style={[styles.input, styles.addressInput]}
              placeholder="Enter Liquid address"
              placeholderTextColor="#888"
              value={address}
              onChangeText={handleAddressChange}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.scanButton} onPress={handleScanQR}>
              <Ionicons name="scan-outline" size={24} color="#000" />
            </TouchableOpacity>
          </ThemedView>

          <ThemedText style={styles.inputLabel}>Amount</ThemedText>
          <TextInput
            style={styles.input}
            placeholder={`Enter amount in ${selectedAsset?.ticker || ''}`}
            placeholderTextColor="#888"
            value={amount}
            onChangeText={handleAmountChange}
            keyboardType="decimal-pad"
          />

          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

          <TouchableOpacity style={[styles.button, isSending && styles.disabledButton]} onPress={handleSend} disabled={isSending}>
            <ThemedText style={styles.buttonText}>{isSending ? 'Sending...' : 'Send'}</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SendLiquid;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  contentContainer: {
    flex: 1,
    padding: 20,
  },
  networkBar: {
    marginBottom: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  networkText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 15,
  },
  assetsContainer: {
    marginBottom: 20,
  },
  assetButton: {
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    marginRight: 10,
    minWidth: 120,
  },
  selectedAssetButton: {
    backgroundColor: '#3498db',
  },
  assetTicker: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  assetFullName: {
    fontSize: 14,
    color: '#888',
    marginBottom: 5,
  },
  assetBalance: {
    fontSize: 14,
    color: '#666',
  },
  inputLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  errorText: {
    color: 'red',
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 20,
    marginBottom: 30,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  detailLabel: {
    fontSize: 16,
    color: '#666',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  cancelButton: {
    backgroundColor: '#e74c3c',
    marginTop: 10,
  },
  addressInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  addressInput: {
    flex: 1,
    marginRight: 10,
  },
  scanButton: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginTop: -20,
  },
});
