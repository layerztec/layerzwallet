import { Ionicons } from '@expo/vector-icons';
import assert from 'assert';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';

import RadialGradientScreen from '@/components/RadialGradientScreen';
import ScreenSendHeader from '@/components/navigation/ScreenSendHeader';
import { ThemedText } from '@/components/ThemedText';
import TokensView from '@/components/TokensView';
import { overlayBackgroundDeeper } from '@shared/constants/Colors';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { RGBWallet, type RgbDecodedInvoice } from '@shared/class/wallets/rgb-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { getTickerByNetwork } from '@shared/models/network-getters';
import { NETWORK_RGB, NETWORK_RGB_TESTNET } from '@shared/types/networks';
import { CachedTokenInfo } from '@shared/types/token-info';
import Pressable from '../../components/Pressable';
import { useSendFlow } from './_layout';

const SendAddressRgb: React.FC = () => {
  const { scanQr } = useContext(ScanQrContext);
  const router = useRouter();
  const { network: networkType, address: contextAddress, setAddress: setContextAddress, token, setToken, setAmount, setDenomination, setMemo, setRgbDecodedInvoice } = useSendFlow();
  const network = networkType as typeof NETWORK_RGB | typeof NETWORK_RGB_TESTNET;
  const { accountNumber } = useContext(AccountNumberContext);

  const [localAddress, setLocalAddress] = useState(contextAddress);
  const [errorMessage, setErrorMessage] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [decodedInvoice, setDecodedInvoice] = useState<RgbDecodedInvoice | undefined>();
  const inputRef = useRef<TextInput>(null);

  const handleScanQR = async () => {
    const scanned = await scanQr();
    if (scanned) {
      setLocalAddress(scanned.trim());
    }
  };

  const validateInvoice = useCallback(
    async (invoice: string) => {
      setIsValidating(true);
      setErrorMessage('');
      setDecodedInvoice(undefined);

      try {
        const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
        assert(wallet instanceof RGBWallet, 'Not an RGB wallet');
        const decoded = await wallet.decodeRgbInvoice(invoice);

        // If invoice specifies an assetId, check if user has this token
        if (decoded.assetId) {
          const tokenBalances = wallet.getTokenBalances();
          const matchingToken = tokenBalances.find((t) => t.id === decoded.assetId);
          if (!matchingToken) {
            setErrorMessage("You don't have this token");
            return;
          }
          setToken(decoded.assetId);
        }

        setDecodedInvoice(decoded);
        setRgbDecodedInvoice(decoded);
      } catch (e: any) {
        setErrorMessage(e.message || 'Invalid RGB invoice');
        setRgbDecodedInvoice(undefined);
      } finally {
        setIsValidating(false);
      }
    },
    [network, accountNumber, setToken, setRgbDecodedInvoice]
  );

  // Validate on input change (debounced for RGB invoices)
  useEffect(() => {
    const trimmed = localAddress.trim();
    if (!trimmed) {
      setErrorMessage('');
      setDecodedInvoice(undefined);
      setRgbDecodedInvoice(undefined);
      return;
    }

    if (RGBWallet.isRgbInvoice(trimmed)) {
      const timeoutId = setTimeout(() => {
        validateInvoice(trimmed);
      }, 300);
      return () => clearTimeout(timeoutId);
    } else if (RGBWallet.isTaprootAddress(trimmed)) {
      setErrorMessage('');
      setDecodedInvoice(undefined);
      setRgbDecodedInvoice(undefined);
      setToken(undefined);
    } else {
      setErrorMessage('Enter an RGB invoice (rgb:...) or taproot address');
      setDecodedInvoice(undefined);
      setRgbDecodedInvoice(undefined);
    }
  }, [localAddress, validateInvoice, setRgbDecodedInvoice, setToken]);

  const handleContinue = () => {
    const trimmed = localAddress.trim();
    if (!trimmed || isValidating || errorMessage) return;

    const isInvoice = RGBWallet.isRgbInvoice(trimmed);

    if (isInvoice && !decodedInvoice) {
      setErrorMessage('Please wait for invoice validation');
      return;
    }

    // RGB invoices require a token (can't send BTC to an invoice)
    if (isInvoice && !token) {
      setErrorMessage('Please select a token');
      return;
    }

    setContextAddress(trimmed);
    router.push('/send/send-amount-rgb');
  };

  const handleInputWrapperPress = () => {
    inputRef.current?.focus();
  };

  const handleTokenPress = (clickedToken: CachedTokenInfo) => {
    setToken(token === clickedToken.id ? undefined : clickedToken.id);
    setAmount('');
    setDenomination('Native');
    setMemo('');
  };

  const trimmed = localAddress.trim();
  const isInvoice = RGBWallet.isRgbInvoice(trimmed);
  // Allow token selection only for RGB invoices that don't specify an asset
  const canSelectToken = isInvoice && decodedInvoice && !decodedInvoice.assetId;
  // Taproot: ready when valid address; Invoice: ready when decoded + token selected
  const canContinue = !!trimmed && !isValidating && !errorMessage && (!isInvoice || (!!decodedInvoice && !!token));

  // Build info message for valid decoded invoices
  let invoiceInfoText: string | null = null;
  if (decodedInvoice && !errorMessage && !isValidating) {
    const parts: string[] = [];
    if (decodedInvoice.assetId) parts.push('Token detected');
    if (decodedInvoice.assignment?.amount) parts.push(`Amount: ${decodedInvoice.assignment.amount}`);
    invoiceInfoText = parts.length > 0 ? parts.join(' · ') : 'Valid RGB invoice';
  }

  return (
    <RadialGradientScreen network={network} scroll={true}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenSendHeader network={network} title={`Send ${getTickerByNetwork(network)}`} />

      <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <View style={styles.container}>
          <View style={styles.inputSection}>
            <View style={styles.inputContainer}>
              <Pressable style={styles.inputWrapper} onPress={handleInputWrapperPress} activeOpacity={1} testID="send-rgb-address-input">
                <ThemedText style={styles.inputLabel}>To</ThemedText>
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  placeholder="Enter RGB invoice or taproot address"
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

            {isValidating && (
              <View style={styles.validatingContainer}>
                <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.8)" />
                <ThemedText style={styles.validatingText}>Validating invoice...</ThemedText>
              </View>
            )}

            {errorMessage && !isValidating && (
              <View style={styles.errorContainer}>
                <Ionicons name="close" size={16} color="white" />
                <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
              </View>
            )}

            {invoiceInfoText && (
              <View style={styles.infoContainer}>
                <Ionicons name="checkmark-circle" size={16} color="rgba(100, 255, 100, 0.8)" />
                <ThemedText style={styles.infoText}>{invoiceInfoText}</ThemedText>
              </View>
            )}
          </View>

          <TokensView onTokenPress={handleTokenPress} selectedToken={token} disabled={!canSelectToken} />

          <Pressable style={[styles.continueButton, !canContinue && styles.disabledButton]} onPress={handleContinue} disabled={!canContinue} testID="send-rgb-address-next-button">
            <ThemedText style={styles.continueButtonText}>Next</ThemedText>
          </Pressable>
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
  validatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  validatingText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
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
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  infoText: {
    color: 'rgba(255, 255, 255, 0.8)',
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

export default SendAddressRgb;
