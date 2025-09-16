import type { AssetBalance, PrepareSendRequest, PrepareSendResponse } from '@breeztech/breez-sdk-liquid';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import GradientScreen from '@/components/GradientScreen';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import LongPressButton from '@/components/LongPressButton';
import { ThemedText } from '@/components/ThemedText';
import { AskMnemonicContext } from '@/src/hooks/AskMnemonicContext';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { BreezWallet, getBreezNetwork, LBTC_ASSET_IDS } from '@shared/class/wallets/breez-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { capitalizeFirstLetter, formatBalance } from '@shared/modules/string-utils';
import { NETWORK_LIQUID, NETWORK_LIQUID_TESTNET } from '@shared/types/networks';
import assert from 'assert';

export type SendLiquidParams = {
  assetId?: string; // Optional asset ID - if not provided, use L-BTC
  toAddress?: string;
  amount?: string;
};

const SendLiquid = () => {
  const router = useRouter();
  const params = useLocalSearchParams<SendLiquidParams>();

  const network = useContext(NetworkContext).network as typeof NETWORK_LIQUID | typeof NETWORK_LIQUID_TESTNET;
  const { accountNumber } = useContext(AccountNumberContext);
  const { scanQr } = useContext(ScanQrContext);
  const { askMnemonic } = useContext(AskMnemonicContext);

  const address = params.toAddress ?? '';
  const amount = params.amount ?? '';
  const [selectedAsset, setSelectedAsset] = useState<AssetBalance | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [prepareResult, setPrepareResult] = useState<PrepareSendResponse | null>(null);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  const getAssetName = (asset: AssetBalance): string => {
    return asset.ticker || asset.assetId.substring(0, 8) + '...';
  };

  const assetId = useMemo(() => {
    if (params.assetId) {
      return params.assetId;
    } else if (network === NETWORK_LIQUID) {
      return LBTC_ASSET_IDS.mainnet;
    } else {
      return LBTC_ASSET_IDS.testnet;
    }
  }, [params.assetId, network]);

  useEffect(() => {
    const loadAssets = async () => {
      try {
        const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
        assert(wallet instanceof BreezWallet);
        const balances = await wallet.getAssetBalances();
        const asset = balances.find((asset) => asset.assetId === assetId);
        if (asset) {
          setSelectedAsset(asset);
        } else {
          setError(`Asset not found: ${assetId}`);
        }
      } catch (err: any) {
        console.error('Failed to load assets:', err);
        setError('Failed to load assets: ' + err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadAssets();
  }, [network, accountNumber, assetId]);

  const handleAmountChange = (text: string) => {
    const normalizedText = text.replace(',', '.');
    if (normalizedText === '' || /^\d*\.?\d*$/.test(normalizedText)) {
      router.setParams({ amount: normalizedText });
      setError('');
    }
  };

  const handleAddressChange = (text: string) => {
    router.setParams({ toAddress: text });
    setError('');
  };

  const handleScanQR = async () => {
    const scanned = await scanQr();
    if (scanned) {
      router.setParams({ toAddress: scanned });
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
      setError('Asset not available');
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
      const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
      assert(wallet instanceof BreezWallet);

      // Prepare the send payment
      const prepareRequest: PrepareSendRequest = {
        destination: address,
        amount: {
          type: 'asset',
          toAsset: selectedAsset.assetId,
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
      await askMnemonic(); // verify password
      const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
      assert(wallet instanceof BreezWallet);
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
      <GradientScreen variant={network}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Send Liquid" />
        <View style={styles.successContainer}>
          <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
          <ThemedText style={styles.successText}>Transaction Sent!</ThemedText>
          <TouchableOpacity style={styles.button} onPress={() => router.replace('/Home')}>
            <ThemedText style={styles.buttonText}>Back to Wallet</ThemedText>
          </TouchableOpacity>
        </View>
      </GradientScreen>
    );
  }

  if (isLoading) {
    return (
      <GradientScreen variant={network}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Send Liquid" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="rgba(255, 255, 255, 0.8)" />
          <ThemedText style={styles.loadingText}>Loading asset...</ThemedText>
        </View>
      </GradientScreen>
    );
  }

  if (showConfirm && prepareResult) {
    // it is always liquidAddress here, just make TS happy
    if (prepareResult.destination.type !== 'liquidAddress') {
      throw new Error('Invalid destination address');
    }

    return (
      <GradientScreen variant={network}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Confirm Transaction" />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.contentContainer}>
            <ThemedText style={styles.subtitle}>Transaction Details</ThemedText>

            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Amount:</ThemedText>
              <ThemedText style={styles.detailValue}>
                {formatBalance(prepareResult.destination.addressData.amountSat!.toString(), 8, 8)} {selectedAsset?.ticker}
              </ThemedText>
            </View>

            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Fee:</ThemedText>
              <ThemedText style={styles.detailValue}>{formatBalance((prepareResult.feesSat || 0).toString(), 8, 8)} sats</ThemedText>
            </View>

            <View>
              <ThemedText style={styles.detailLabel}>To Address:</ThemedText>
              <ThemedText style={styles.detailValue} numberOfLines={3}>
                {prepareResult.destination.addressData.address}
              </ThemedText>
            </View>

            <LongPressButton
              style={styles.sendButton}
              textStyle={styles.sendButtonText}
              onLongPressComplete={handleConfirmSend}
              title={isSending ? 'Sending...' : 'Hold to confirm send'}
              progressColor="#FFFFFF"
              backgroundColor="#007AFF"
              disabled={isSending}
            />

            <TouchableOpacity style={[styles.button, styles.cancelButton, isSending && styles.disabledButton]} onPress={() => setShowConfirm(false)} disabled={isSending}>
              <ThemedText style={styles.buttonText}>Cancel</ThemedText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </GradientScreen>
    );
  }

  return (
    <GradientScreen variant={network}>
      <Stack.Screen options={{ headerShown: false }} />
      {selectedAsset ? <ScreenHeader title={`Send ${getAssetName(selectedAsset)}`} /> : null}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentContainer}>
          <View style={[styles.networkBar, { backgroundColor: '#3498db' }]}>
            <ThemedText style={styles.networkText}>on {capitalizeFirstLetter(network)} </ThemedText>
          </View>

          <ThemedText style={styles.inputLabel}>Recipient Address</ThemedText>
          <View style={styles.addressInputContainer}>
            <TextInput
              style={[styles.input, styles.addressInput]}
              placeholder="Enter Liquid address"
              placeholderTextColor="rgba(255, 255, 255, 0.6)"
              value={address}
              onChangeText={handleAddressChange}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.scanButton} onPress={handleScanQR}>
              <Ionicons name="qr-code-outline" size={20} color="rgba(255, 255, 255, 0.8)" />
            </TouchableOpacity>
          </View>

          <ThemedText style={styles.inputLabel}>Amount</ThemedText>
          <TextInput
            style={styles.input}
            placeholder={`Enter amount in ${selectedAsset?.ticker || ''}`}
            placeholderTextColor="rgba(255, 255, 255, 0.6)"
            value={amount}
            onChangeText={handleAmountChange}
            keyboardType="decimal-pad"
          />
          {selectedAsset && (
            <ThemedText style={styles.assetBalance}>
              Available: {formatBalance(selectedAsset.balanceSat.toString(), 8, 8)} {selectedAsset.ticker}
            </ThemedText>
          )}

          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

          <TouchableOpacity style={[styles.button, isSending && styles.disabledButton]} onPress={handleSend} disabled={isSending}>
            <ThemedText style={styles.buttonText}>{isSending ? 'Preparing...' : 'Prepare'}</ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </GradientScreen>
  );
};

export default SendLiquid;

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  contentContainer: {
    flex: 1,
  },
  networkBar: {
    marginBottom: 30,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.4)',
  },
  networkText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  subtitle: {
    marginBottom: 15,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  assetInfo: {
    marginBottom: 30,
    padding: 15,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  assetFullName: {
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 5,
  },
  assetBalance: {
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 20,
  },
  inputLabel: {
    marginBottom: 12,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 20,
  },
  errorText: {
    color: '#ff4444',
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#000000',
    padding: 15,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  buttonText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  successText: {
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 20,
    marginBottom: 30,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  detailLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  detailValue: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginTop: 10,
  },
  addressInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  addressInput: {
    flex: 1,
  },
  scanButton: {
    width: 50,
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
  },
  sendButton: {
    backgroundColor: '#000000',
    padding: 15,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  sendButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
});
