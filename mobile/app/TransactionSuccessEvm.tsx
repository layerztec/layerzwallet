import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Ionicons } from '@expo/vector-icons';
import { useTransactionReceipt } from '@shared/hooks/useTransactionReceipt';
import { getDecimalsByNetwork, getExplorerUrlByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { getTokenList } from '@shared/models/token-list';
import { capitalizeFirstLetter, formatBalance, hexToDec } from '@shared/modules/string-utils';
import { Networks } from '@shared/types/networks';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

export type TransactionSuccessProps = {
  amount: string; // in sats
  amountToken?: string; // if we sent token then this field is present
  tokenContractAddress?: string; // if we sent token then this field is present
  recipient: string;
  network: Networks;
  transactionId: string;
  bytes: string; // txhex
};

const TransactionSuccessEvm: React.FC = () => {
  const params = useLocalSearchParams<TransactionSuccessProps>();
  const { transactionId, amount, recipient, network, bytes, amountToken, tokenContractAddress } = params;
  const { receipt } = useTransactionReceipt(network, transactionId);

  const list = getTokenList(network);
  const tokenInfo = list.find((token) => token.address === tokenContractAddress);

  const [showTimedOutTxIcon, setShowTimedOutTxIcon] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTimedOutTxIcon(!receipt);
    }, 45_000);

    return () => clearTimeout(timer);
  }, [receipt]);

  function calculateFees() {
    if (!receipt) return 0;

    if (!receipt.gasUsed && !receipt.effectiveGasPrice) return '?';
    if (receipt.gasUsed && !receipt.effectiveGasPrice) {
      // probably tx type 0, where we know the gas used and the gasprice is hardcoded in tx itself
      const p = ethers.Transaction.from(bytes);
      if (p.gasPrice) {
        const i = new BigNumber(p.gasPrice.toString()).multipliedBy(new BigNumber(receipt.gasUsed.toString())).toString();
        // not using ethers bignumber cause its faulty, BigNumber.js is better
        return new BigNumber(i).dividedBy(Math.pow(10, getDecimalsByNetwork(network))).toString() + ' ' + getTickerByNetwork(network);
      }
      return '???';
    }

    const fee = new BigNumber(receipt.gasUsed as unknown as string)
      .multipliedBy(receipt.effectiveGasPrice as unknown as string)
      .dividedBy(Math.pow(10, getDecimalsByNetwork(network)))
      .toString();
    return fee + ' ' + getTickerByNetwork(network);
  }

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
  };

  const openInExplorer = () => {
    Linking.openURL(getExplorerUrlByNetwork(network) + '/tx/' + transactionId);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: 'Your transaction',
          headerShown: true,
        }}
      />

      <View style={styles.statusContainer}>
        {receipt && hexToDec(receipt.status) === 1 ? (
          <>
            <Ionicons name="checkmark-circle" size={48} color="#4CAF50" />
            <ThemedText type="subHeadline">Transaction sent successfully!</ThemedText>
          </>
        ) : null}

        {receipt && hexToDec(receipt.status) === 0 ? (
          <>
            <Ionicons name="close-circle" size={48} color="#FF6347" />
            <ThemedText type="subHeadline">Transaction failed</ThemedText>
          </>
        ) : null}

        {!receipt ? (
          <>
            <Ionicons name="sync" size={48} color="#FFA500" />
            <ThemedText type="subHeadline">Waiting for a transaction...</ThemedText>
          </>
        ) : null}

        {showTimedOutTxIcon && !receipt && (
          <View style={styles.warningContainer}>
            <Ionicons name="alert-circle" size={24} color="red" />
            <ThemedText type="paragraph" style={{ color: 'red', marginLeft: 5 }}>
              Transaction can not be found on the blockchain. Insufficient fee?
            </ThemedText>
          </View>
        )}
      </View>

      <ThemedView style={styles.summaryCard}>
        <ThemedText type="paragraph" style={{ color: '#666', marginBottom: 10 }}>
          Summary of your recent transaction
        </ThemedText>

        {+amount ? (
          <View style={styles.summaryRow}>
            <ThemedText type="paragraph">Amount</ThemedText>
            <ThemedText type="paragraph" style={{ fontWeight: 'bold' }}>
              {formatBalance(amount, getDecimalsByNetwork(network))} {getTickerByNetwork(network)}
            </ThemedText>
          </View>
        ) : null}

        {amountToken && tokenInfo ? (
          <View style={styles.summaryRow}>
            <ThemedText type="paragraph">Amount</ThemedText>
            <ThemedText type="paragraph" style={{ fontWeight: 'bold' }}>
              {formatBalance(amountToken, tokenInfo.decimals, 2)} {tokenInfo.symbol}
            </ThemedText>
          </View>
        ) : null}

        {receipt ? (
          <View style={styles.summaryRow}>
            <ThemedText type="paragraph">Fee paid</ThemedText>
            <ThemedText type="paragraph" style={{ fontWeight: 'bold' }}>
              {calculateFees()}
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.summaryRow}>
          <ThemedText type="paragraph">Recipient</ThemedText>
          <ThemedText type="paragraph" style={[styles.addressText, { fontWeight: 'bold' }]}>
            {recipient}
          </ThemedText>
        </View>

        <View style={styles.summaryRow}>
          <ThemedText type="paragraph">Network</ThemedText>
          <ThemedText type="paragraph" style={{ fontWeight: 'bold' }}>
            {capitalizeFirstLetter(network)}
          </ThemedText>
        </View>

        <View style={styles.summaryRow}>
          <ThemedText type="paragraph">Transaction ID</ThemedText>
          <View style={styles.txIdContainer}>
            <ThemedText type="paragraph" style={{ fontWeight: 'bold', marginRight: 5 }}>
              {transactionId.replace('0x', '').substring(0, 16)}...
            </ThemedText>
            <TouchableOpacity onPress={() => copyToClipboard(transactionId)}>
              <Ionicons name="copy-outline" size={16} color="#007AFF" />
            </TouchableOpacity>
          </View>
        </View>
      </ThemedView>

      <TouchableOpacity style={styles.explorerButton} onPress={openInExplorer}>
        <ThemedText type="paragraph" style={{ color: 'white', fontWeight: 'bold' }}>
          View in Explorer
        </ThemedText>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
  },
  summaryCard: {
    width: '100%',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  addressText: {
    maxWidth: '60%',
    textAlign: 'right',
  },
  txIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  explorerButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 15,
    width: '100%',
    alignItems: 'center',
  },
});

export default TransactionSuccessEvm;
