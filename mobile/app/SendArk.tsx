import LongPressButton from '@/components/LongPressButton';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Csprng } from '@/src/class/rng';
import { SecureStorage } from '@/src/class/secure-storage';
import { AskPasswordContext } from '@/src/hooks/AskPasswordContext';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { Ionicons } from '@expo/vector-icons';
import { ArkWallet } from '@shared/class/wallets/ark-wallet';
import { DEFAULT_NETWORK } from '@shared/config';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useBalance } from '@shared/hooks/useBalance';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { getDeviceID } from '@shared/modules/device-id';
import { decrypt } from '@shared/modules/encryption';
import { formatBalance } from '@shared/modules/string-utils';
import { ENCRYPTED_PREFIX, STORAGE_KEY_MNEMONIC } from '@shared/types/IStorage';
import assert from 'assert';
import BigNumber from 'bignumber.js';
import { router } from 'expo-router';
import React, { useContext, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SendArk = () => {
  const { scanQr } = useContext(ScanQrContext);
  const [toAddress, setToAddress] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isPreparing, setIsPreparing] = useState<boolean>(false);
  const [isPrepared, setIsPrepared] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { askPassword } = useContext(AskPasswordContext);
  const { balance } = useBalance(network ?? DEFAULT_NETWORK, accountNumber, BackgroundExecutor);
  const arkWallet = useRef<ArkWallet | undefined>(undefined);

  const actualSend = async () => {
    try {
      const satValueBN = new BigNumber(amount);
      const satValue = satValueBN.multipliedBy(new BigNumber(10).pow(getDecimalsByNetwork(network))).toString(10);

      if (!arkWallet) {
        throw new Error('Internal error: ArkWallet is not set');
      }

      console.log('actual value to send:', +satValue);

      const transactionId = await arkWallet.current?.pay(toAddress, +satValue);
      assert(transactionId, 'Internal error: ArkWallet.pay() failed');
      console.log('submitted txid:', transactionId);

      setIsSuccess(true);
    } catch (error: any) {
      setError(error.message);
    }
  };

  const prepareTransaction = async () => {
    setIsPreparing(true);
    setError('');
    try {
      // TODO: validate the address
      // TODO: validate the amount

      const password = await askPassword();
      const encryptedMnemonic = await SecureStorage.getItem(STORAGE_KEY_MNEMONIC);
      assert(encryptedMnemonic.startsWith(ENCRYPTED_PREFIX), 'Mnemonic not encrypted, reinstall the app');

      let decrypted: string = encryptedMnemonic;
      if (encryptedMnemonic.startsWith(ENCRYPTED_PREFIX)) {
        try {
          decrypted = await decrypt(encryptedMnemonic.replace(ENCRYPTED_PREFIX, ''), password, await getDeviceID(SecureStorage, Csprng));
        } catch {
          throw new Error('Incorrect password');
        }
      }

      const w = new ArkWallet();
      w.setSecret(decrypted);
      w.setAccountNumber(accountNumber);
      w.init();
      arkWallet.current = w;

      setIsPrepared(true);
    } catch (error: any) {
      console.error(error.message);
      setError(error.message);
    } finally {
      setIsPreparing(false);
    }
  };

  if (isSuccess) {
    return (
      <SafeAreaView style={styles.container}>
        <ThemedView style={styles.successContainer}>
          <Ionicons name="checkmark-circle" size={48} color="#4CAF50" style={styles.successIcon} />
          <ThemedText style={styles.successTitle}>Sent!</ThemedText>
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/')}>
            <ThemedText style={styles.backButtonText}>Back to Wallet</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText style={styles.title}>Send {getTickerByNetwork(network)}</ThemedText>

        <ThemedView style={styles.inputSection}>
          <ThemedText style={styles.inputLabel}>Recipient</ThemedText>
          <ThemedView style={styles.addressInputContainer}>
            <TextInput style={styles.input} testID="recipient-address-input" placeholder="Enter the recipient's address" placeholderTextColor="#999" onChangeText={setToAddress} value={toAddress} />
            <TouchableOpacity
              style={styles.scanButton}
              onPress={async () => {
                const scanned = await scanQr();
                console.log({ scanned });
                if (scanned) {
                  setToAddress(scanned);
                }
              }}
            >
              <Ionicons name="scan-outline" size={24} color="#007AFF" />
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>

        <ThemedView style={styles.divider} />

        <ThemedView style={styles.inputSection}>
          <ThemedText style={styles.inputLabel}>Amount</ThemedText>
          <TextInput style={styles.input2} testID="amount-input" placeholder="0.00" placeholderTextColor="#999" keyboardType="numeric" onChangeText={setAmount} value={amount} />
          <ThemedText style={styles.balanceText}>
            Available balance: {balance ? formatBalance(balance, getDecimalsByNetwork(network), 8) : ''} {getTickerByNetwork(network)}
          </ThemedText>
        </ThemedView>

        {error ? (
          <ThemedView style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </ThemedView>
        ) : null}

        {isPreparing ? (
          <ThemedView style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#007AFF" />
            <ThemedText style={styles.loadingText}>Preparing transaction...</ThemedText>
          </ThemedView>
        ) : null}

        {!isPreparing && !isPrepared ? (
          <TouchableOpacity style={styles.sendButton} testID="send-screen-send-button" onPress={prepareTransaction}>
            <Ionicons name="send" size={20} color="white" style={styles.sendIcon} />
            <ThemedText style={styles.sendButtonText}>Send</ThemedText>
          </TouchableOpacity>
        ) : null}

        {isPrepared ? (
          <ThemedView style={styles.confirmContainer}>
            <LongPressButton
              style={styles.sendButton}
              textStyle={styles.sendButtonText}
              onLongPressComplete={actualSend}
              title="Hold to confirm send"
              progressColor="#FFFFFF"
              backgroundColor="#007AFF"
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
          </ThemedView>
        ) : null}
      </ThemedView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontWeight: 'bold',
    marginBottom: 10,
  },
  addressInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  input2: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  scanButton: {
    marginLeft: 10,
    width: 50,
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 20,
  },
  balanceText: {
    fontSize: 14,
    color: 'gray',
    marginTop: 8,
  },
  errorContainer: {
    marginBottom: 15,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    height: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  sendIcon: {
    marginRight: 10,
  },
  sendButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  confirmContainer: {
    marginTop: 20,
  },
  confirmButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    height: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    marginTop: 15,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'gray',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  successIcon: {
    marginBottom: 20,
  },
  successTitle: {
    color: '#4CAF50',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  successMessage: {
    color: '#666',
    fontSize: 16,
    marginBottom: 30,
  },
  backButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    height: 50,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SendArk;
