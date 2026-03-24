import React, { useContext, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Pressable from './Pressable';

import { ThemedText } from '@/components/ThemedText';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useTokenBalance } from '@shared/hooks/useTokenBalance';
import { useSelectedFiat } from '@shared/hooks/useSelectedFiat';
import { useYieldDiscovery, YieldBearingCachedTokenInfo } from '@shared/hooks/useYieldDiscovery';
import { getTokenIconColor } from '@shared/models/token-list';
import { formatFiatDisplay } from '@shared/modules/fiat-utils';
import { formatBalance, formatFiatBalance } from '@shared/modules/string-utils';
import { useTokenExchangeRate } from '@shared/hooks/useTokenExchangeRate';
import { Networks } from '@shared/types/networks';

// Local token icons for known tokens
const LOCAL_TOKEN_ICONS: Record<string, any> = {};

const YieldRow: React.FC<{ token: YieldBearingCachedTokenInfo; onPress: (token: YieldBearingCachedTokenInfo) => void; selected: boolean; onVisible?: () => void; network: Networks }> = ({
  token,
  onPress,
  selected,
  onVisible,
  network,
}) => {
  const { accountNumber } = useContext(AccountNumberContext);
  const fiat = useSelectedFiat();
  const { balance } = useTokenBalance(network, accountNumber, token.id, BackgroundExecutor);
  const { tokenExchangeRate } = useTokenExchangeRate(network, token.id);

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
          <Image source={localIcon} style={styles.tokenIconImage} contentFit="cover" />
        ) : token.logoURI ? (
          <Image source={{ uri: token.logoURI }} style={styles.tokenIconImage} contentFit="cover" />
        ) : (
          <ThemedText style={styles.tokenIconText}>{token?.symbol?.charAt(0) || '?'}</ThemedText>
        )}
      </View>

      {/* Token Name and APR */}
      <View style={styles.tokenNameContainer}>
        <ThemedText style={styles.tokenName}>{token?.name}</ThemedText>
        <View style={styles.tokenAprRow}>
          <ThemedText style={styles.tokenAprPrefix}>APR:</ThemedText>
          <ThemedText style={styles.tokenAprValue}>{token.yield.apr}</ThemedText>
        </View>
      </View>

      {/* Token Amount and Price */}
      <View style={styles.tokenAmounts}>
        <ThemedText style={styles.tokenAmount} testID={`token-amount-${token.id}`}>
          {formattedBalance} {token?.symbol}
        </ThemedText>
        <ThemedText style={styles.tokenPrice}>
          {balance && tokenExchangeRate && tokenExchangeRate > 0 ? formatFiatDisplay(formatFiatBalance(balance, token.decimals, tokenExchangeRate), fiat) : null}
        </ThemedText>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
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
    overflow: 'hidden',
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
  tokenNameContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  tokenName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
  tokenAprRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenAprPrefix: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.3)',
    marginRight: 4,
  },
  tokenAprValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#00ff6e',
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

export default YieldRow;
