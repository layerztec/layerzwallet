import BigNumber from 'bignumber.js';
import Pressable from '../components/Pressable';
import * as bip21 from 'bip21';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import * as bolt11 from 'bolt11';

import RadialGradientScreen from '@/components/RadialGradientScreen';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import LongPressButton from '@/components/LongPressButton';
import { ThemedText } from '@/components/ThemedText';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { formatBalance } from '@shared/modules/string-utils';
import { NETWORK_ARK, NETWORK_BITCOIN, NETWORK_LIQUID, NETWORK_LIQUID_TESTNET, NETWORK_SPARK } from '@shared/types/networks';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { TLightningWallet } from '@shared/types/TWallet';
import { Ionicons } from '@expo/vector-icons';
import assert from 'assert';
import Lnurl, { LnurlPayServicePayload } from '@shared/class/lnurl';
import { convertMerchantQRToLightningAddress } from '@shared/modules/merchants';
import { walletSupportsLightning } from '@shared/class/wallets/interface-lightning-wallet';

export type SendLightningProps = {
  network: typeof NETWORK_SPARK | typeof NETWORK_LIQUID | typeof NETWORK_LIQUID_TESTNET | typeof NETWORK_ARK;
  invoice?: string;
};

const maxFeePercent = 5; // hardcoded at the moment. might give user option to adjust later

