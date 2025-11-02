import React, { useState } from 'react';
import { View, TouchableOpacity, TextInput, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import GradientScreen from '@/components/GradientScreen';

type TFeeEstimate = {
  slow: number;
  medium: number;
  fast: number;
};

type TFeeRateOptions = { [rate: number]: number };

const FeeSelector = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{
    estimateFees: string;
    feeRateOptions: string;
    currentFeeRate: string;
    toAddress?: string;
    amount?: string;
    xArkSwapTo?: string;
  }>();

  const estimateFees: TFeeEstimate | undefined = params.estimateFees && params.estimateFees !== '' ? JSON.parse(params.estimateFees) : undefined;
  const feeRateOptions: TFeeRateOptions = params.feeRateOptions && params.feeRateOptions !== '' ? JSON.parse(params.feeRateOptions) : {};
  const initialFeeRate = params.currentFeeRate ? Number(params.currentFeeRate) : 1;

  const [feeRate, setFeeRate] = useState(initialFeeRate);
  const [customFeeRate, setCustomFeeRate] = useState<number | undefined>(initialFeeRate);

  const handleFeeSelection = (rate: number) => {
    setFeeRate(rate);
    setCustomFeeRate(rate);
  };

  const handleChangeCustom = (text: string) => {
    const parsed = Number(text);
    if (!isNaN(parsed)) {
      setFeeRate(parsed);
      setCustomFeeRate(parsed);
    }
  };

  const handleDone = () => {
    if (customFeeRate) {
      const sendBtcParams: Record<string, string> = {
        selectedFeeRate: String(customFeeRate),
      };

      if (params.toAddress) sendBtcParams.toAddress = params.toAddress;
      if (params.amount) sendBtcParams.amount = params.amount;
      if (params.xArkSwapTo) sendBtcParams.xArkSwapTo = params.xArkSwapTo;

      router.navigate({
        pathname: '/SendBtc',
        params: sendBtcParams,
      });
    }
  };

  return (
    <GradientScreen>
      <View style={styles.container}>
        <ThemedText style={styles.title}>Select Network Fee</ThemedText>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {estimateFees && (
            <>
              <TouchableOpacity style={[styles.feeOption, feeRate === estimateFees.slow && styles.selectedFeeOption]} onPress={() => handleFeeSelection(estimateFees.slow)}>
                <ThemedText style={styles.feeOptionText}>
                  Economy ({estimateFees.slow} sat/vbyte)
                  {feeRateOptions[estimateFees.slow] ? ` ≈ ${feeRateOptions[estimateFees.slow]} sats` : ''}
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.feeOption, feeRate === estimateFees.medium && styles.selectedFeeOption]} onPress={() => handleFeeSelection(estimateFees.medium)}>
                <ThemedText style={styles.feeOptionText}>
                  Standard ({estimateFees.medium} sat/vbyte)
                  {feeRateOptions[estimateFees.medium] ? ` ≈ ${feeRateOptions[estimateFees.medium]} sats` : ''}
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.feeOption, feeRate === estimateFees.fast && styles.selectedFeeOption]} onPress={() => handleFeeSelection(estimateFees.fast)}>
                <ThemedText style={styles.feeOptionText}>
                  Priority ({estimateFees.fast} sat/vbyte)
                  {feeRateOptions[estimateFees.fast] ? ` ≈ ${feeRateOptions[estimateFees.fast]} sats` : ''}
                </ThemedText>
              </TouchableOpacity>
            </>
          )}

          <View style={styles.customFeeContainer}>
            <ThemedText style={styles.customFeeLabel}>Custom (sat/vbyte)</ThemedText>
            <TextInput style={styles.customFeeInput} keyboardType="numeric" value={String(feeRate)} onChangeText={handleChangeCustom} />
          </View>
        </ScrollView>

        <TouchableOpacity style={[styles.doneButton, !customFeeRate && styles.disabledButton]} onPress={handleDone} disabled={!customFeeRate}>
          <ThemedText style={styles.doneButtonText}>Done</ThemedText>
        </TouchableOpacity>
      </View>
    </GradientScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    marginBottom: 20,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
  scrollView: {
    maxHeight: 400,
  },
  feeOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 8,
    borderRadius: 12,
  },
  selectedFeeOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 1,
  },
  feeOptionText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  customFeeContainer: {
    marginTop: 16,
  },
  customFeeLabel: {
    marginBottom: 8,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  customFeeInput: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  doneButton: {
    backgroundColor: '#000000',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  disabledButton: {
    opacity: 0.5,
  },
  doneButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
});

export default FeeSelector;
