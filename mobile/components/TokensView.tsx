import React, { useContext, useImperativeHandle, forwardRef, useState, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Pressable from './Pressable';

import { ThemedText } from '@/components/ThemedText';
import SectionContainer from '@/components/SectionContainer';
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

// Local token icons for known tokens
const LOCAL_TOKEN_ICONS: Record<string, any> = {
  USDT: require('@/assets/images/ui/network/tether.png'),
};

const TokenRow: React.FC<{ token: CachedTokenInfo; onPress: (token: CachedTokenInfo) => void; selected: boolean; onVisible?: () => void }> = ({ token, onPress, selected, onVisible }) => {
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { balance } = useTokenBalance(network, accountNumber, token.id, BackgroundExecutor);
  const { tokenExchangeRate } = useTokenExchangeRate(network, token.id, 'USD');

  // Calculate formatted balance to determine visibility
  const effectiveBalance = balance ?? token.balance ?? '0';
  let decimalPlaces = token.decimals;
  if (token.name.includes('USD')) {
    decimalPlaces = 2;
  }
  const formattedBalance = formatBalance(effectiveBalance, token.decimals, Math.min(decimalPlaces, 8));
  const hasBalance = +formattedBalance > 0;

  // Report visibility to parent
  useEffect(() => {
    if (hasBalance && onVisible) {
      onVisible();
    }
  }, [hasBalance, onVisible]);

  // Don't render if no balance or balance rounds to 0
  if (!hasBalance) return null;

  const iconColor = getTokenIconColor(token?.name);

  // Check for local icon first, then use logoURI
  const localIcon = LOCAL_TOKEN_ICONS[token?.symbol?.toUpperCase()] || LOCAL_TOKEN_ICONS[token?.name?.toUpperCase()];

  const handleTokenPress = () => {
    onPress(token);
  };

  return (
    <Pressable style={[styles.tokenRow, selected && styles.selectedTokenRow]} onPress={handleTokenPress} activeOpacity={0.7} testID={`token-row-${token.id}`}>
      {/* Token Icon */}
      <View style={[styles.tokenIcon, { backgroundColor: iconColor }]}>
        {localIcon ? (
          <Image source={localIcon} style={styles.tokenIconImage} contentFit="contain" />
        ) : token.logoURI ? (
          <Image source={{ uri: token.logoURI }} style={styles.tokenIconImage} contentFit="contain" />
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
  const [hasVisibleTokens, setHasVisibleTokens] = useState(false);
  const prevContextRef = useRef({ network, accountNumber });

  // Reset visibility state when network or account changes (synchronous check before render)
  if (prevContextRef.current.network !== network || prevContextRef.current.accountNumber !== accountNumber) {
    prevContextRef.current = { network, accountNumber };
    if (hasVisibleTokens) {
      setHasVisibleTokens(false);
    }
  }

  const handleTokenVisible = () => {
    if (!hasVisibleTokens) {
      setHasVisibleTokens(true);
    }
  };

  useImperativeHandle(ref, () => ({
    refresh: () => {
      mutate();
    },
  }));

  // Don't render anything if no tokens discovered
  if (tokenList.length === 0) {
    return null;
  }

  // Check if discovery provides balances (some networks like Spark/Stacks include balance,
  // while others like Liquid set balance: undefined and rely on useTokenBalance hook)
  const discoveryProvidesBalances = tokenList.some((token) => token.balance !== undefined);

  // If discovery provides balances, check if any token has a balance > 0
  if (discoveryProvidesBalances) {
    const hasTokensWithBalance = tokenList.some((token) => {
      const balance = token.balance ?? '0';
      return +balance > 0;
    });

    // Don't render section if no tokens have balances (unless there's an error)
    if (!hasTokensWithBalance && !error) {
      return null;
    }
  }

  // For networks without discovery balances, show placeholder if no tokens have rendered yet
  const showEmptyPlaceholder = !discoveryProvidesBalances && !hasVisibleTokens && !error;

  return (
    <SectionContainer title="Tokens">
      <View style={styles.tokensList}>
        {tokenList.map((token) => (
          <TokenRow key={token.id} token={token} onPress={onTokenPress} selected={selectedToken === token.id} onVisible={handleTokenVisible} />
        ))}
        {showEmptyPlaceholder && <ThemedText style={styles.emptyText}>No tokens yet...</ThemedText>}
      </View>
      {error ? <ThemedText style={styles.errorText}>Error: {error.message}</ThemedText> : null}
    </SectionContainer>
  );
});

TokensView.displayName = 'TokensView';

const styles = StyleSheet.create({
  errorText: {
    fontSize: 16,
    color: 'rgba(255, 100, 100, 0.8)',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: 'white',
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
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
    width: 24,
    height: 24,
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
