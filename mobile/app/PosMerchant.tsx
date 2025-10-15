import React, { useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import bolt11lib from 'bolt11';
import { Ionicons } from '@expo/vector-icons';

import GradientScreen from '@/components/GradientScreen';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import { ThemedText } from '@/components/ThemedText';
import { queryForMetadata, PosMetadata, initiateScan, ScanRequest } from '@shared/modules/merchants';
import { getDeviceID } from '@shared/modules/device-id';
import { SecureStorage } from '@/src/class/secure-storage';
import { Csprng } from '@/src/class/rng';
import { NETWORK_ARK, NETWORK_LIGHTNING, NETWORK_LIQUID, NETWORK_SPARK } from '@shared/types/networks';
import LongPressButton from '@/components/LongPressButton';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { useCachedBalance } from '@shared/hooks/useCachedBalance';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import assert from 'assert';
import { SparkWallet } from '@shared/class/wallets/spark-wallet';
import { ArkWallet } from '@shared/class/wallets/ark-wallet';
import { BreezWallet } from '@shared/class/wallets/breez-wallet';

const maxFeePercent = 5; // hardcoded at the moment. might give user option to adjust later

export type PosMerchantParams = {
  raw: string;
};

type Mode = 'range' | 'tip';

const formatAmount = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '';
  }
  return value.toFixed(2);
};

const parseAmountInput = (value: string): number => {
  if (!value) {
    return NaN;
  }
  const normalized = value.replace(/[^0-9.]/g, '');
  if (!normalized) {
    return NaN;
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
};

/**
 * Hashes a device ID with a salt and converts to UUID format
 */
const hashToUUID = async (deviceId: string, salt: string): Promise<string> => {
  // Hash the deviceId with salt using SHA256
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, deviceId + salt);

  // Convert hex hash to UUID format (8-4-4-4-12)
  // Take first 32 hex chars and format as UUID
  const formatted = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
  return formatted;
};

