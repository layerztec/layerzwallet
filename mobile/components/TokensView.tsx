import React, { useContext, useEffect, useImperativeHandle, useState, forwardRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Pressable from './Pressable';

import { ThemedText } from '@/components/ThemedText';
import { LayerzStorage } from '@/src/class/layerz-storage';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useTokenBalance } from '@shared/hooks/useTokenBalance';
import { useTokenDiscovery } from '@shared/hooks/useTokenDiscovery';
import { getTokenIconColor } from '@shared/models/token-list';
import { formatBalance, formatFiatBalance } from '@shared/modules/string-utils';
import { CachedTokenInfo } from '@shared/types/token-info';
import { useTokenExchangeRate } from '@shared/hooks/useTokenExchangeRate';

const TokenRow: React.FC<{ token: CachedTokenInfo; onPress: (token: CachedTokenInfo) => void; selected: boolean; setShow: (show: boolean) => void }> = ({ token, onPress, selected, setShow }) => {
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { balance } = useTokenBalance(network, accountNumber, token.id, BackgroundExecutor);
  const { tokenExchangeRate } = useTokenExchangeRate(network, token.id, 'USD');

  useEffect(() => {
    if ((!balance || balance === '0') && (!token.balance || token.balance === '0')) return;
    setShow(true);
  }, [token, balance, setShow]);

  if (!balance && !token.balance) return null;

  let decimalPlaces = token.decimals;
  if (token.name.includes('USD')) {
    decimalPlaces = 2;
  }

  const formattedBalance = formatBalance(balance ?? token.balance ?? '0', token.decimals, Math.min(decimalPlaces, 8));

  // displaying token only if its balance is above the threshold. Threshold is arbitrary atm, probably
  // should be configurable per token
  if (+formattedBalance === 0) return null;

  const iconColor = getTokenIconColor(token?.name);

  const handleTokenPress = () => {
    onPress(token);
  };

  return (
    <Pressable style={[styles.tokenRow, selected && styles.selectedTokenRow]} onPress={handleTokenPress} activeOpacity={0.7} testID={`token-row-${token.id}`}>
      {/* Token Icon */}
      <View style={[styles.tokenIcon, { backgroundColor: iconColor }]}>
        {token.logoURI ? (
          <Image source={{ uri: token.logoURI }} style={styles.tokenIconImage} resizeMode="cover" />
        ) : (
          <ThemedText style={styles.tokenIconText}>{token?.symbol?.charAt(0) || '?'}</ThemedText>
        )}
      </View>

      {/* Token Name */}
      <ThemedText style={styles.tokenName}>{token?.name}</ThemedText>

      {/* Token Amount and Price */}
      <View style={styles.tokenAmounts}>
        <ThemedText style={styles.tokenAmount} testID={`token-amount-${token.id}`}>
          {formattedBalance} {token?.symbol}
        </ThemedText>
        <ThemedText style={styles.tokenPrice}>{balance && tokenExchangeRate && tokenExchangeRate > 0 ? '$' + formatFiatBalance(balance, token.decimals, tokenExchangeRate) : null}</ThemedText>
      </View>
    </Pressable>
  );
};

const TokensView = forwardRef<{ refresh: () => void }, { onTokenPress: (token: CachedTokenInfo) => void; selectedToken?: string }>(({ onTokenPress, selectedToken }, ref) => {
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { tokenList, error, mutate } = useTokenDiscovery(network, accountNumber, BackgroundExecutor, LayerzStorage);
  const [show, setShow] = useState(false);

  useImperativeHandle(ref, () => ({
    refresh: () => {
      mutate();
    },
  }));

  if (tokenList.length === 0) {
    return null;
  }

  const hide = !show && !error;

  return (
    <View style={[styles.container, hide && styles.hiddenContainer]}>
      <ThemedText style={styles.title}>Tokens</ThemedText>
      <View style={styles.tokensList}>
        {tokenList.map((token) => (
          <TokenRow key={token.id} token={token} onPress={onTokenPress} selected={selectedToken === token.id} setShow={setShow} />
        ))}
      </View>
      {error ? <ThemedText style={styles.errorText}>Error: {error.message}</ThemedText> : null}
    </View>
  );
});

TokensView.displayName = 'TokensView';

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    paddingVertical: 16,
  },
  hiddenContainer: {
    display: 'none',
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    color: 'white',
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
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  tokenIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  tokenIconImage: {
    width: '100%',
    height: '100%',
    borderRadius: 19,
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
  selectedTokenRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

export default TokensView;
