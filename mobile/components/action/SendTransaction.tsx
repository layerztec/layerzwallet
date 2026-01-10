import { useRouter } from 'expo-router';
import React, { useContext, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import Slider from '@react-native-community/slider';

import { ThemedText } from '@/components/ThemedText';
import { BrowserBridge } from '@/src/class/browser-bridge';
import { EvmWallet } from '@shared/class/evm-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { formatBalance, hexToDec } from '@shared/modules/string-utils';
import { StringNumber } from '@shared/types/string-number';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import assert from 'assert';
import Pressable from '@/components/Pressable';

interface SendTransactionArgs {
  params: any[];
  id: number;
  from: string;
}

export function SendTransaction(args: SendTransactionArgs) {
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [minFees, setMinFees] = useState<StringNumber>(); // min fees user will have to pay for the transaction
  const [maxFees, setMaxFees] = useState<StringNumber>(); // max fees user will have to pay for the transaction
  const [bytes, setBytes] = useState<string>(''); // txhex ready to broadcast
  const [error, setError] = useState<string>('');
  const [overpayMultiplier, setOverpayMultiplier] = useState<number>(1);

  const getParamsTx = (): any | undefined => {
    try {
      const json = args.params;
      return json?.[0];
    } catch {
      return undefined;
    }
  };

  const onAllowClick = async () => {
    setIsLoading(true);
    setError('');

    try {
      const tx = getParamsTx();
      if (tx) {
        const e = new EvmWallet();
        const feeData = await e.getFeeData(network);
        let baseFee;
        try {
          baseFee = await e.getBaseFeePerGas(network);
        } catch {
          baseFee = 0n;
        }
        const prepared = await e.prepareTransaction(tx, network, feeData, BigInt(overpayMultiplier));

        console.log('prepared transaction: ', prepared);

        // calculating fees
        console.log('feeData=', feeData);
        console.log('lastBaseFeePerGas=', baseFee.toString());
        console.log('feeData.maxFeePerGas=', feeData.maxFeePerGas?.toString());
        console.log('feeData.maxPriorityFeePerGas=', feeData.maxPriorityFeePerGas?.toString());
        console.log('feeData.gasPrice=', feeData.gasPrice?.toString());
        console.log('prepared.gasLimit=', prepared.gasLimit?.toString());
        console.log('prepared.value=', prepared.value);

        const calculatedMinFee = e.calculateMinFee(baseFee, prepared);
        const calculatedMaxFee = e.calculateMaxFee(prepared);

        setMinFees(calculatedMinFee);
        setMaxFees(calculatedMaxFee);

        const mnemonic = await BackgroundExecutor.getMasterSeed();
        const signedBytes = await e.signTransaction(prepared, mnemonic, accountNumber);
        setBytes(signedBytes);
        console.log('signed tx: ' + signedBytes);
        setIsLoading(false); // Reset loading state when transaction is prepared

        return;
      }

      // guard, we are not even supposed to display allow/deny buttons if we cant get params
      BrowserBridge.instance?.sendMessage({
        for: 'webpage',
        id: args.id,
        error: {
          code: 4902,
          message: 'Cant get params',
        },
      });
      Alert.alert('Error', 'Cannot get transaction parameters');
      router.back();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const onDenyClick = async () => {
    try {
      BrowserBridge.instance?.sendMessage({
        for: 'webpage',
        id: args.id,
        error: { code: 4001, message: 'User rejected the request.' },
      });
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to reject request');
      router.back();
    }
  };

  const broadcastTransaction = async () => {
    try {
      console.log('broadcasting', bytes);
      const e = new EvmWallet();

      const txid = await e.broadcastTransaction(network, bytes);

      console.log('broadcasted:', txid);
      if (typeof txid !== 'string') {
        throw new Error('Broadcast error: ' + JSON.stringify(txid));
      }

      BrowserBridge.instance?.sendMessage({
        for: 'webpage',
        id: args.id,
        response: txid,
      });

      router.back();
    } catch (error: any) {
      setError(error.message);
    }
  };

  const renderParams = () => {
    const params = getParamsTx();
    const isSmartContractInteraction = params?.data; // probably also need to check length of data so its not just 0x0
    if (params) {
      return (
        <>
          <ScrollView style={styles.messageContainer} showsVerticalScrollIndicator={true} bounces={true}>
            <ThemedText style={styles.messageText}>{JSON.stringify(params, null, 2)}</ThemedText>
          </ScrollView>
          <View>
            {params?.to ? <ThemedText style={styles.detailText}>To: {params.to}</ThemedText> : null}
            {isSmartContractInteraction ? <ThemedText style={styles.detailText}>(smart contract interaction)</ThemedText> : null}
            {params?.value && hexToDec(params?.value) > 0 ? (
              <ThemedText style={styles.detailText}>
                Sending: {formatBalance(String(hexToDec(params?.value ?? 0)), getDecimalsByNetwork(network))} {getTickerByNetwork(network)}
              </ThemedText>
            ) : null}
          </View>
        </>
      );
    } else {
      return <ThemedText style={styles.errorText}>Error: Invalid transaction parameters</ThemedText>;
    }
  };

  const renderFeeInfo = () => {
    if (minFees && maxFees) {
      return (
        <View style={styles.feeContainer}>
          <ThemedText style={styles.feeText}>
            Fees between {formatBalance(minFees, getDecimalsByNetwork(network))} {getTickerByNetwork(network)} and {formatBalance(maxFees, getDecimalsByNetwork(network))} {getTickerByNetwork(network)}
          </ThemedText>
        </View>
      );
    }
    return null;
  };

  const renderFeeMultiplier = () => {
    if (!bytes) {
      return (
        <View style={styles.feeMultiplierContainer}>
          <ThemedText style={styles.feeMultiplierLabel}>Fee Priority: {overpayMultiplier}x</ThemedText>
          <Slider
            style={styles.feeMultiplierSlider}
            minimumValue={1}
            maximumValue={5}
            step={1}
            value={overpayMultiplier}
            onValueChange={setOverpayMultiplier}
            minimumTrackTintColor="rgba(255, 255, 255, 0.8)"
            maximumTrackTintColor="rgba(255, 255, 255, 0.3)"
            thumbTintColor="rgba(255, 255, 255, 0.9)"
          />
        </View>
      );
    }
    return null;
  };

  const renderActionButtons = () => {
    if (bytes) {
      return (
        <View style={styles.buttonContainer}>
          <Pressable
            style={[styles.button, styles.secondaryButton]}
            onPress={() => {
              setBytes('');
              setMinFees(undefined);
              setMaxFees(undefined);
            }}
            activeOpacity={0.8}
          >
            <ThemedText style={[styles.buttonText, styles.secondaryButtonText]}>Cancel</ThemedText>
          </Pressable>
          <Pressable style={[styles.button, styles.primaryButton]} onPress={broadcastTransaction} activeOpacity={0.8}>
            <ThemedText style={[styles.buttonText, styles.primaryButtonText]}>Confirm & Send</ThemedText>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.buttonContainer}>
        <Pressable style={[styles.button, styles.secondaryButton, isLoading && styles.disabledButton]} onPress={onDenyClick} disabled={isLoading} activeOpacity={0.8}>
          <ThemedText style={[styles.buttonText, styles.secondaryButtonText, isLoading && styles.disabledButtonText]}>{isLoading ? 'Processing...' : 'Deny'}</ThemedText>
        </Pressable>
        <Pressable style={[styles.button, styles.primaryButton, isLoading && styles.disabledButton]} onPress={onAllowClick} disabled={isLoading} activeOpacity={0.8}>
          <ThemedText style={[styles.buttonText, styles.primaryButtonText, isLoading && styles.disabledButtonText]}>{isLoading ? 'Processing...' : 'Allow'}</ThemedText>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.container} collapsable={true}>
      <View style={styles.contentContainer}>
        <ThemedText style={styles.title}>Send Transaction</ThemedText>
        <ThemedText style={styles.subtitle}>
          Dapp <ThemedText style={styles.highlight}>{args.from}</ThemedText> wants to send a transaction
        </ThemedText>
        {renderParams()}
        {renderFeeMultiplier()}
        {renderFeeInfo()}
        {error ? (
          <View style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        ) : null}
      </View>
      {renderActionButtons()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  contentContainer: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  highlight: {
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 1)',
  },
  messageContainer: {
    width: '100%',
    height: 300,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  messageText: {
    fontSize: 14,
    fontFamily: 'SpaceMono',
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
  },
  detailText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 4,
  },
  feeContainer: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  feeText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  errorContainer: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  errorText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    padding: 24,
    paddingBottom: 80,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  button: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  secondaryButtonText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  disabledButtonText: {
    color: 'rgba(255, 255, 255, 0.4)',
  },
  feeMultiplierContainer: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  feeMultiplierLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 12,
  },
  feeMultiplierSlider: {
    width: '100%',
    height: 40,
  },
});
