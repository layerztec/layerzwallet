import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, TextInput, ScrollView, StyleSheet, LayoutAnimation, Platform, UIManager, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import GradientScreen from '@/components/GradientScreen';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as BlueElectrum from '@shared/blue_modules/BlueElectrum';
import { TFeeEstimate } from '@shared/blue_modules/BlueElectrum';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type TFeeRateOptions = { [rate: number]: number };

const FeeSelector = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{
    feeRateOptions: string;
    currentFeeRate: string;
    toAddress?: string;
    amount?: string;
    xArkSwapTo?: string;
  }>();

  const feeRateOptions: TFeeRateOptions = params.feeRateOptions && params.feeRateOptions !== '' ? JSON.parse(params.feeRateOptions) : {};
  const initialFeeRate = params.currentFeeRate ? Number(params.currentFeeRate) : 1;

  const [estimateFees, setEstimateFees] = useState<TFeeEstimate | undefined>(undefined);
  const [feeRate, setFeeRate] = useState(initialFeeRate);
  const [customFeeRate, setCustomFeeRate] = useState<number | undefined>(initialFeeRate);
  const [isCustomInputFocused, setIsCustomInputFocused] = useState(false);
  const [isLoadingFees, setIsLoadingFees] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setIsLoadingFees(true);
        if (!BlueElectrum.mainConnected) {
          await BlueElectrum.connectMain();
        }
        const r = await BlueElectrum.estimateFees();
        setEstimateFees(r);
      } catch (e) {
        console.info('Failed to fetch fees', e);
      } finally {
        setIsLoadingFees(false);
      }
    })();
  }, []);

  const handleFeeSelection = (rate: number) => {
    setFeeRate(rate);
    setCustomFeeRate(rate);

    router.setParams({ selectedFeeRate: String(rate) });
    router.back();
  };

  const handleChangeCustom = (text: string) => {
    const parsed = Number(text);
    if (!isNaN(parsed)) {
      setFeeRate(parsed);
      setCustomFeeRate(parsed);
    }
  };

  const handleCustomInputFocus = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsCustomInputFocused(true);
  };

  const handleCustomInputBlur = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsCustomInputFocused(false);
  };

  const handleDone = () => {
    if (customFeeRate) {
      router.setParams({ selectedFeeRate: String(customFeeRate) });
      router.back();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ThemedText style={styles.title}>Select Network Fee</ThemedText>

      {!isCustomInputFocused && isLoadingFees && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.8)" />
          <ThemedText style={styles.loadingText}>Loading fee estimates...</ThemedText>
        </View>
      )}

      {!isCustomInputFocused && estimateFees && (
        <View style={styles.estimatesContainer}>
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
        </View>
      )}

      <View style={styles.customFeeContainer}>
        <ThemedText style={styles.customFeeLabel}>Custom (sat/vbyte)</ThemedText>
        <TextInput style={styles.customFeeInput} keyboardType="numeric" value={String(feeRate)} onChangeText={handleChangeCustom} onFocus={handleCustomInputFocus} onBlur={handleCustomInputBlur} />
      </View>

      <View style={styles.spacer} />

      <TouchableOpacity style={[styles.doneButton, !customFeeRate && styles.disabledButton]} onPress={handleDone} disabled={!customFeeRate}>
        <ThemedText style={styles.doneButtonText}>Done</ThemedText>
      </TouchableOpacity>
    </SafeAreaView>
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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  estimatesContainer: {
    marginBottom: 16,
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
  spacer: {
    flex: 1,
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