const SendLightning: React.FC = () => {
  const params = useLocalSearchParams<SendLightningProps>();
  const router = useRouter();
  const network = params.network;
  const { scanQr } = useContext(ScanQrContext);
  const [error, setError] = useState<string>('');
  const [sendState, setSendState] = useState<'idle' | 'preparing' | 'prepared' | 'sending' | 'success'>('idle');
  const [feeSats, setFeeSats] = useState<number | null>(null);
  const [amountToSend, setAmountToSend] = useState<string>('');
  const [memo, setMemo] = useState<string>('');
  const [invoice, setInvoice] = useState<string>(params.invoice ?? '');
  const { accountNumber } = useContext(AccountNumberContext);
  const walletRef = useRef<TLightningWallet | null>(null);

  const [lnurl, setLnurl] = useState<Lnurl | undefined>();
  const [lnurlPayServicePayload, setLnurlPayServicePayload] = useState<{ [key: string]: LnurlPayServicePayload }>({});
  const [lnAddressAmountToSend, setLnAddressAmountToSend] = useState<string>('');

  const isPayingToLightningAddress = Boolean(lnurlPayServicePayload[invoice]);

  const onInvoiceInput = async (scanned: string) => {
    const scanned2use = scanned.trim().replace('lightning:', '').replace('LIGHTNING:', ''); // sanitize
    setInvoice(scanned2use);
  };

  useEffect(() => {
    (async () => {
      let invoice2use = invoice;
      if (invoice2use) console.log('got invoice in useEffect params!', invoice2use);
      if (!invoice2use) return;

      try {
        setError('');

        const merchantLightningAddress = convertMerchantQRToLightningAddress({ qrContent: invoice2use, network: 'mainnet' });
        if (merchantLightningAddress) {
          invoice2use = merchantLightningAddress;
        }

        if (Lnurl.isLightningAddress(invoice2use)) {
          try {
            // need to fetch details, like minimum and maximum sat payment
            invoice2use = encodeURIComponent(invoice2use.split('@')[0]) + '@' + invoice2use.split('@')[1]; // copensating for router automatically urldecoding the ln address in param
            const ln = new Lnurl(invoice2use);
            const response = await ln.callLnurlPayService();
            if (response) {
              setLnurl(ln);
              setLnurlPayServicePayload((prev) => ({ ...prev, [invoice]: response, [invoice2use]: response }));
              if (response.min && response.min === response.max) {
                setLnAddressAmountToSend(String(response.min));
              }
              return;
            }
          } catch (error: any) {
            console.log('Lightning Address fetch error:', error.message);
            setError('Lightning Address fetch error: ' + error.message);
          }
          return;
        }

        try {
          const bip21decoded = bip21.decode(invoice2use);
          // @ts-ignore `lightning` is not part of bip21 spec, but a valid extension of bip21 thats widely used
          if (bip21decoded?.options?.lightning) {
            // @ts-ignore
            setInvoice(bip21decoded?.options?.lightning);
            return; // useEffect will re-run with the correct parsed invoice
          }
        } catch {}

        const decoded = bolt11.decode(invoice2use);
        setAmountToSend(decoded.satoshis ? String(decoded.satoshis) : '');

        if (!decoded.satoshis) {
          throw new Error('Could not determine payment amount from invoice');
        }

        const memoTag = decoded.tags.find((tag: any) => tag.tagName === 'description');
        if (memoTag) {
          setMemo(String(memoTag.data));
        }

        const feeBN = new BigNumber(decoded.satoshis).dividedBy(100).multipliedBy(maxFeePercent).toNumber();
        setFeeSats(Math.max(Math.round(feeBN), 2));
        setError('');
      } catch (error: any) {
        setError(error.message);
      }
    })();
  }, [invoice, params.invoice, router]);

  const handleQRScan = async () => {
    const scanned = await scanQr();
    scanned && (await onInvoiceInput(scanned));
  };

  // Initialize the wallet
  useEffect(() => {
    const initializeWallet = async () => {
      try {
        const w = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
        assert(walletSupportsLightning(w));
        walletRef.current = w;
      } catch (err) {
        console.error('Failed to initialize wallet:', err);
        setError('Failed to initialize wallet. Please try again.');
      }
    };

    initializeWallet();

    return () => {
      walletRef.current = null;
    };
  }, [accountNumber, network]);

  const prepareTransaction = async () => {
    setSendState('preparing');
    setError('');
    try {
      await new Promise((r) => setTimeout(r, 200)); // propagate state

      setSendState('prepared');
    } catch (error: any) {
      console.error('Prepare transaction error:', error);
      setError(error.message);
      setSendState('idle');
    }
  };

  const prepareLightningAddressPayment = async () => {
    setSendState('preparing');
    setError('');
    try {
      assert(walletRef.current, 'Internal error: wallet not initialized');

      assert(lnurl && lnAddressAmountToSend && parseInt(lnAddressAmountToSend), 'Internal error: lnurl and amount to send not set');

      const bolt11payload = await lnurl.requestBolt11FromLnurlPayService(parseInt(lnAddressAmountToSend), 'LayerzWallet');

      if (bolt11payload && bolt11payload.pr) {
        setSendState('prepared');
        setLnurlPayServicePayload((prev) => ({ ...prev, [bolt11payload.pr]: prev[invoice] }));
        await onInvoiceInput(bolt11payload.pr);
      } else {
        throw new Error('Fetching invoice from LNURL service failed');
      }
    } catch (error: any) {
      console.error('Prepare lightning address payment error:', error);
      setError(error.message);
      setSendState('idle');
    }
  };

  const sendLightningAddressPayment = async () => {
    try {
      if (!walletRef.current) {
        throw new Error('Internal error: wallet not initialized');
      }

      assert(lnurl && lnAddressAmountToSend && parseInt(lnAddressAmountToSend), 'Internal error: lnurl and amount to send not set');

      setSendState('sending');
      await new Promise((r) => setTimeout(r, 200)); // propagate

      if (invoice) {
        // Send payment
        const paymentResponse = await walletRef.current.payLightningInvoice(invoice, maxFeePercent);

        if (paymentResponse) {
          setSendState('success');
        } else {
          setSendState('idle');
          setError('Payment failed');
        }
      }
    } catch (error: any) {
      console.error('Send lightning address payment error:', error);
      setError(error.message);
      setSendState('idle');
    }
  };

  const sendPayment = async () => {
    try {
      if (!walletRef.current) {
        throw new Error('Internal error: wallet not initialized');
      }

      setSendState('sending');
      await new Promise((r) => setTimeout(r, 200)); // propagate

      // Send payment
      const paymentResponse = await walletRef.current.payLightningInvoice(invoice, maxFeePercent);

      if (paymentResponse) {
        setSendState('success');
      } else {
        setSendState('idle');
        setError('Payment failed');
      }
    } catch (error: any) {
      console.error('Send payment error:', error);
      setError(error.message);
      setSendState('idle');
    }
  };

  const handleCancel = () => {
    setInvoice('');
    setError('');
    setLnurl(undefined);
    setLnurlPayServicePayload({});
    setLnAddressAmountToSend('');
    setSendState('idle');
  };

  if (sendState === 'success') {
    return (
      <RadialGradientScreen network={network}>
        <ScreenHeader title="Send Lightning" />
        <View style={styles.successContainer}>
          <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
          <ThemedText style={styles.successMessage}>Payment Sent!</ThemedText>
          <ThemedText style={styles.successSubMessage}>{amountToSend ? formatBalance(amountToSend, 8, 8) : ''} sats</ThemedText>
          <Pressable style={styles.backButton} onPress={() => router.replace('/home')}>
            <ThemedText style={styles.backButtonText}>Back to Wallet</ThemedText>
          </Pressable>
        </View>
      </RadialGradientScreen>
    );
  }

  return (
    <RadialGradientScreen network={network}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Send Lightning" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentContainer}>
          {/* Network Badge */}
          <View style={styles.networkBadge}>
            <Ionicons name="flash" size={16} color="rgba(255, 255, 255, 0.9)" />
            <ThemedText style={styles.networkText}>{network?.toUpperCase()} LIGHTNING</ThemedText>
          </View>

          {/* Error Display */}
          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning" size={20} color="#ff4444" />
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            </View>
          ) : null}

          {/* Invoice Input Section */}
          {!isPayingToLightningAddress && (
            <View style={styles.inputSection}>
              <View style={styles.invoiceContainer}>
                <TextInput
                  style={styles.invoiceInput}
                  placeholder="Lightning invoice or Lightning address here"
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                  onChangeText={onInvoiceInput}
                  value={invoice}
                  multiline
                  textAlignVertical="top"
                />
                <Pressable style={styles.scanButton} onPress={handleQRScan}>
                  <Ionicons name="scan-outline" size={20} color="rgba(255, 255, 255, 0.8)" />
                </Pressable>
              </View>
            </View>
          )}

          {isPayingToLightningAddress && (
            <>
              <View style={styles.detailsContainer}>
                <ThemedText style={styles.detailsTitle}>Paying to Lightning Address</ThemedText>

                {lnurlPayServicePayload[invoice]?.min && lnurlPayServicePayload[invoice]?.max && (
                  <>
                    {lnurlPayServicePayload[invoice]?.description ? <ThemedText style={[styles.detailValue, { marginBottom: 10 }]}>{lnurlPayServicePayload[invoice]?.description}</ThemedText> : null}
                    <TextInput
                      placeholderTextColor="rgba(255, 255, 255, 0.6)"
                      style={styles.invoiceInput}
                      onChangeText={setLnAddressAmountToSend}
                      value={lnAddressAmountToSend}
                      keyboardType="numeric"
                      editable={!lnurlPayServicePayload[invoice]?.fixed}
                      placeholder={`Enter amount between ${lnurlPayServicePayload[invoice]?.min} and ${lnurlPayServicePayload[invoice]?.max} sats`}
                    />
                  </>
                )}
              </View>

              {sendState === 'prepared' && (
                <View style={styles.detailsContainer}>
                  <ThemedText style={styles.detailsTitle}>Payment Details</ThemedText>

                  <View style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel}>Amount:</ThemedText>
                    <ThemedText style={styles.detailValue}>
                      {amountToSend ? formatBalance(amountToSend, getDecimalsByNetwork(NETWORK_BITCOIN)) : ''} {getTickerByNetwork(NETWORK_BITCOIN)}
                    </ThemedText>
                  </View>

                  {memo && (
                    <View style={styles.detailRow}>
                      <ThemedText style={styles.detailLabel}>Memo:</ThemedText>
                      <ThemedText style={styles.detailValue}>{memo}</ThemedText>
                    </View>
                  )}

                  {feeSats !== null && (
                    <View style={styles.detailRow}>
                      <ThemedText style={styles.detailLabel}>Fee:</ThemedText>
                      <ThemedText style={styles.detailValue}>up to {feeSats} sats</ThemedText>
                    </View>
                  )}
                </View>
              )}

              {/* Verify Button */}
              {sendState === 'idle' && (
                <Pressable style={[styles.verifyButton]} onPress={prepareLightningAddressPayment}>
                  <Ionicons name="flash" size={20} color="rgba(255, 255, 255, 0.8)" />
                  <ThemedText style={styles.verifyButtonText}>Send Payment</ThemedText>
                </Pressable>
              )}

              {/* Confirm Payment */}
              {sendState === 'prepared' && (
                <View style={styles.lightningAddressConfirmContainer}>
                  <LongPressButton
                    style={styles.confirmButton}
                    textStyle={styles.confirmButtonText}
                    onLongPressComplete={sendLightningAddressPayment}
                    title="Hold to send payment"
                    progressColor="rgba(255, 255, 255, 0.3)"
                    backgroundColor="#000000"
                  />
                  <Pressable onPress={handleCancel} style={styles.cancelButton}>
                    <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
                  </Pressable>
                </View>
              )}
            </>
          )}

          {/* Loading Display */}
          {sendState === 'preparing' || sendState === 'sending' ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.8)" />
              <ThemedText style={styles.loadingText}>{sendState === 'preparing' ? 'Preparing payment...' : 'Sending payment...'}</ThemedText>
            </View>
          ) : null}

          {/* Payment Details */}
          {!isPayingToLightningAddress && invoice && amountToSend && (sendState === 'idle' || sendState === 'prepared') ? (
            <View style={styles.detailsContainer}>
              <ThemedText style={styles.detailsTitle}>Payment Details</ThemedText>

              <View style={styles.detailRow}>
                <ThemedText style={styles.detailLabel}>Amount:</ThemedText>
                <ThemedText style={styles.detailValue}>
                  {amountToSend ? formatBalance(amountToSend, getDecimalsByNetwork(NETWORK_BITCOIN)) : ''} {getTickerByNetwork(NETWORK_BITCOIN)}
                </ThemedText>
              </View>

              {memo && (
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Memo:</ThemedText>
                  <ThemedText style={styles.detailValue}>{memo}</ThemedText>
                </View>
              )}

              {feeSats !== null && (
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Fee:</ThemedText>
                  <ThemedText style={styles.detailValue}>up to {feeSats} sats</ThemedText>
                </View>
              )}
            </View>
          ) : null}

          {/* Verify Button */}
          {!isPayingToLightningAddress && sendState === 'idle' && invoice && amountToSend && (
            <Pressable style={[styles.verifyButton]} onPress={prepareTransaction}>
              <Ionicons name="flash" size={20} color="rgba(255, 255, 255, 0.8)" />
              <ThemedText style={styles.verifyButtonText}>Send Payment</ThemedText>
            </Pressable>
          )}

          {/* Confirm Payment */}
          {!isPayingToLightningAddress && sendState === 'prepared' && (
            <View style={styles.confirmContainer}>
              <LongPressButton
                style={styles.confirmButton}
                textStyle={styles.confirmButtonText}
                onLongPressComplete={sendPayment}
                title="Hold to send payment"
                progressColor="rgba(255, 255, 255, 0.3)"
                backgroundColor="#000000"
              />

              <Pressable onPress={handleCancel} style={styles.cancelButton}>
                <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </RadialGradientScreen>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  contentContainer: {
    flex: 1,
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 149, 0, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.4)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 30,
    gap: 6,
  },
  networkText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  inputSection: {
    marginBottom: 30,
  },
  invoiceContainer: {
    marginTop: 100,
    flexDirection: 'row',
    gap: 12,
  },
  invoiceInput: {
    flex: 1,
    maxHeight: 300,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  scanButton: {
    width: 50,
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  errorText: {
    color: '#ff4444',
    flex: 1,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    gap: 10,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  detailsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  detailsTitle: {
    marginBottom: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  detailValue: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 'auto',
    marginBottom: 20,
    gap: 8,
  },
  verifyButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  confirmContainer: {
    marginTop: 'auto',
  },
  confirmButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    textDecorationLine: 'underline',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  successMessage: {
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  successSubMessage: {
    marginBottom: 40,
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  backButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '80%',
    alignItems: 'center',
  },
  backButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  lightningAddressConfirmContainer: {
    marginTop: 50,
  },
});

export default SendLightning;
