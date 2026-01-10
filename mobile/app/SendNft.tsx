import { Ionicons } from '@expo/vector-icons';
import * as bip21 from 'bip21';
import React, { useCallback, useContext, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';

import GradientScreen from '@/components/GradientScreen';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import { ThemedText } from '@/components/ThemedText';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { StacksWallet } from '@shared/class/wallets/stacks-wallet';
import { NftInfo } from '@shared/types/token-info';
import { NETWORK_STACKS } from '@shared/types/networks';
import { TSupportedLazyInitWalletNetworks } from '@shared/modules/wallet-utils';
import Pressable from '@/components/Pressable';

export type SendNftParams = {
  nft: string;
};

function parseNftParam(nftParam: string): NftInfo | null {
  try {
    return JSON.parse(nftParam) as NftInfo;
  } catch (_) {
    return null;
  }
}

export default function SendNft() {
  const params = useLocalSearchParams<SendNftParams>();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { scanQr } = useContext(ScanQrContext);

  const nft = useMemo(() => parseNftParam(params.nft), [params.nft]);
  const title = useMemo(() => {
    if (!nft) return 'Send NFT';
    if (nft.name) return `Send ${nft.name}`;
    const base = nft.collectionName || 'NFT';
    return nft.tokenId ? `Send ${base}-#${nft.tokenId}` : `Send ${base}`;
  }, [nft]);

  const [localAddress, setLocalAddress] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [txid, setTxid] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const handleScanQR = useCallback(async () => {
    try {
      const scanned = await scanQr();
      if (!scanned) return;
      try {
        const decoded = bip21.decode(scanned);
        if (decoded?.address) {
          setLocalAddress(decoded.address);
          return;
        }
      } catch (e: any) {
        console.error('Failed to decode BIP21 code', e.message);
      }
      setLocalAddress(scanned);
    } catch (e: any) {
      console.error('Failed to scan QR code', e.message);
      Alert.alert('Error', 'Failed to scan QR code');
    }
  }, [scanQr]);

  const handleInputWrapperPress = () => {
    inputRef.current?.focus();
  };

  const handleSend = useCallback(async () => {
    if (!nft) return;
    setErrorMessage('');

    if (network !== NETWORK_STACKS) {
      Alert.alert('Unsupported', 'NFT sending is currently supported only on Stacks.');
      return;
    }

    if (!localAddress.trim()) {
      setErrorMessage('Please enter a recipient address');
      return;
    }

    if (!StacksWallet.isAddressValid(localAddress)) {
      setErrorMessage('Invalid address');
      return;
    }

    setSending(true);
    try {
      const wallet: any = await BackgroundExecutor.lazyInitWallet(network as TSupportedLazyInitWalletNetworks, accountNumber);
      if (typeof wallet?.transferNFT !== 'function') {
        throw new Error('NFT transfer is not supported by this wallet');
      }

      const id = await wallet.transferNFT(nft, localAddress);
      setTxid(id);
    } catch (e: any) {
      console.error('Failed to send NFT', e.message);
      setErrorMessage(e?.message || 'Failed to send NFT');
    } finally {
      setSending(false);
    }
  }, [accountNumber, localAddress, network, nft]);

  if (!nft) {
    return (
      <GradientScreen variant={network}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.root}>
          <ScreenHeader title="Send NFT" />
          <View style={styles.center}>
            <ThemedText style={styles.errorText}>NFT not found</ThemedText>
          </View>
        </View>
      </GradientScreen>
    );
  }

  return (
    <GradientScreen variant={network}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.root}>
        <ScreenHeader title={title} />

        <View style={styles.content}>
          {/* Replicate input + scan button from /send/send-address.tsx */}
          <View style={styles.inputSection}>
            <View style={styles.inputContainer}>
              <Pressable style={styles.inputWrapper} onPress={handleInputWrapperPress} activeOpacity={1} testID="send-nft-address-input">
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
                  editable={!sending && !txid}
                  testID="send-nft-recipient-input"
                />
              </Pressable>
              <Pressable style={styles.scanButton} onPress={handleScanQR} disabled={sending || Boolean(txid)} testID="send-nft-scan-button">
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

          {txid ? (
            <View style={styles.successBox}>
              <ThemedText style={styles.successTitle}>NFT sent</ThemedText>
              <ThemedText style={styles.successSub} numberOfLines={1} ellipsizeMode="middle">
                Tx: {txid}
              </ThemedText>
              <Pressable style={styles.secondaryButton} onPress={() => router.replace('/Home')} activeOpacity={0.85} testID="send-nft-back-button">
                <ThemedText style={styles.secondaryButtonText}>Back to Wallet</ThemedText>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.primaryButton} onPress={handleSend} activeOpacity={0.85} disabled={sending} testID="send-nft-send-button">
              {sending ? <ActivityIndicator color="rgba(255,255,255,0.95)" /> : <ThemedText style={styles.primaryButtonText}>Send</ThemedText>}
            </Pressable>
          )}
        </View>
      </View>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  // Copied from /send/send-address.tsx
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
  primaryButton: {
    marginTop: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.95)',
  },
  successBox: {
    marginTop: 18,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.95)',
    marginBottom: 6,
  },
  successSub: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.75)',
  },
  secondaryButton: {
    marginTop: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.95)',
  },
});
