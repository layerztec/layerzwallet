import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useTokenBalance } from '@shared/hooks/useTokenBalance';
import { getTokenList } from '@shared/models/token-list';
import { capitalizeFirstLetter, formatBalance } from '@shared/modules/string-utils';

const TokenRow: React.FC<{ tokenAddress: string }> = ({ tokenAddress }) => {
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const router = useRouter();
  const list = getTokenList(network);
  const token = list.find((token) => token.address === tokenAddress);

  const { balance } = useTokenBalance(network, accountNumber, tokenAddress, BackgroundExecutor);

  if (!balance) return null;

  const formattedBalance = formatBalance(balance, token?.decimals ?? 1, 2);

  // displaying token only if its balance is above the threshold. Threshold is arbitrary atm, probably
  // should be configurable per token
  if (+formattedBalance === 0) return null;

  return (
    <View style={styles.assetContainer}>
      <View style={styles.assetInfo}>
        <ThemedText style={styles.assetName}>{token?.name}</ThemedText>
        <ThemedText style={styles.assetFullName}>({capitalizeFirstLetter(network)})</ThemedText>
      </View>

      <ThemedText style={styles.balance}>
        <ThemedText style={styles.symbol}>{token?.symbol}</ThemedText> {balance ? formattedBalance : ''}
      </ThemedText>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={() => {
            router.push({
              pathname: '/SendTokenEvm',
              params: { contractAddress: token?.address },
            });
          }}
          style={styles.sendButton}
        >
          <Ionicons name="send" size={16} color="rgba(255, 255, 255, 0.8)" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/Receive')} style={styles.receiveButton}>
          <Ionicons name="arrow-down" size={16} color="rgba(255, 255, 255, 0.8)" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const TokensView: React.FC = () => {
  const { network } = useContext(NetworkContext);
  const tokenList = getTokenList(network);

  if (tokenList.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ThemedText style={styles.title}>Tokens</ThemedText>
      <View>
        {tokenList.map((token) => (
          <TokenRow key={token.address} tokenAddress={token.address} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  title: {
    marginBottom: 16,
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  assetContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  assetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  assetName: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  assetFullName: {
    marginLeft: 5,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  balance: {
    marginLeft: 'auto',
    marginRight: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  symbol: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  sendButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.3)',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  receiveButton: {
    backgroundColor: 'rgba(52, 199, 89, 0.3)',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
});

export default TokensView;
