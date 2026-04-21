import { Ionicons } from '@expo/vector-icons';
import BigNumber from 'bignumber.js';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';

import Pressable from '../../components/Pressable';
import { BalanceLightning } from '@/components/Balance';
import RadialGradientScreen from '@/components/RadialGradientScreen';
import ScreenSendHeader from '@/components/navigation/ScreenSendHeader';
import { ThemedText } from '@/components/ThemedText';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import Lnurl from '@shared/class/lnurl';
import { walletSupportsLightning } from '@shared/class/wallets/interface-lightning-wallet';
import { overlayBackgroundDeeper } from '@shared/constants/Colors';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { getTickerByNetwork } from '@shared/models/network-getters';
import { fetch } from '@shared/util/fetch';
import { NETWORK_LIGHTNING, Networks } from '@shared/types/networks';
import { LightningLayer } from './_layout';

export type WithdrawLightningParams = {
  lnurl: string;
  network: Networks;
};

type LnurlWithdrawRequestPayload = {
  callback: string;
  defaultDescription?: string;
  k1: string;
  maxWithdrawable: number;
  minWithdrawable: number;
  tag: string;
};

const msatsToSatsFloor = (msats: number): number => new BigNumber(msats).dividedBy(1000).integerValue(BigNumber.ROUND_DOWN).toNumber();

const msatsToSatsCeil = (msats: number): number => new BigNumber(msats).dividedBy(1000).integerValue(BigNumber.ROUND_UP).toNumber();

