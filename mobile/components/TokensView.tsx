import { useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';

import { ThemedText } from '@/components/ThemedText';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useTokenBalance } from '@shared/hooks/useTokenBalance';
import { getTokenList, getTokenIconColor, getTokenInfo } from '@shared/models/token-list';
import { formatBalance } from '@shared/modules/string-utils';

const TokenRow: React.FC<{ tokenAddress: string }> = ({ tokenAddress }) => {
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const router = useRouter();
  const token = getTokenInfo(tokenAddress);

  const { balance } = useTokenBalance(network, accountNumber, tokenAddress, BackgroundExecutor);

  if (!balance) return null;

  const formattedBalance = formatBalance(balance, token?.decimals ?? 1, 2);

  // displaying token only if its balance is above the threshold. Threshold is arbitrary atm, probably
  // should be configurable per token
  if (+formattedBalance === 0) return null;

  const iconColor = getTokenIconColor(token?.name);

  const goToSend = () => {
    router.push({
      pathname: '/SendTokenEvm',
      params: { contractAddress: token?.id },
    });
  };

  return (
    <TouchableOpacity style={styles.tokenRow} onPress={goToSend} activeOpacity={0.7}>
      {/* Token Icon */}
      <View style={[styles.tokenIcon, { backgroundColor: iconColor }]}>
        <ThemedText style={styles.tokenIconText}>{token?.symbol?.charAt(0) || '?'}</ThemedText>
      </View>

      {/* Token Name */}
      <ThemedText style={styles.tokenName}>{token?.name}</ThemedText>

      {/* Token Amount and Price */}
      <View style={styles.tokenAmounts}>
        <ThemedText style={styles.tokenAmount}>
          {formattedBalance} {token?.symbol}
        </ThemedText>
        <ThemedText style={styles.tokenPrice}>$TODO</ThemedText>
      </View>
    </TouchableOpacity>
  );
};

const TokensView: React.FC = () => {
  const { network } = useContext(NetworkContext);
  const tokenList = getTokenList(network);

  if (tokenList.length === 0) {
    return null;
  }

  return (
    <BlurView intensity={50} tint="dark" style={styles.container}>
      <ThemedText style={styles.title}>Tokens</ThemedText>
      <View style={styles.tokensList}>
        {tokenList.map((token) => (
          <TokenRow key={token.id} tokenAddress={token.id} />
        ))}
      </View>
    </BlurView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
  },
  title: {
    fontSize: 20,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 24,
  },
  tokensList: {
    gap: 16,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
  },
  tokenIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  tokenIconText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  tokenName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
    flex: 1,
  },
  tokenAmounts: {
    alignItems: 'flex-end',
  },
  tokenAmount: {
    fontSize: 15,
    fontWeight: '400',
    color: '#ffffff',
    marginBottom: 2,
  },
  tokenPrice: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.3)',
  },
});

export default TokensView;
