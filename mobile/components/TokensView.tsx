import { useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useTokenBalance } from '@shared/hooks/useTokenBalance';
import { useTokenDiscovery } from '@shared/hooks/useTokenDiscovery';
import { NETWORK_SPARK } from '@shared/types/networks';
import { CachedTokenInfo } from '@shared/types/token-info';
import { getTokenIconColor } from '@shared/models/token-list';
import { formatBalance } from '@shared/modules/string-utils';
import { LayerzStorage } from '@/src/class/layerz-storage';

const TokenRow: React.FC<{ token: CachedTokenInfo }> = ({ token }) => {
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const router = useRouter();

  const { balance } = useTokenBalance(network, accountNumber, token.id, BackgroundExecutor);

  if (!balance && !token.balance) return null;

  let decimalPlaces = 3;
  if (token.name.includes('USD')) {
    decimalPlaces = 2;
  }

  const formattedBalance = formatBalance(balance ?? token.balance ?? '0', token.decimals, decimalPlaces);

  // displaying token only if its balance is above the threshold. Threshold is arbitrary atm, probably
  // should be configurable per token
  if (+formattedBalance === 0) return null;

  const iconColor = getTokenIconColor(token?.name);

  const goToSend = () => {
    if (network === NETWORK_SPARK) {
      router.push({
        pathname: '/SendTokenSpark',
        params: {
          tokenId: token.id,
          tokenSymbol: token.symbol,
          tokenName: token.name,
          tokenDecimals: token.decimals.toString(),
        },
      });
      return;
    }

    router.push({
      pathname: '/SendTokenEvm',
      params: { contractAddress: token.id },
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
  const { accountNumber } = useContext(AccountNumberContext);
  const { tokenList, error } = useTokenDiscovery(network, accountNumber, BackgroundExecutor, LayerzStorage);

  if (error) {
    return (
      <View style={styles.container}>
        <ThemedText style={styles.title}>Tokens</ThemedText>
        <ThemedText style={styles.errorText}>Error: {error.message}</ThemedText>
      </View>
    );
  }

  if (tokenList.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ThemedText style={styles.title}>Tokens</ThemedText>
      <View style={styles.tokensList}>
        {tokenList.map((token) => (
          <TokenRow key={token.id} token={token} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
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
  errorText: {
    fontSize: 16,
    color: 'rgba(255, 100, 100, 0.8)',
    textAlign: 'center',
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