const WithdrawLightning: React.FC = () => {
  const params = useLocalSearchParams<WithdrawLightningParams>();
  const { network, setNetwork } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const requestedNetwork = typeof params.network === 'string' ? (params.network as Networks) : NETWORK_LIGHTNING;
  const lnurl = typeof params.lnurl === 'string' ? params.lnurl.trim() : '';

  const [selectedLayer, setSelectedLayer] = useState<LightningLayer | undefined>(undefined);
  const [payload, setPayload] = useState<LnurlWithdrawRequestPayload | undefined>(undefined);
  const [error, setError] = useState<string>('');
  const [isLoadingRequest, setIsLoadingRequest] = useState(false);
  const [withdrawState, setWithdrawState] = useState<'idle' | 'withdrawing' | 'success'>('idle');
  const [customAmount, setCustomAmount] = useState<string>('');

  const isFixedAmount = !!payload && payload.minWithdrawable === payload.maxWithdrawable;
  const minSats = useMemo(() => (payload ? msatsToSatsCeil(payload.minWithdrawable) : 0), [payload]);
  const maxSats = useMemo(() => (payload ? msatsToSatsFloor(payload.maxWithdrawable) : 0), [payload]);
  // LNURL server requested an amount that cannot be represented in whole sats
  // (e.g. fixed 1500 msats, or a tight [1500, 1999] msat range). Any invoice we
  // could create would fall outside the server's [min, max] msat window.
  const rangeIsUnsatisfiable = !!payload && minSats > maxSats;

  useEffect(() => {
    if (network !== requestedNetwork) {
      setNetwork(requestedNetwork);
    }
  }, [network, requestedNetwork, setNetwork]);

  const loadWithdrawRequest = useCallback(async () => {
    if (!lnurl) {
      setPayload(undefined);
      setError('Missing LNURL withdraw request');
      return;
    }

    setIsLoadingRequest(true);
    setError('');

    try {
      const url = Lnurl.getUrlFromLnurl(lnurl);
      if (!url) {
        throw new Error('Invalid LNURL');
      }

      const response = await fetch(url, { method: 'GET' });
      if (response.status >= 300) {
        throw new Error('Bad response from server');
      }

      const reply = (await response.json()) as LnurlWithdrawRequestPayload & { status?: string; reason?: string };

      if (reply.status === 'ERROR') {
        throw new Error(reply.reason || 'Reply from server indicated an error');
      }
      if (reply.tag !== Lnurl.TAG_WITHDRAW_REQUEST) {
        throw new Error(`lnurl-withdraw expected, found tag ${reply.tag}`);
      }

      setPayload(reply);
    } catch (err: any) {
      setPayload(undefined);
      setError(err.message || 'Failed to load LNURL withdraw request');
    } finally {
      setIsLoadingRequest(false);
    }
  }, [lnurl]);

  useEffect(() => {
    loadWithdrawRequest();
  }, [loadWithdrawRequest]);

  const handleLayerSelect = (selectedNetwork: Networks) => {
    if (withdrawState === 'success') {
      return;
    }

    setSelectedLayer((current) => {
      const nextLayer = selectedNetwork as LightningLayer;
      return current === nextLayer ? undefined : nextLayer;
    });
  };

  const resolveWithdrawAmountSats = (): number => {
    if (!payload) {
      throw new Error('Missing LNURL withdraw request');
    }
    if (rangeIsUnsatisfiable) {
      throw new Error('Withdraw amount cannot be represented in whole sats');
    }
    if (isFixedAmount) {
      return maxSats;
    }

    const trimmed = customAmount.trim();
    if (!trimmed) {
      throw new Error('Please enter an amount');
    }
    if (!/^\d+$/.test(trimmed)) {
      throw new Error('Amount must be a whole number of sats');
    }

    const value = Number(trimmed);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error('Amount must be greater than 0');
    }
    if (value < minSats) {
      throw new Error(`Amount must be at least ${minSats} sats`);
    }
    if (value > maxSats) {
      throw new Error(`Amount must be at most ${maxSats} sats`);
    }

    return value;
  };

  const handleCustomAmountChange = (text: string) => {
    setCustomAmount(text.replace(/[^0-9]/g, ''));
    setError('');
  };

  const handleMaxPress = () => {
    setCustomAmount(String(maxSats));
    setError('');
  };

  const handleWithdraw = async () => {
    if (!payload || !selectedLayer) {
      return;
    }

    let amountSats: number;
    try {
      amountSats = resolveWithdrawAmountSats();
    } catch (err: any) {
      setError(err.message || 'Invalid amount');
      return;
    }

    setWithdrawState('withdrawing');
    setError('');

    try {
      const wallet = await BackgroundExecutor.lazyInitWallet(selectedLayer, accountNumber);
      if (!walletSupportsLightning(wallet)) {
        throw new Error('Selected network does not support Lightning withdrawals');
      }

      const invoiceResponse = await wallet.createLightningInvoice(amountSats, payload.defaultDescription || 'Layerzwallet LNURL withdraw');
      const separator = payload.callback.includes('?') ? '&' : '?';
      const callbackUrl = `${payload.callback}${separator}k1=${encodeURIComponent(payload.k1)}&pr=${encodeURIComponent(invoiceResponse.invoice)}`;

      const response = await fetch(callbackUrl, { method: 'GET' });
      if (response.status >= 300) {
        throw new Error('Bad response from withdraw callback');
      }

      const reply = (await response.json()) as { status?: string; reason?: string };
      if (reply.status === 'ERROR') {
        throw new Error(reply.reason || 'Withdraw callback returned an error');
      }

      setWithdrawState('success');
    } catch (err: any) {
      setWithdrawState('idle');
      setError(err.message || 'Failed to withdraw');
    }
  };

  const fixedAmountDisplay = useMemo(() => {
    if (!payload || rangeIsUnsatisfiable) {
      return '—';
    }
    return new BigNumber(maxSats).toFormat(0);
  }, [payload, maxSats, rangeIsUnsatisfiable]);

  const displayedError = error || (rangeIsUnsatisfiable ? 'Withdraw amount cannot be represented in whole sats' : '');
  const withdrawDisabled = isLoadingRequest || withdrawState !== 'idle' || !payload || !selectedLayer || rangeIsUnsatisfiable || (!isFixedAmount && !customAmount);

  return (
    <RadialGradientScreen network={requestedNetwork} scroll={true}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenSendHeader network={requestedNetwork} title={`Withdraw ${getTickerByNetwork(requestedNetwork)}`} />

      <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.amountCard}>
              <ThemedText style={styles.amountLabel}>{isFixedAmount ? 'You will receive' : 'Enter amount'}</ThemedText>
              {isLoadingRequest ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.8)" />
                  <ThemedText style={styles.loadingText}>Loading withdraw request...</ThemedText>
                </View>
              ) : isFixedAmount || !payload || rangeIsUnsatisfiable ? (
                <>
                  <ThemedText type="sfProRounded" style={styles.amountValue} adjustsFontSizeToFit={true} numberOfLines={1}>
                    {fixedAmountDisplay}
                  </ThemedText>
                  <ThemedText style={styles.amountTicker}>sats</ThemedText>
                </>
              ) : (
                <>
                  <TextInput
                    style={styles.amountInput}
                    value={customAmount}
                    onChangeText={handleCustomAmountChange}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor="rgba(255, 255, 255, 0.35)"
                    editable={withdrawState === 'idle'}
                    testID="withdraw-lightning-amount-input"
                  />
                  <ThemedText style={styles.amountTicker}>sats</ThemedText>
                  <View style={styles.rangeRow}>
                    <ThemedText style={styles.rangeText}>{`Min ${minSats} • Max ${maxSats} sats`}</ThemedText>
                    <Pressable style={styles.maxButton} onPress={handleMaxPress} disabled={withdrawState !== 'idle'} testID="withdraw-lightning-max-button">
                      <ThemedText style={styles.maxButtonText}>MAX</ThemedText>
                    </Pressable>
                  </View>
                </>
              )}
            </View>

            {payload?.defaultDescription && (
              <View style={styles.infoCard}>
                <Ionicons name="information-circle" size={20} color="rgba(255, 255, 255, 0.8)" />
                <ThemedText style={styles.infoText}>{payload.defaultDescription}</ThemedText>
              </View>
            )}

            {displayedError ? (
              <View style={styles.errorContainer}>
                <Ionicons name="close" size={16} color="white" />
                <ThemedText style={styles.errorText}>{displayedError}</ThemedText>
              </View>
            ) : null}

            <BalanceLightning onSelectNetwork={handleLayerSelect} selectedNetwork={selectedLayer} showTotalBalance={false} />
          </View>

          {withdrawState === 'success' ? (
            <View style={styles.successState} testID="withdraw-lightning-success">
              <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
              <ThemedText style={styles.successText}>Success!</ThemedText>
            </View>
          ) : (
            <Pressable style={[styles.withdrawButton, withdrawDisabled && styles.disabledButton]} onPress={handleWithdraw} disabled={withdrawDisabled} testID="withdraw-lightning-button">
              {withdrawState === 'withdrawing' ? <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.8)" /> : <ThemedText style={styles.withdrawButtonText}>Withdraw</ThemedText>}
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </RadialGradientScreen>
  );
};

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  content: {
    gap: 16,
  },
  amountCard: {
    alignItems: 'center',
    backgroundColor: overlayBackgroundDeeper,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  amountLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginBottom: 12,
  },
  amountValue: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 42,
    width: '100%',
    textAlign: 'center',
  },
  amountInput: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 42,
    width: '100%',
    textAlign: 'center',
    padding: 0,
    margin: 0,
  },
  amountTicker: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 18,
    marginTop: 8,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
  },
  rangeText: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 13,
  },
  maxButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  maxButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: overlayBackgroundDeeper,
    borderRadius: 12,
    padding: 12,
  },
  infoText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  errorText: {
    color: 'white',
    fontSize: 14,
  },
  withdrawButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 'auto',
    marginBottom: 24,
  },
  successState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 'auto',
    marginBottom: 24,
    minHeight: 56,
  },
  successText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
  },
  withdrawButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default WithdrawLightning;
