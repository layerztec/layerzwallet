import { Ionicons } from '@expo/vector-icons';
import Pressable from '../../components/Pressable';
import * as bip21 from 'bip21';
import { Stack, useRouter } from 'expo-router';
import React, { useContext, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';

import { BalanceUsdt } from '@/components/Balance';
import GradientScreen from '@/components/GradientScreen';
import ScreenSendHeader from '@/components/navigation/ScreenSendHeader';
import { ThemedText } from '@/components/ThemedText';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { EvmWallet } from '@shared/class/evm-wallet';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getTickerByNetwork } from '@shared/models/network-getters';
import { validateAddress } from '@shared/modules/wallet-utils';
import { NETWORK_LIQUID, NETWORK_LIQUID_TESTNET, NETWORK_ROOTSTOCK, NETWORK_SPARK, Networks } from '@shared/types/networks';
import { useSendFlow } from './_layout';
import { USDT_TOKENS } from '@shared/models/token-list';

const SendAddressUsdt: React.FC = () => {
  const { scanQr } = useContext(ScanQrContext);
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const { address: contextAddress, setAddress: setContextAddress, token, setToken, setNetwork } = useSendFlow();

  const [localAddress, setLocalAddress] = useState(contextAddress);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const inputRef = useRef<TextInput>(null);

  const handleScanQR = async () => {
    const scanned = await scanQr();
    if (scanned) {
      try {
        // Try to parse as BIP21 (may have bitcoin: prefix)
        const decoded = bip21.decode(scanned);
        if (decoded?.address) {
          setLocalAddress(decoded.address);
        }
      } catch {
        // Not BIP21, use as-is
        setLocalAddress(scanned.trim());
      }
      setShowError(false);
    }
  };

  const handleTokenSelect = (selectedToken: string, selectedNetwork: Networks) => {
    setToken(selectedToken);
    setNetwork(selectedNetwork);
  };

  const handleContinue = async () => {
    const address = localAddress.trim();
    try {
      if (!address) {
        setErrorMessage('Please enter a recipient address');
        setShowError(true);
        return;
      }

      if (!token) {
        setErrorMessage('Please select a USDT token');
        setShowError(true);
        return;
      }

      // Validate address based on selected token's network
      let isValid = false;
      let tokenNetwork: Networks = token === 'ce091c998b83c78bb71a632313ba3760f1763d9cfcffae02258ffa9865a37bd2' ? NETWORK_LIQUID : NETWORK_ROOTSTOCK;

      for (const tokNet of Object.keys(USDT_TOKENS) as Networks[]) {
        // @ts-ignore ts stfu
        if (USDT_TOKENS[tokNet]?.includes(token)) {
          tokenNetwork = tokNet;
          break;
        }
      }

      if (tokenNetwork === NETWORK_ROOTSTOCK) {
        // EVM address validation
        isValid = EvmWallet.isAddressValid(address);
        if (!isValid) {
          throw new Error('Invalid Rootstock address');
        }
      } else if (tokenNetwork === NETWORK_LIQUID || tokenNetwork === NETWORK_LIQUID_TESTNET) {
        // Liquid address validation
        isValid = validateAddress(tokenNetwork, address);
        if (!isValid) {
          throw new Error('Invalid Liquid address');
        }
      } else if (tokenNetwork === NETWORK_SPARK) {
        // Spark address validation
        isValid = validateAddress(tokenNetwork, address);
        if (!isValid) {
          throw new Error('Invalid Spark address');
        }
      } else {
        throw new Error('Internal error: not USDT token');
      }

      setContextAddress(address);
      router.push({ pathname: '/send/send-amount-usdt' } as any);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to validate address');
      setShowError(true);
    }
  };

  const handleInputWrapperPress = () => {
    inputRef.current?.focus();
  };

  const canContinue = localAddress.trim() && token;

  return (
    <GradientScreen variant={network} scroll={true}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenSendHeader network={network} title={`Send ${getTickerByNetwork(network)}`} />

      <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <View style={styles.container}>
          <View style={styles.inputSection}>
            <View style={styles.inputContainer}>
              <Pressable style={styles.inputWrapper} onPress={handleInputWrapperPress} activeOpacity={1} testID="send-address-usdt-input">
                <ThemedText style={styles.inputLabel}>To</ThemedText>
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  placeholder="Enter recipient address"
                  placeholderTextColor="rgba(255, 255, 255, 0.8)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={(text) => {
                    setLocalAddress(text);
                    setShowError(false);
                  }}
                  value={localAddress}
                />
              </Pressable>
              <Pressable style={styles.scanButton} onPress={handleScanQR} testID="send-address-usdt-scan-qr">
                <Ionicons name="scan-outline" size={24} color="rgba(255, 255, 255, 0.8)" />
              </Pressable>
            </View>

            {showError && errorMessage && (
              <View style={styles.errorContainer}>
                <Ionicons name="close" size={16} color="white" />
                <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
              </View>
            )}
          </View>

          <BalanceUsdt onSelectToken={handleTokenSelect} selectedToken={token} showTotalBalance={false} />

          <Pressable style={[styles.continueButton, !canContinue && styles.disabledButton]} onPress={handleContinue} disabled={!canContinue} testID="send-address-usdt-continue">
            <ThemedText style={styles.continueButtonText}>Next</ThemedText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </GradientScreen>
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
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
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

export default SendAddressUsdt;
