import React, { memo, useCallback, useContext, useImperativeHandle, forwardRef, useState, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import TokenRow from './TokenRow';

import { ThemedText } from '@/components/ThemedText';
import SectionContainer from '@/components/SectionContainer';
import { LayerzStorage } from '@/src/class/layerz-storage';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useTokenDiscovery } from '@shared/hooks/useTokenDiscovery';
import { CachedTokenInfo } from '@shared/types/token-info';

const TokensView = memo(
  forwardRef<{ refresh: () => void }, { onTokenPress: (token: CachedTokenInfo) => void; selectedToken?: string }>(({ onTokenPress, selectedToken }, ref) => {
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

    // stable callback so memoized TokenRow children don't re-render on every parent render
    const handleTokenVisible = useCallback(
      (isVisible: boolean) => {
        if (isVisible && !hasVisibleTokens) {
          setHasVisibleTokens(true);
        }
      },
      [hasVisibleTokens]
    );

    useImperativeHandle(ref, () => ({
      refresh: () => {
        mutate();
      },
    }));

    // Don't render anything if no tokens discovered
    if (tokenList.length === 0) {
      return null;
    }

    return (
      <>
        <SectionContainer title="Tokens" style={!hasVisibleTokens ? styles.hiddenSection : undefined}>
          <View style={styles.tokensList}>
            {tokenList.map((token) => (
              <TokenRow key={token.id} token={token} onPress={onTokenPress} selected={selectedToken === token.id} onVisible={handleTokenVisible} />
            ))}
          </View>
        </SectionContainer>
        {error ? <ThemedText style={styles.errorText}>Error: {error.message}</ThemedText> : null}
      </>
    );
  })
);

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
  hiddenSection: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
    marginBottom: 0,
  },
});

export default TokensView;
