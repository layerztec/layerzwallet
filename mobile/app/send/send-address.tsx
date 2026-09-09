import { Ionicons } from '@expo/vector-icons';
import BigNumber from 'bignumber.js';
import * as bip21 from 'bip21';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useContext, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Pressable from '../../components/Pressable';

import RadialGradientScreen from '@/components/RadialGradientScreen';
import ScreenSendHeader from '@/components/navigation/ScreenSendHeader';
import { ThemedText } from '@/components/ThemedText';
import TokensView from '@/components/TokensView';
import { LayerzStorage } from '@/src/class/layerz-storage';
import { overlayBackgroundDeeper } from '@shared/constants/Colors';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { RgbWallet } from '@shared/class/wallets/rgb-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { useTokenDiscovery } from '@shared/hooks/useTokenDiscovery';
import { getIsAccountBased, getIsEVM, getTickerByNetwork } from '@shared/models/network-getters';
import { validateAddress } from '@shared/modules/wallet-utils';
import { NETWORK_BITCOIN, NETWORK_LIQUID, NETWORK_LIQUID_TESTNET, NETWORK_RGB, NETWORK_RGB_TESTNET } from '@shared/types/networks';
import { CachedTokenInfo } from '@shared/types/token-info';
import { useSendFlow } from './_layout';

const SendAddress: React.FC = () => {
  const { scanQr } = useContext(ScanQrContext);
  const router = useRouter();
  const { accountNumber } = useContext(AccountNumberContext);
  const { network, address: contextAddress, setAddress: setContextAddress, token, setToken, setAmount, setDenomination, setMemo } = useSendFlow();
  const { tokenList } = useTokenDiscovery(network, accountNumber, BackgroundExecutor, LayerzStorage);

  const [localAddress, setLocalAddress] = useState(contextAddress);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const inputRef = useRef<TextInput>(null);

  const isRgb = network === NETWORK_RGB || network === NETWORK_RGB_TESTNET;

  const handleScanQR = useCallback(async () => {
    const scanned = await scanQr();
    if (scanned) {
      try {
        const decoded = bip21.decode(scanned);
        if (decoded?.address) {
          setLocalAddress(decoded.address);
        }
        if (decoded?.options?.amount) {
          setAmount(String(decoded.options.amount));
        }
      } catch {
        setLocalAddress(scanned);
      }
    }
  }, [scanQr, setAmount]);

  const handleContinue = async () => {
    if (!localAddress.trim()) {
      setErrorMessage('Please enter a recipient address');
      return;
    }

    setErrorMessage('');

    try {
      if (!validateAddress(network, localAddress)) {
        throw new Error('Invalid address');
      }
      setContextAddress(localAddress);

      // RGB invoices typically embed an asset id and amount. Decode here so the
      // user doesn't have to retype what the invoice already specifies — and so
      // we don't conflict with rgb-lib's `sendBegin`, which returns an empty
      // PSBT when both the invoice's amount and a separate `amount` arg are
      // passed.
      if (isRgb && (localAddress.startsWith('rgb:') || localAddress.startsWith('utxob:'))) {
        const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
        if (wallet instanceof RgbWallet) {
          const decoded = await wallet.decodeInvoice(localAddress);
          if (decoded) {
            const matchedToken = decoded.assetId ? tokenList?.find((t) => t.id === decoded.assetId) : undefined;
            if (matchedToken) setToken(matchedToken.id);
            if (typeof decoded.amount === 'number' && matchedToken) {
              const human = new BigNumber(decoded.amount).dividedBy(new BigNumber(10).pow(matchedToken.decimals)).toFixed();
              setAmount(human);
              // Invoice fully specifies the transfer → skip amount entry.
              router.push('/send/send-confirm');
              return;
            }
          }
        }
      }

      if (getIsEVM(network)) {
        router.push('/send/send-amount-evm');
      } else if (getIsAccountBased(network)) {
        router.push('/send/send-amount-acc');
      } else if (network === NETWORK_BITCOIN) {
        router.push('/send/send-amount-btc');
      } else if (network === NETWORK_LIQUID || network === NETWORK_LIQUID_TESTNET) {
        router.push('/send/send-amount-liquid');
      } else {
        throw new Error('Invalid network');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to validate address');
    }
  };

  const handleInputWrapperPress = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const handleTokenPress = useCallback(
    (clickedToken: CachedTokenInfo) => {
      setToken(token === clickedToken.id ? undefined : clickedToken.id);
      setAmount('');
      setDenomination('Native');
      setMemo('');
    },
    [token, setToken, setAmount, setDenomination, setMemo]
  );

  return (
    <RadialGradientScreen network={network} scroll={true}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenSendHeader network={network} title={`Send ${getTickerByNetwork(network)}`} />

      <View style={styles.container}>
        <View style={styles.inputSection}>
          <View style={styles.inputContainer}>
            <Pressable style={styles.inputWrapper} onPress={handleInputWrapperPress} activeOpacity={1} testID="send-address-input">
              <ThemedText style={styles.inputLabel}>To</ThemedText>
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder="Enter address"
                placeholderTextColor="rgba(255, 255, 255, 0.8)"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setLocalAddress}
                value={localAddress}
              />
            </Pressable>
            <Pressable style={styles.scanButton} onPress={handleScanQR}>
              <Ionicons name="scan-outline" size={24} color="rgba(255, 255, 255, 0.8)" />
            </Pressable>
          </View>

          {errorMessage && (
            <View style={styles.errorContainer}>
              <Ionicons name="close" size={16} color="white" />
              <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
            </View>
          )}
        </View>

        <TokensView onTokenPress={handleTokenPress} selectedToken={token} />

        <Pressable style={[styles.continueButton, !localAddress.trim() && styles.disabledButton]} onPress={handleContinue} disabled={!localAddress.trim()} testID="send-address-next-button">
          <ThemedText style={styles.continueButtonText}>Next</ThemedText>
        </Pressable>
      </View>
    </RadialGradientScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  inputSection: {
    marginBottom: 30,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: overlayBackgroundDeeper,
    borderRadius: 20,
    height: 64,
    paddingLeft: 24,
    paddingRight: 12,
    gap: 12,
  },
  inputWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  inputLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 4,
  },
  input: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    padding: 0,
    margin: 0,
  },
  scanButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  errorText: {
    color: 'white',
    fontSize: 14,
  },
  continueButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 'auto',
    marginBottom: 24,
  },
  continueButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default SendAddress;
