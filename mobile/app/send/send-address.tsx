import { Ionicons } from '@expo/vector-icons';
import * as bip21 from 'bip21';
import { useNavigation, useRouter } from 'expo-router';
import React, { useContext, useLayoutEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GradientScreen from '@/components/GradientScreen';
import { buildScreenHeaderOptions } from '@/components/navigation/ScreenHeader';
import { ThemedText } from '@/components/ThemedText';
import TokensView from '@/components/TokensView';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { getIsAccountBased, getIsEVM, getTickerByNetwork } from '@shared/models/network-getters';
import { validateAddress } from '@shared/modules/wallet-utils';
import { NETWORK_BITCOIN, NETWORK_LIQUID, NETWORK_LIQUID_TESTNET } from '@shared/types/networks';
import { CachedTokenInfo } from '@shared/types/token-info';
import { useSendFlow } from './_layout';

const SendAddress: React.FC = () => {
  const navigation = useNavigation();
  const { scanQr } = useContext(ScanQrContext);
  const router = useRouter();
  const { network, address: contextAddress, setAddress: setContextAddress, token, setToken, setAmount, setDenomination, setMemo } = useSendFlow();
  const insets = useSafeAreaInsets();

  const [localAddress, setLocalAddress] = useState(contextAddress);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const inputRef = useRef<TextInput>(null);

  const handleScanQR = async () => {
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
  };

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

  const handleInputWrapperPress = () => {
    inputRef.current?.focus();
  };

  const handleTokenPress = (clickedToken: CachedTokenInfo) => {
    setToken(token === clickedToken.id ? undefined : clickedToken.id);
    setAmount('');
    setDenomination('Native');
    setMemo('');
  };

  useLayoutEffect(() => {
    navigation.setOptions(buildScreenHeaderOptions({ headerTitle: `Send ${getTickerByNetwork(network)}`, headerShown: true }));
  }, [navigation, network]);

  return (
    <GradientScreen variant={network} scroll={true}>
      <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.inputSection}>
            <View style={styles.inputContainer}>
              <TouchableOpacity style={styles.inputWrapper} onPress={handleInputWrapperPress} activeOpacity={1} testID="send-address-input">
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
              </TouchableOpacity>
              <TouchableOpacity style={styles.scanButton} onPress={handleScanQR}>
                <Ionicons name="scan-outline" size={24} color="rgba(255, 255, 255, 0.8)" />
              </TouchableOpacity>
            </View>

            {errorMessage && (
              <View style={styles.errorContainer}>
                <Ionicons name="close" size={16} color="white" />
                <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
              </View>
            )}
          </View>

          <TokensView onTokenPress={handleTokenPress} selectedToken={token} />

          <TouchableOpacity style={[styles.continueButton, !localAddress.trim() && styles.disabledButton]} onPress={handleContinue} disabled={!localAddress.trim()} testID="send-address-next-button">
            <ThemedText style={styles.continueButtonText}>Next</ThemedText>
          </TouchableOpacity>
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

export default SendAddress;
