import React, { useContext, useImperativeHandle, forwardRef, useState, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import YieldRow from './YieldRow';

import { ThemedText } from '@/components/ThemedText';
import SectionContainer from '@/components/SectionContainer';
import { LayerzStorage } from '@/src/class/layerz-storage';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useYieldDiscovery, YieldBearingCachedTokenInfo } from '@shared/hooks/useYieldDiscovery';

const YieldView = forwardRef<{ refresh: () => void }, { onYieldPress: (token: YieldBearingCachedTokenInfo) => void; selectedToken?: string }>(({ onYieldPress: onYieldPress, selectedToken }, ref) => {
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { yieldList, error, mutate } = useYieldDiscovery(network, accountNumber, BackgroundExecutor, LayerzStorage);
  const safeYieldList = yieldList ?? [];
  const [hasVisibleTokens, setHasVisibleTokens] = useState(false);
  const prevContextRef = useRef({ network, accountNumber });

  // Reset visibility state when network or account changes (synchronous check before render)
  if (prevContextRef.current.network !== network || prevContextRef.current.accountNumber !== accountNumber) {
    prevContextRef.current = { network, accountNumber };
    if (hasVisibleTokens) {
      setHasVisibleTokens(false);
    }
  }

  const handleYieldVisible = () => {
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
  if (safeYieldList.length === 0) {
    return null;
  }

  if (safeYieldList.length === 0) {
    return null;
  }

  return (
    <SectionContainer title="Earn">
      <View style={styles.tokensList}>
        {safeYieldList.map((yieldToken) => (
          <YieldRow key={yieldToken.id} token={yieldToken} onPress={onYieldPress} selected={selectedToken === yieldToken.id} onVisible={handleYieldVisible} />
        ))}
      </View>
      {error ? <ThemedText style={styles.errorText}>Error: {error.message}</ThemedText> : null}
    </SectionContainer>
  );
});

YieldView.displayName = 'YieldView';

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
});

export default YieldView;
