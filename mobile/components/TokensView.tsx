import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
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
    <ThemedView style={styles.assetContainer}>
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
          style={styles.button}
        >
          <Ionicons name="send" size={16} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/Receive')} style={styles.button}>
          <Ionicons name="arrow-down" size={16} color="#666" />
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
};

const TokensView: React.FC = () => {
  const { network } = useContext(NetworkContext);
  const tokenList = getTokenList(network);

  if (tokenList.length === 0) {
    return null;
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>Tokens</ThemedText>
      <View>
        {tokenList.map((token) => (
          <TokenRow key={token.address} tokenAddress={token.address} />
        ))}
      </View>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
    marginTop: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  assetContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginVertical: 4,
    marginHorizontal: 8,
  },
  assetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetName: {
    fontWeight: '700',
    fontSize: 14,
  },
  assetFullName: {
    marginLeft: 5,
    color: '#888',
    fontSize: 14,
  },
  balance: {
    fontSize: 14,
    marginLeft: 'auto',
    marginRight: 16,
  },
  symbol: {
    fontWeight: '700',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  button: {
    backgroundColor: 'white',
    padding: 8,
    borderRadius: 4,
  },
});

export default TokensView;
