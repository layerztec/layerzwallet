import { useNavigation } from '@react-navigation/native';
import assert from 'assert';
import BigNumber from 'bignumber.js';
import * as bip21 from 'bip21';
import { Stack } from 'expo-router';
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import GradientScreen from '@/components/GradientScreen';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import LongPressButton from '@/components/LongPressButton';
import { ThemedText } from '@/components/ThemedText';
import { AskMnemonicContext } from '@/src/hooks/AskMnemonicContext';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import * as BlueElectrum from '@shared/blue_modules/BlueElectrum';
import { TFeeEstimate } from '@shared/blue_modules/BlueElectrum';
import { HDSegwitBech32Wallet } from '@shared/class/wallets/hd-segwit-bech32-wallet';
import { CreateTransactionTarget, CreateTransactionUtxo } from '@shared/class/wallets/types';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useBalance } from '@shared/hooks/useBalance';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { formatBalance } from '@shared/modules/string-utils';

type TFeeRateOptions = { [rate: number]: number };

const SendBtc: React.FC = () => {
  const { scanQr } = useContext(ScanQrContext);
  const navigation = useNavigation();
  const [toAddress, setToAddress] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isPreparing, setIsPreparing] = useState<boolean>(false);
  const [isPrepared, setIsPrepared] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [customFeeRate, setCustomFeeRate] = useState<number | undefined>();
  const [estimateFees, setEstimateFees] = useState<undefined | TFeeEstimate>();
  const [sendData, setSendData] = useState<undefined | { utxos: CreateTransactionUtxo[]; changeAddress: string }>(undefined);
  const [txhex, setTxhex] = useState<string>('');
  const [actualFee, setActualFee] = useState<number>();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { askMnemonic } = useContext(AskMnemonicContext);
  const { balance } = useBalance(network, accountNumber, BackgroundExecutor);
  const [showFeeModal, setShowFeeModal] = useState(false);
  const wallet = useRef(new HDSegwitBech32Wallet());

  const handleAmountChange = (text: string) => {
    const normalizedText = text.replace(',', '.');
    if (normalizedText === '' || /^\d*\.?\d*$/.test(normalizedText)) {
      setAmount(normalizedText);
      setError('');
    }
  };

  const feeRate = useMemo(() => {
    if (customFeeRate !== undefined) return customFeeRate;
    if (estimateFees) return estimateFees.medium;
    return 1;
  }, [customFeeRate, estimateFees]);

  // for each value from estimateFees we calculate the actual fee for the transaction
  const feeRateOptions: TFeeRateOptions = useMemo(() => {
    if (!sendData?.utxos) {
      return {};
    }
    const options = new Set<number>([feeRate]);
    if (estimateFees) {
      options.add(estimateFees.slow);
      options.add(estimateFees.medium);
      options.add(estimateFees.fast);
    }

    // construct targets, if something goes wrong, we will try to construct a transaction with minimum amount
    const satValueBN = new BigNumber(parseFloat(amount));
    const satValue = satValueBN.multipliedBy(new BigNumber(10).pow(getDecimalsByNetwork(network))).toNumber();
    const targets: CreateTransactionTarget[] = [
      {
        address: wallet.current.isAddressValid(toAddress) ? toAddress : '36JxaUrpDzkEerkTf1FzwHNE1Hb7cCjgJV',
        value: Number.isNaN(satValue) ? 546 : satValue,
      },
    ];

    // for each fee rate, we try to construct a transaction and calculate the fee
    const result: { [key: number]: number } = {};
    Array.from(options).forEach((v) => {
      try {
        const { fee } = wallet.current.coinselect(sendData.utxos, targets, v);
        result[v] = fee;
      } catch (e: any) {
        if (e.message.includes('Not enough')) {
          // if we don't have enough funds, construct maximum possible transaction
          const targets2 = targets.map((t, index) => (index > 0 ? { ...t, value: 546 } : { address: t.address }));
          try {
            const { fee } = wallet.current.coinselect(sendData.utxos, targets2, v);
            result[v] = fee;
          } catch {}
        }
      }
    });

    return result;
  }, [feeRate, estimateFees, sendData?.utxos, amount, toAddress, network]);

  useEffect(() => {
    (async () => {
      try {
        if (!BlueElectrum.mainConnected) {
          await BlueElectrum.connectMain();
        }
        const r = await BlueElectrum.estimateFees();
        setEstimateFees(r);
      } catch (e) {
        console.info('Failed to fetch fees', e);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        console.log('Fetching UTXOs');
        const r = await BackgroundExecutor.getBtcSendData(accountNumber);
        setSendData(r);
        console.log('UTXOs fetched', r);
      } catch (e) {
        console.info('Failed to fetch UTXOs', e);
      }
    })();
  }, [accountNumber]);

  const broadcast = async () => {
    try {
      const result = await BlueElectrum.broadcastV2(txhex);
      if (!result) {
        throw new Error('Transaction failed');
      }

      setIsSuccess(true);
    } catch (error: any) {
      setError(error.message);
    }
  };

  const prepareTransaction = async () => {
    const w = wallet.current;
    setIsPreparing(true);
    setError('');
    try {
      // check amount
      assert(balance, 'internal error: balance not loaded');
      const amt = parseFloat(amount);
      assert(!isNaN(amt), 'Invalid amount');
      assert(amt > 0, 'Amount should be > 0');
      const satValueBN = new BigNumber(amt);
      const satValue = satValueBN.multipliedBy(new BigNumber(10).pow(getDecimalsByNetwork(network))).toString(10);
      assert(new BigNumber(balance).gte(satValue), 'Not enough balance');

      // check address
      assert(toAddress, 'recipient address empty');
      if (!w.isAddressValid(toAddress)) {
        throw new Error('recipient address is not valid');
      }

      const mnemonic = await askMnemonic();
      w.setSecret(mnemonic);
      w.setDerivationPath(`m/84'/0'/${accountNumber}'`);

      assert(sendData?.utxos, 'internal error: utxo not loaded');
      assert(sendData?.changeAddress, 'internal error: change address not loaded');

      // construct transaction
      const targets: CreateTransactionTarget[] = [
        {
          address: toAddress,
          value: Number(satValue),
        },
      ];
      const { tx, fee } = w.createTransaction(sendData.utxos, targets, feeRate, sendData.changeAddress);
      assert(tx, 'Internal error: Wallet.createTransaction failed');
      setTxhex(tx.toHex());
      setActualFee(fee);
      setIsPrepared(true);
    } catch (error: any) {
      console.error(error.message);
      setError(error.message);
    } finally {
      setIsPreparing(false);
    }
  };

  const handleChangeCustom = (text: string) => {
    setCustomFeeRate(Number(text));
  };

  const handleScanQr = async () => {
    const scanned = await scanQr();
    if (scanned) {
      try {
        const decoded = bip21.decode(scanned);
        if (decoded?.address) setToAddress(decoded.address);
        if (decoded?.options?.amount) setAmount(String(decoded.options.amount));
      } catch {
        setToAddress(scanned);
      }
    }
  };

  if (isSuccess) {
    return (
      <GradientScreen variant="green">
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Send" />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.contentContainer}>
            <View style={styles.successContainer}>
              <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
              <ThemedText style={styles.successMessage}>Transaction Sent!</ThemedText>
              <ThemedText style={styles.successSubMessage}>Your {getTickerByNetwork(network)} are on their way</ThemedText>
              <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <ThemedText style={styles.backButtonText}>Back to Wallet</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </GradientScreen>
    );
  }

  return (
    <GradientScreen variant="green">
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Send" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentContainer}>
          <View style={styles.inputSection}>
            <ThemedText style={styles.inputLabel}>Recipient Address</ThemedText>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter the recipient's address"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                onChangeText={setToAddress}
                value={toAddress}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity style={styles.scanButton} onPress={handleScanQr}>
                <Ionicons name="scan-outline" size={24} color="rgba(255, 255, 255, 0.8)" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputSection}>
            <ThemedText style={styles.inputLabel}>Amount</ThemedText>
            <TextInput style={styles.input} placeholder="0.00" placeholderTextColor="rgba(255, 255, 255, 0.6)" onChangeText={handleAmountChange} value={amount} keyboardType="decimal-pad" />
            <ThemedText style={styles.balanceText}>
              Available balance: {balance ? formatBalance(balance, getDecimalsByNetwork(network), 8) : ''} {getTickerByNetwork(network)}
            </ThemedText>
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            </View>
          ) : null}

          {isPreparing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.8)" />
              <ThemedText style={styles.loadingText}>Preparing transaction...</ThemedText>
            </View>
          ) : null}

          {!isPreparing && !isPrepared && (
            <View style={styles.feeContainer}>
              <View style={styles.feeRow}>
                <ThemedText style={styles.feeLabel}>Network Fee:</ThemedText>
                <TouchableOpacity style={styles.changeFeeButton} onPress={() => setShowFeeModal(true)}>
                  <ThemedText style={styles.changeFeeText}>
                    {feeRate} sats/vbyte{feeRateOptions[feeRate] && ` (${feeRateOptions[feeRate]} sats)`}
                  </ThemedText>
                  <Ionicons name="chevron-forward" size={16} color="rgba(255, 255, 255, 0.6)" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {!isPreparing && !isPrepared && (
            <TouchableOpacity style={[styles.sendButton, !sendData && styles.disabledButton]} onPress={prepareTransaction} disabled={!sendData}>
              <Ionicons name="send" size={20} color="rgba(255, 255, 255, 0.8)" />
              <ThemedText style={styles.sendButtonText}>Send</ThemedText>
            </TouchableOpacity>
          )}

          {isPrepared && (
            <View style={styles.preparedContainer}>
              <View style={styles.transactionDetails}>
                <ThemedText style={styles.detailsTitle}>Transaction Details</ThemedText>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Amount:</ThemedText>
                  <ThemedText style={styles.detailValue}>
                    {amount} {getTickerByNetwork(network)}
                  </ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Fee:</ThemedText>
                  <ThemedText style={styles.detailValue}>
                    {formatBalance(String(actualFee), getDecimalsByNetwork(network), 8)} {getTickerByNetwork(network)}
                  </ThemedText>
                </View>
              </View>

              <LongPressButton
                style={styles.confirmButton}
                textStyle={styles.confirmButtonText}
                onLongPressComplete={broadcast}
                title="Hold to confirm send"
                progressColor="#FFFFFF"
                backgroundColor="#000000"
              />

              <TouchableOpacity
                onPress={() => {
                  setIsPreparing(false);
                  setIsPrepared(false);
                }}
                style={styles.cancelButton}
              >
                <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={showFeeModal} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Select Network Fee</ThemedText>

            {estimateFees && (
              <>
                <TouchableOpacity style={[styles.feeOption, feeRate === estimateFees.slow && styles.selectedFeeOption]} onPress={() => setCustomFeeRate(estimateFees.slow)}>
                  <ThemedText style={styles.feeOptionText}>
                    Economy ({estimateFees.slow} sat/vbyte)
                    {feeRateOptions[estimateFees.slow] ? ` ≈ ${feeRateOptions[estimateFees.slow]} sats` : ''}
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.feeOption, feeRate === estimateFees.medium && styles.selectedFeeOption]} onPress={() => setCustomFeeRate(estimateFees.medium)}>
                  <ThemedText style={styles.feeOptionText}>
                    Standard ({estimateFees.medium} sat/vbyte)
                    {feeRateOptions[estimateFees.medium] ? ` ≈ ${feeRateOptions[estimateFees.medium]} sats` : ''}
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.feeOption, feeRate === estimateFees.fast && styles.selectedFeeOption]} onPress={() => setCustomFeeRate(estimateFees.fast)}>
                  <ThemedText style={styles.feeOptionText}>
                    Priority ({estimateFees.fast} sat/vbyte)
                    {feeRateOptions[estimateFees.fast] ? ` ≈ ${feeRateOptions[estimateFees.fast]} sats` : ''}
                  </ThemedText>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.customFeeContainer}>
              <ThemedText style={styles.customFeeLabel}>Custom (sat/vbyte)</ThemedText>
              <TextInput style={styles.customFeeInput} keyboardType="numeric" value={String(feeRate)} onChangeText={handleChangeCustom} />
            </View>

            <TouchableOpacity style={[styles.doneButton, !customFeeRate && styles.disabledButton]} onPress={() => setShowFeeModal(false)} disabled={!customFeeRate}>
              <ThemedText style={styles.doneButtonText}>Done</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </GradientScreen>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  contentContainer: {
    flex: 1,
  },
  inputSection: {
    marginBottom: 30,
  },
  inputLabel: {
    marginBottom: 12,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  input: {
    flex: 1,
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 16,
    paddingHorizontal: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  scanButton: {
    width: 50,
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceText: {
    marginTop: 8,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  errorContainer: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    borderRadius: 12,
  },
  errorText: {
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    gap: 12,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  feeContainer: {
    marginBottom: 30,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
  },
  feeLabel: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  changeFeeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  changeFeeText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 12,
    marginTop: 20,
  },
  sendButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  disabledButton: {
    opacity: 0.5,
  },
  preparedContainer: {
    marginTop: 30,
  },
  transactionDetails: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  detailsTitle: {
    marginBottom: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  detailValue: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  confirmButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    textDecorationLine: 'underline',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  successMessage: {
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  successSubMessage: {
    marginBottom: 40,
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  backButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '80%',
    alignItems: 'center',
  },
  backButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  modalTitle: {
    marginBottom: 20,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  feeOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 8,
    borderRadius: 12,
  },
  selectedFeeOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 1,
  },
  feeOptionText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  customFeeContainer: {
    marginTop: 16,
  },
  customFeeLabel: {
    marginBottom: 8,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  customFeeInput: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  doneButton: {
    backgroundColor: '#000000',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  doneButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
});

export default SendBtc;