const PosMerchant: React.FC = () => {
  const params = useLocalSearchParams<PosMerchantParams>();
  const router = useRouter();

  const rawParam = params.raw;

  const { accountNumber } = useContext(AccountNumberContext);

  const [metadata, setMetadata] = useState<PosMetadata | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>('range');
  const [amountInput, setAmountInput] = useState<string>('');
  const [tipInput, setTipInput] = useState<string>('0.00');
  const [orderReference, setOrderReference] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [isSending, setIsSending] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [transactionId, setTransactionId] = useState<string>('');
  const [bolt11, setBolt11] = useState<string>('');
  const [notificationUrl, setNotificationUrl] = useState<string>('');
  const [errorLogs, setErrorLogs] = useState<string>('');

  // getting cached balances for all supported lightning networks
  const { balance: liquidBalance } = useCachedBalance(NETWORK_LIQUID, accountNumber);
  const { balance: sparkBalance } = useCachedBalance(NETWORK_SPARK, accountNumber);
  const { balance: arkBalance } = useCachedBalance(NETWORK_ARK, accountNumber);

  useEffect(() => {
    let cancelled = false;

    if (!rawParam || typeof rawParam !== 'string') {
      setError('Missing QR payload.');
      setLoading(false);
      return;
    }

    const fetchMetadata = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await queryForMetadata(rawParam);
        if (cancelled) {
          return;
        }
        console.log('POS metadata', data);

        setMetadata(data);

        const denominationFactor = data.denomination?.toLowerCase() === 'cents' ? 100 : 1;
        const minZar = data.amountMin / denominationFactor;
        const maxZar = data.amountMax / denominationFactor;
        const defaultZar = data.amountDefault / denominationFactor;

        const isFixedPositiveAmount = data.amountMin === data.amountMax && data.amountMin > 0;
        const isOpenAmount = data.amountMin === 0 && data.amountMax === 0;

        if (isFixedPositiveAmount) {
          setAmountInput(formatAmount(minZar));
        } else if (isOpenAmount) {
          setAmountInput(defaultZar > 0 ? formatAmount(defaultZar) : '');
        } else {
          const target = Math.min(Math.max(defaultZar || minZar, minZar), maxZar);
          setAmountInput(formatAmount(target));
          setMode('range');
        }

        setTipInput('0.00');
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? 'Failed to load merchant metadata.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchMetadata();

    return () => {
      cancelled = true;
    };
  }, [rawParam]);

  const denominationFactor = useMemo(() => {
    if (!metadata?.denomination) {
      return 1;
    }
    return metadata.denomination.toLowerCase() === 'cents' ? 100 : 1;
  }, [metadata?.denomination]);

  const minZar = useMemo(() => {
    if (!metadata) {
      return 0;
    }
    return metadata.amountMin / denominationFactor;
  }, [metadata, denominationFactor]);

  const maxZar = useMemo(() => {
    if (!metadata) {
      return 0;
    }
    return metadata.amountMax / denominationFactor;
  }, [metadata, denominationFactor]);

  const amountValue = useMemo(() => parseAmountInput(amountInput), [amountInput]);
  const tipValue = useMemo(() => parseAmountInput(tipInput) || 0, [tipInput]);

  const totalAmount = useMemo(() => {
    if (!metadata) {
      return 0;
    }

    const isFixedPositiveAmount = metadata.amountMin === metadata.amountMax && metadata.amountMin > 0;
    if (isFixedPositiveAmount) {
      return minZar;
    }

    const isOpenAmount = metadata.amountMin === 0 && metadata.amountMax === 0;
    if (isOpenAmount) {
      return Number.isFinite(amountValue) ? amountValue : 0;
    }

    if (mode === 'tip') {
      return minZar + (Number.isFinite(tipValue) ? tipValue : 0);
    }

    return Number.isFinite(amountValue) ? amountValue : 0;
  }, [metadata, amountValue, tipValue, mode, minZar]);

  const amountError = useMemo(() => {
    if (!metadata) {
      return null;
    }

    const isFixedPositiveAmount = metadata.amountMin === metadata.amountMax && metadata.amountMin > 0;
    if (isFixedPositiveAmount) {
      return null;
    }

    const isOpenAmount = metadata.amountMin === 0 && metadata.amountMax === 0;
    if (isOpenAmount) {
      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        return 'Enter a payment amount.';
      }
      return null;
    }

    if (mode === 'range') {
      if (!Number.isFinite(amountValue)) {
        return 'Enter a valid amount.';
      }
      if (amountValue < minZar || amountValue > maxZar) {
        return `Amount must be between R${formatAmount(minZar)} and R${formatAmount(maxZar)}.`;
      }
      return null;
    }

    const total = minZar + (Number.isFinite(tipValue) ? tipValue : 0);
    if (!Number.isFinite(tipValue) || tipValue < 0) {
      return 'Enter a valid tip amount.';
    }
    if (total > maxZar) {
      return `Tip exceeds allowed total of R${formatAmount(maxZar)}.`;
    }
    return null;
  }, [metadata, amountValue, tipValue, mode, minZar, maxZar]);

  const orderReferenceError = useMemo(() => {
    if (!metadata?.orderReferenceRequired) {
      return null;
    }
    if (!orderReference.trim()) {
      return 'Order reference is required.';
    }
    return null;
  }, [metadata?.orderReferenceRequired, orderReference]);

  const isReadyToSubmit = Boolean(metadata && !loading && !error && !amountError && !orderReferenceError && totalAmount > 0);

  const generateUUID = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const handleConfirm = async () => {
    if (!isReadyToSubmit || !metadata || !rawParam || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Get the device ID
      const deviceId = await getDeviceID(SecureStorage, Csprng);

      // Hash device ID with different salts for device_id and user_id
      const hashedDeviceId = await hashToUUID(deviceId, 'device-salt-cryptoqr');
      const hashedUserId = await hashToUUID(deviceId, 'user-salt-cryptoqr');

      // Convert total amount to the correct denomination (e.g., cents)
      const amountInDenomination = Math.round(totalAmount * denominationFactor);
      const tId = generateUUID();
      setTransactionId(tId);

      const scanRequest: ScanRequest = {
        scan_id: generateUUID(),
        transaction_id: tId,
        time: new Date().toISOString(),
        device_id: hashedDeviceId,
        user_id: hashedUserId,
        scan_data: rawParam,
        allowed_payment_methods: ['lightning'], // FIXME: should be changed to 'layerzwallet' eventually
        requested_payment_amount: {
          currency: metadata.currencyISOCode,
          denomination: metadata.denomination,
          amount: amountInDenomination,
        },
      };

      // Add payment reference if required and provided
      if (metadata.orderReferenceRequired && orderReference.trim()) {
        scanRequest.payment_reference = orderReference.trim();
      }

      console.log('Initiating scan with request:', scanRequest);
      const paymentRequest = await initiateScan(scanRequest);
      console.log('Payment request received:', paymentRequest);

      setIsSubmitted(true);

      if (paymentRequest.status === 'REQUESTED' && paymentRequest.payment_methods?.lightning) {
        setBolt11(paymentRequest.payment_methods?.lightning);
        setNotificationUrl(paymentRequest.notification_url || '');
      }
    } catch (err: any) {
      console.error('Failed to initiate scan:', err);
      setError(err?.message ?? 'Failed to initiate payment request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <GradientScreen variant={NETWORK_LIGHTNING}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="POS Payment" />
        <View style={styles.centered}>
          <ActivityIndicator />
          <ThemedText style={styles.centeredText}>Loading merchant details…</ThemedText>
        </View>
      </GradientScreen>
    );
  }

  if (error) {
    return (
      <GradientScreen variant={NETWORK_LIGHTNING}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="POS Payment" />
        <View style={styles.centered}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <ThemedText style={styles.errorText}>{errorLogs}</ThemedText>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
            <ThemedText style={[styles.secondaryButtonText, { paddingLeft: 10, paddingRight: 10 }]}>Back</ThemedText>
          </TouchableOpacity>
        </View>
      </GradientScreen>
    );
  }

  if (!metadata) {
    return null;
  }

  async function actuallySend(): Promise<void> {
    try {
      setIsSending(true);
      await new Promise((resolve) => setTimeout(resolve, 200)); // propagate

      const { satoshis } = bolt11lib.decode(bolt11);
      assert(satoshis, 'Could not get amount from bolt11 invoice');
      const needSats = satoshis + satoshis * (maxFeePercent / 100);

      // iterating all available lightning networks:
      let triedAtLeastOnce = false;
      for (const n of [NETWORK_SPARK, NETWORK_ARK, NETWORK_LIQUID]) {
        if (
          (n === NETWORK_LIQUID && liquidBalance && +liquidBalance >= needSats) ||
          (n === NETWORK_SPARK && sparkBalance && +sparkBalance >= needSats) ||
          (n === NETWORK_ARK && arkBalance && +arkBalance >= needSats)
        ) {
          // checked that we have enought balance, lets try to pay:
          console.log(`Trying to pay with ${n}...`);
          const wallet = await BackgroundExecutor.lazyInitWallet(n, accountNumber);
          assert(wallet instanceof SparkWallet || wallet instanceof ArkWallet || wallet instanceof BreezWallet, 'Not a Lightning wallet');
          triedAtLeastOnce = true;
          let result: boolean = false;
          try {
            result = await wallet.payLightningInvoice(bolt11, maxFeePercent);
          } catch (error: any) {
            // we only log error and skip it
            console.log(`Failed to pay lightning invoice with ${n}:`, error.message);
            setErrorLogs((prev) => prev + `\nFailed to pay with ${n}: ` + error.message);
          }

          if (result) {
            console.log('success!');

            if (notificationUrl && transactionId) {
              // post to notification url
              try {
                await fetch(notificationUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    transaction_id: transactionId,
                  }),
                });
              } catch (error: any) {
                console.error('Failed to send notification:', error);
                // Don't fail the payment if notification fails
              }
            }

            setIsSending(false);
            setSuccess(true);
            return;
          }

          // if we failed to pay, lets try next network:
        }
      }

      // iterator ended, failed to pay with any network
      setError(triedAtLeastOnce ? 'Failed to send payment' : 'Not enough balance');
    } catch (error: any) {
      console.error('Failed to send payment:', error);
      setError(error.message ?? 'Failed to send payment.');
    }
  }

  return (
    <GradientScreen variant={NETWORK_LIGHTNING}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="POS Payment" />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            <ThemedText style={styles.merchantName}>{metadata.merchantName}</ThemedText>
            <ThemedText style={styles.infoLine}>
              {metadata.currencyISOCode} (denomination: {metadata.denomination})
            </ThemedText>
          </View>

          {metadata.amountMin === metadata.amountMax && metadata.amountMin > 0 ? (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Amount</ThemedText>
              <ThemedText style={styles.amountDisplay}>R{formatAmount(minZar)}</ThemedText>
              <ThemedText style={styles.infoLine}>This payment is fixed. Tap confirm to continue.</ThemedText>
            </View>
          ) : null}

          {metadata.amountMin === 0 && metadata.amountMax === 0 ? (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Enter Amount (ZAR)</ThemedText>
              <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="rgba(255,255,255,0.4)" value={amountInput} onChangeText={setAmountInput} />
              {amountError ? <ThemedText style={styles.errorText}>{amountError}</ThemedText> : null}
            </View>
          ) : null}

          {metadata.amountMin < metadata.amountMax && metadata.amountMin > 0 ? (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Choose Amount</ThemedText>
              <View style={styles.toggleRow}>
                <TouchableOpacity style={[styles.toggleButton, mode === 'range' && styles.toggleButtonActive]} onPress={() => setMode('range')}>
                  <ThemedText style={styles.toggleText}>Enter total</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggleButton, mode === 'tip' && styles.toggleButtonActive]} onPress={() => setMode('tip')}>
                  <ThemedText style={styles.toggleText}>Add tip</ThemedText>
                </TouchableOpacity>
              </View>

              {mode === 'range' ? (
                <View>
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    placeholder={`${formatAmount(minZar)} - ${formatAmount(maxZar)}`}
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={amountInput}
                    onChangeText={setAmountInput}
                  />
                </View>
              ) : (
                <View>
                  <View style={styles.rangeSummary}>
                    <ThemedText style={styles.infoLine}>Minimum amount R{formatAmount(minZar)}</ThemedText>
                    <ThemedText style={styles.infoLine}>Maximum total R{formatAmount(maxZar)}</ThemedText>
                  </View>
                  <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="Tip in ZAR" placeholderTextColor="rgba(255,255,255,0.4)" value={tipInput} onChangeText={setTipInput} />
                </View>
              )}

              {amountError ? <ThemedText style={styles.errorText}>{amountError}</ThemedText> : null}
            </View>
          ) : null}

          {metadata.orderReferenceRequired ? (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Order Reference</ThemedText>
              <TextInput
                style={styles.input}
                placeholder={metadata.orderReferenceDefault || 'Enter reference'}
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={orderReference}
                onChangeText={setOrderReference}
              />
              {orderReferenceError ? <ThemedText style={styles.errorText}>{orderReferenceError}</ThemedText> : null}
            </View>
          ) : null}

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Summary</ThemedText>
            <ThemedText style={styles.summaryLine}>Total: R{formatAmount(totalAmount)}</ThemedText>
            {metadata.orderReferenceRequired && orderReference.trim() ? <ThemedText style={styles.summaryLine}>Reference: {orderReference.trim()}</ThemedText> : null}
          </View>

          {!isSubmitted ? (
            <TouchableOpacity style={[styles.primaryButton, (!isReadyToSubmit || isSubmitting) && styles.primaryButtonDisabled]} disabled={!isReadyToSubmit || isSubmitting} onPress={handleConfirm}>
              {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <ThemedText style={styles.primaryButtonText}>Confirm</ThemedText>}
            </TouchableOpacity>
          ) : null}

          {bolt11 && !isSending && !success ? (
            <View>
              <LongPressButton onLongPressComplete={actuallySend} title="Hold to confirm send" progressColor="#FFFFFF" backgroundColor="#000000" />
            </View>
          ) : null}

          {isSending ? (
            <View style={styles.centered}>
              <ThemedText style={styles.centeredText}>Sending payment...</ThemedText>
              <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.8)" />
            </View>
          ) : null}

          {success ? (
            <View style={styles.centered}>
              <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
              <ThemedText style={styles.centeredText}>Payment sent!</ThemedText>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
                <ThemedText style={[styles.secondaryButtonText, { paddingLeft: 10, paddingRight: 10 }]}>Done</ThemedText>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientScreen>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 24,
  },
  section: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  merchantName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  infoLine: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  amountDisplay: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  toggleButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rangeSummary: {
    gap: 4,
    marginBottom: 8,
  },
  summaryLine: {
    fontSize: 15,
    color: '#FFFFFF',
  },
  primaryButton: {
    backgroundColor: 'black',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  secondaryButtonText: {
    fontSize: 15,
    color: '#FFFFFF',
  },
  errorText: {
    color: '#FF6B6B',
  },
  successText: {
    color: '#6BFF8B',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  centeredText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
});

export default PosMerchant;
