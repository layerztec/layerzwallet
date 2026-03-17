import React, { useContext, useImperativeHandle, forwardRef, useState, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import YieldRow from './YieldRow';
import Pressable from './Pressable';

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

  if (hasVisibleTokens) {
    return (
      <SectionContainer title="Earn">
        <View style={styles.tokensList}>
          {safeYieldList.map((yieldToken) => (
            <YieldRow key={yieldToken.id} token={yieldToken} onPress={onYieldPress} selected={selectedToken === yieldToken.id} onVisible={handleYieldVisible} network={network} />
          ))}
        </View>
        {error ? <ThemedText style={styles.errorText}>Error: {error.message}</ThemedText> : null}
      </SectionContainer>
    );
  }

  return (
    <SectionContainer title="Earn">
      <Pressable style={styles.promoContainer} onPress={() => router.push('/YieldList')} activeOpacity={0.7}>
        <View style={styles.promoContent}>
          <View style={styles.promoIconContainer}>
            <Ionicons name="trending-up" size={22} color="#00ff6e" />
          </View>
          <View style={styles.promoTextContainer}>
            <ThemedText style={styles.promoTitle}>Put your Bitcoin to work</ThemedText>
            <ThemedText style={styles.promoSubtitle}>Earn yield across layers</ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255, 255, 255, 0.4)" />
        </View>
      </Pressable>
      {safeYieldList.length > 0 && (
        <View style={styles.hiddenSection}>
          {safeYieldList.map((yieldToken) => (
            <YieldRow key={yieldToken.id} token={yieldToken} onPress={onYieldPress} selected={selectedToken === yieldToken.id} onVisible={handleYieldVisible} network={network} />
          ))}
        </View>
      )}
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
  promoContainer: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  promoContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  promoIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 255, 110, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  promoTextContainer: {
    flex: 1,
  },
  promoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  promoSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 2,
  },
});

export default YieldView;
