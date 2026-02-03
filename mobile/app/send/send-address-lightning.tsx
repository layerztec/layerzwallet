import { Ionicons } from '@expo/vector-icons';
import Pressable from '../../components/Pressable';
import assert from 'assert';
import * as bip21 from 'bip21';
import * as bolt11 from 'bolt11';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';

import { BalanceLightning } from '@/components/Balance';
import RadialGradientScreen from '@/components/RadialGradientScreen';
import ScreenSendHeader from '@/components/navigation/ScreenSendHeader';
import { ThemedText } from '@/components/ThemedText';
import { overlayBackgroundDeeper } from '@shared/constants/Colors';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import Lnurl, { LnurlPayServicePayload } from '@shared/class/lnurl';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getIsTestnet, getTickerByNetwork } from '@shared/models/network-getters';
import { convertMerchantQRToLightningAddress } from '@shared/modules/merchants';
import { Networks } from '@shared/types/networks';
import { DecodedInvoice, LightningLayer, useSendFlow } from './_layout';

const SendAddressLightning: React.FC = () => {
  const { scanQr } = useContext(ScanQrContext);
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const { lightning, address } = useSendFlow();
  assert(lightning, 'Lightning context not found');
  const { layer } = lightning;

  const [showError, setShowError] = useState(false);
  const [localInvoice, setLocalInvoice] = useState(address);
  const [validating, setValidating] = useState<{ [invoice: string]: boolean }>({});
  const [errorMessages, setErrorMessages] = useState<{ [invoice: string]: string }>({});
  const [lnurlPayServicePayload, setLnurlPayServicePayload] = useState<{ [invoice: string]: LnurlPayServicePayload }>({});
  const [lnurlInstance, setLnurlInstance] = useState<{ [invoice: string]: Lnurl | undefined }>({});
  const [decodedInvoice, setDecodedInvoice] = useState<{ [invoice: string]: DecodedInvoice | undefined }>({});
  const [memo, setMemo] = useState<{ [invoice: string]: string | undefined }>({});
  const inputRef = useRef<TextInput>(null);

  const handleLayerSelect = (selectedNetwork: Networks) => {
    const n = selectedNetwork as LightningLayer;
    lightning.setLayer((current) => (current === n ? undefined : n));
    validateInvoice(localInvoice);
    setShowError(false);
  };

  const handleScanQR = async () => {
    const scanned = await scanQr();
    if (scanned) {
      const scanned2use = scanned.trim().replace('lightning:', '').replace('LIGHTNING:', '');
      setLocalInvoice(scanned2use);
      setShowError(false);
    }
  };

  const validateInvoice = useCallback(
    async (i: string) => {
      let invoice = i.trim();

      try {
        setValidating((prev) => ({ ...prev, [invoice]: true }));
        setErrorMessages((prev) => {
          const { [invoice]: _, ...newErrors } = prev;
          return newErrors;
        });

        if (!invoice) {
          setErrorMessages((prev) => ({ ...prev, [invoice]: 'Please enter a lightning invoice or address' }));
          return;
        }
        if (!layer) {
          setErrorMessages((prev) => ({ ...prev, [invoice]: 'Please select a Layer' }));
          return;
        }

        const networkToUse = getIsTestnet(network) ? 'signet' : 'mainnet';

        // Check for merchant QR code conversion
        const merchantLightningAddress = convertMerchantQRToLightningAddress({ qrContent: invoice, network: networkToUse });
        if (merchantLightningAddress) {
          invoice = merchantLightningAddress;
        }

        // Handle Lightning Address (LNURL)
        if (Lnurl.isLightningAddress(invoice)) {
          try {
            invoice = encodeURIComponent(invoice.split('@')[0]) + '@' + invoice.split('@')[1];
            const ln = new Lnurl(invoice);
            const response = await ln.callLnurlPayService();
            if (response) {
              setLnurlInstance((prev) => ({ ...prev, [invoice]: ln }));
              setLnurlPayServicePayload((prev) => ({ ...prev, [invoice]: response }));
              return;
            }
          } catch (error: any) {
            setErrorMessages((prev) => ({ ...prev, [invoice]: 'Lightning Address fetch error: ' + error.message }));
            return;
          }
        }

        // Handle BIP21 format
        try {
          const bip21decoded = bip21.decode(invoice);
          // @ts-ignore `lightning` is not part of bip21 spec, but a valid extension
          if (bip21decoded?.options?.lightning) {
            // @ts-ignore
            invoice = bip21decoded.options.lightning;
          }
        } catch {}

        // Decode BOLT11 invoice
        const decoded = bolt11.decode(invoice);
        if (!decoded.satoshis) {
          setErrorMessages((prev) => ({ ...prev, [invoice]: 'Zero amount invoices are not supported' }));
          return;
        }
        setDecodedInvoice((prev) => ({ ...prev, [invoice]: decoded }));

        // Extract memo
        const memoTag = decoded.tags.find((tag: any) => tag.tagName === 'description');
        if (memoTag) {
          setMemo((prev) => ({ ...prev, [invoice]: String(memoTag.data) }));
        }
      } catch (error: any) {
        setErrorMessages((prev) => ({ ...prev, [invoice]: error.message || 'Invalid lightning invoice or address' }));
      } finally {
        setValidating((prev) => ({ ...prev, [invoice]: false }));
      }
    },
    [layer, network]
  );

  useEffect(() => {
    setShowError(false);
  }, [localInvoice]);

  useEffect(() => {
    if (localInvoice) {
      const timeoutId = setTimeout(() => {
        validateInvoice(localInvoice);
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [localInvoice, validateInvoice]);

  const handleContinue = async () => {
    const invoice = localInvoice.trim();
    try {
      if (!invoice) {
        return;
      }
      if (validating[invoice]) {
        return;
      }
      if (errorMessages[invoice]) {
        setShowError(true);
        return;
      }

      const decoded = decodedInvoice[invoice];
      const lnurlPSPayload = lnurlPayServicePayload[invoice];
      const lnurlInst = lnurlInstance[invoice];
      const redirectToAmountScreen = lnurlPSPayload || !decoded?.satoshis;

      if (decoded) {
        lightning.setDecodedInvoice(decoded);
      }
      if (lnurlPSPayload) {
        lightning.setLnurlPayServicePayload(lnurlPSPayload);
      }
      if (lnurlInst) {
        lightning.setLnurlInstance(lnurlInst);
      }

      if (redirectToAmountScreen) {
        router.push('/send/send-amount-lightning');
      } else {
        lightning.setInvoice(invoice);
        router.push('/send/send-confirm-lightning');
      }
    } catch (error: any) {
      setErrorMessages((prev) => ({ ...prev, [invoice]: error.message || 'An error occurred' }));
      setShowError(true);
    }
  };

  const handleInputWrapperPress = () => {
    inputRef.current?.focus();
  };

  const invoice = localInvoice.trim();
  const isLightningAddress = Boolean(lnurlPayServicePayload[invoice]);
  const canContinue = invoice && !validating[invoice];

  return (
    <RadialGradientScreen network={network} scroll={true}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenSendHeader network={network} title={`Send ${getTickerByNetwork(network)}`} />

      <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <View style={styles.container}>
          <View style={styles.inputSection}>
            <View style={styles.inputContainer}>
              <Pressable style={styles.inputWrapper} onPress={handleInputWrapperPress} activeOpacity={1} testID="send-lightning-invoice-input">
                <ThemedText style={styles.inputLabel}>To</ThemedText>
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  placeholder="Enter lightning invoice or address"
                  placeholderTextColor="rgba(255, 255, 255, 0.8)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setLocalInvoice}
                  value={localInvoice}
                />
              </Pressable>
              <Pressable style={styles.scanButton} onPress={handleScanQR}>
                <Ionicons name="scan-outline" size={24} color="rgba(255, 255, 255, 0.8)" />
              </Pressable>
            </View>

            {showError && errorMessages[invoice] && (
              <View style={styles.errorContainer}>
                <Ionicons name="close" size={16} color="white" />
                <ThemedText style={styles.errorText}>{errorMessages[invoice]}</ThemedText>
              </View>
            )}
          </View>

          <BalanceLightning onSelectNetwork={handleLayerSelect} selectedNetwork={layer} showTotalBalance={false} />

          {isLightningAddress && lnurlPayServicePayload[invoice] && (
            <View style={styles.lightningAddressInfo}>
              <Ionicons name="information-circle" size={20} color="rgba(255, 255, 255, 0.8)" />
              <ThemedText style={styles.lightningAddressText}>{lnurlPayServicePayload[invoice]?.description || 'Lightning Address detected'}</ThemedText>
            </View>
          )}

          {memo[invoice] && (
            <View style={styles.memoInfo}>
              <Ionicons name="information-circle" size={20} color="rgba(255, 255, 255, 0.8)" />
              <ThemedText style={styles.memoText}>Memo: {memo[invoice]}</ThemedText>
            </View>
          )}

          <Pressable style={[styles.continueButton, !canContinue && styles.disabledButton]} onPress={handleContinue} disabled={!canContinue} testID="send-lightning-address-next-button">
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
  lightningAddressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
    backgroundColor: overlayBackgroundDeeper,
    padding: 12,
    borderRadius: 12,
  },
  lightningAddressText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    flex: 1,
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
  memoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
    backgroundColor: overlayBackgroundDeeper,
    padding: 12,
    borderRadius: 12,
  },
  memoText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    flex: 1,
  },
});

export default SendAddressLightning;
