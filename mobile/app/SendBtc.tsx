import { useNavigation } from '@react-navigation/native';
import assert from 'assert';
import BigNumber from 'bignumber.js';
import * as bip21 from 'bip21';
import { Stack } from 'expo-router';
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import LongPressButton from '@/components/LongPressButton';
import { ThemedText } from '@/components/ThemedText';
import { AskMnemonicContext } from '@/src/hooks/AskMnemonicContext';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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

  if (isSuccess) {
    return (
      <View style={styles.container}>
        <ThemedText style={styles.successIcon}>✓</ThemedText>
        <ThemedText style={styles.successTitle}>Sent!</ThemedText>
        <ThemedText style={styles.successSubtitle}>Your {getTickerByNetwork(network)} are on their way</ThemedText>
        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
          <ThemedText style={styles.buttonText}>Back to Wallet</ThemedText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen
        options={{
          title: `Send ${getTickerByNetwork(network)}`,
          headerShown: true,
        }}
      />
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Recipient</ThemedText>
        <View style={styles.inputContainer}>
          <TextInput style={styles.input} placeholder="Enter the recipient's address" onChangeText={setToAddress} value={toAddress} />
          <TouchableOpacity
            style={styles.scanButton}
            onPress={async () => {
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
            }}
          >
            <MaterialCommunityIcons name="qrcode-scan" size={24} color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Amount</ThemedText>
        <TextInput style={styles.input} placeholder="0.00" onChangeText={setAmount} value={amount} keyboardType="numeric" />
        <ThemedText style={styles.balanceText}>
          Available balance: {balance ? formatBalance(balance, getDecimalsByNetwork(network), 8) : ''} {getTickerByNetwork(network)}
        </ThemedText>
      </View>

      {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
      {isPreparing ? <ThemedText style={styles.loadingText}>loading...</ThemedText> : null}

      {!isPreparing && !isPrepared && (
        <View style={styles.feeSection}>
          <ThemedText style={styles.feeText}>
            Network Fee: {feeRate} sats/vbyte{feeRateOptions[feeRate] && ` (${feeRateOptions[feeRate]} sats)`}
          </ThemedText>
          <TouchableOpacity style={styles.changeFeeButton} onPress={() => setShowFeeModal(true)}>
            <ThemedText style={styles.changeFeeButtonText}>Change Fee</ThemedText>
          </TouchableOpacity>
        </View>
      )}

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

      {!isPreparing && !isPrepared ? (
        <TouchableOpacity style={[styles.sendButton, !sendData && styles.disabledButton]} onPress={prepareTransaction} disabled={!sendData}>
          <MaterialCommunityIcons name="send" size={24} color="#fff" />
          <ThemedText style={styles.sendButtonText}>Send</ThemedText>
        </TouchableOpacity>
      ) : null}

      {isPrepared ? (
        <View style={styles.preparedContainer}>
          <ThemedText style={styles.feeText}>
            Actual fee for this transaction: {formatBalance(String(actualFee), getDecimalsByNetwork(network), 8)} {getTickerByNetwork(network)}
          </ThemedText>

          <LongPressButton style={styles.sendButton} textStyle={styles.sendButtonText} onLongPressComplete={broadcast} title="Hold to confirm send" progressColor="#FFFFFF" backgroundColor="#007AFF" />

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
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
  },
  scanButton: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  balanceText: {
    color: '#666',
    marginTop: 8,
  },
  errorText: {
    color: 'red',
    marginBottom: 16,
  },
  loadingText: {
    color: '#666',
    marginBottom: 16,
  },
  feeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  feeText: {
    color: '#666',
  },
  changeFeeButton: {
    padding: 8,
  },
  changeFeeButtonText: {
    color: '#007AFF',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  feeOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedFeeOption: {
    backgroundColor: '#f0f0f0',
  },
  feeOptionText: {
    fontSize: 16,
  },
  customFeeContainer: {
    marginTop: 16,
  },
  customFeeLabel: {
    marginBottom: 8,
  },
  customFeeInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
  },
  doneButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  disabledButton: {
    opacity: 0.5,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  preparedContainer: {
    marginTop: 20,
  },
  confirmButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    textDecorationLine: 'underline',
  },
  successIcon: {
    fontSize: 48,
    color: '#4CAF50',
    textAlign: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    color: '#4CAF50',
    textAlign: 'center',
    marginBottom: 8,
  },
  successSubtitle: {
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SendBtc;
