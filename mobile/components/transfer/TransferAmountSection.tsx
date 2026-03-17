import { Ionicons } from '@expo/vector-icons';
import BigNumber from 'bignumber.js';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { overlayBackgroundDeeper } from '@shared/constants/Colors';
import { getAssetInfo } from '@shared/models/asset-info';
import { AssetId } from '@shared/types/asset';
import { Denomination } from '@shared/types/transfer';
import Pressable from '../Pressable';
import { ThemedText } from '../ThemedText';
import AssetSelectorPill from './AssetSelectorPill';

interface TransferAmountSectionProps {
  label: string;
  amount: string; // Always native units
  type: 'send' | 'receive';
  onAmountChange?: (text: string) => void; // Always emits native units
  asset: AssetId | undefined;
  onAssetPress: () => void;
  editable?: boolean;
  testID?: string;
  denomination?: Denomination;
  exchangeRate?: number; // USD per 1 native unit
  onDenominationSwitch?: () => void;
}

export default function TransferAmountSection({
  label,
  amount,
  type,
  onAmountChange,
  asset,
  onAssetPress,
  editable = true,
  testID,
  denomination = 'Native',
  exchangeRate,
  onDenominationSwitch,
}: TransferAmountSectionProps) {
  const inputRef = useRef<TextInput>(null);
  const [localDisplayValue, setLocalDisplayValue] = useState('');
  const isFocused = useRef(false);
  const hasRate = !!exchangeRate && exchangeRate > 0;
  const decimals = asset ? getAssetInfo(asset).decimals : 8;

  const nativeToFiat = useCallback(
    (nativeValue: string): string => {
      if (!hasRate || !nativeValue || nativeValue === '') return '';
      if (nativeValue === '0') return '0.00';
      const result = new BigNumber(nativeValue).multipliedBy(exchangeRate!).toFixed(2);
      return isNaN(Number(result)) ? '' : result;
    },
    [hasRate, exchangeRate]
  );

  const fiatToNative = useCallback(
    (fiatValue: string): string => {
      if (!hasRate || !fiatValue || fiatValue === '') return '';
      if (fiatValue === '0') return '0';
      const result = new BigNumber(fiatValue).dividedBy(exchangeRate!).toFixed(decimals);
      return isNaN(Number(result)) ? '' : result;
    },
    [hasRate, exchangeRate, decimals]
  );

  // Sync display value when amount or denomination changes externally
  useEffect(() => {
    if (denomination === 'Fiat' && isFocused.current) return;
    setLocalDisplayValue(denomination === 'Fiat' && hasRate ? nativeToFiat(amount) : amount);
  }, [amount, denomination, nativeToFiat, hasRate]);

  const handleContainerPress = () => {
    if (editable) {
      inputRef.current?.focus();
    }
  };

  const handleAmountChange = (text: string) => {
    isFocused.current = true;
    const normalized = text.replace(',', '.');
    if (normalized === '' || /^\d*\.?\d*$/.test(normalized)) {
      setLocalDisplayValue(normalized);
      if (denomination === 'Fiat' && hasRate) {
        onAmountChange?.(fiatToNative(normalized));
      } else {
        onAmountChange?.(normalized);
      }
    }
  };

  const handleDenominationSwitch = () => {
    if (!hasRate || !onDenominationSwitch) return;
    isFocused.current = false;
    onDenominationSwitch();
  };

  const secondaryValue = useMemo(() => {
    if (!hasRate) return '';
    if (denomination === 'Native') {
      const fiat = nativeToFiat(amount);
      return fiat ? `$${fiat}` : '';
    } else {
      const ticker = asset ? getAssetInfo(asset).ticker : '';
      return amount && amount !== '' ? `${amount} ${ticker}` : '';
    }
  }, [amount, denomination, asset, nativeToFiat, hasRate]);

  const canSwitch = hasRate && !!onDenominationSwitch;
  const containerStyle = type === 'send' ? styles.sendContainer : styles.receiveContainer;

  return (
    <View style={[styles.container, containerStyle]}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <Pressable style={styles.inputContainer} onPress={handleContainerPress} activeOpacity={1} testID={testID ? `${testID}-input` : undefined}>
        <TextInput
          ref={inputRef}
          style={styles.amountInput}
          value={localDisplayValue}
          onChangeText={handleAmountChange}
          placeholder="0"
          placeholderTextColor="rgba(255, 255, 255, 0.3)"
          keyboardType="numeric"
          editable={editable}
          onFocus={() => (isFocused.current = true)}
          onBlur={() => (isFocused.current = false)}
          testID={testID ? `${testID}-field` : undefined}
        />
        <AssetSelectorPill asset={asset} onPress={onAssetPress} testID={testID ? `${testID}-asset-pill` : undefined} />
      </Pressable>
      <View style={styles.bottomRow}>
        <Pressable style={styles.secondaryContainer} onPress={canSwitch ? handleDenominationSwitch : undefined} disabled={!canSwitch} activeOpacity={canSwitch ? 0.7 : 1}>
          <ThemedText style={styles.secondaryText}>{secondaryValue || '$0.00'}</ThemedText>
          {canSwitch && <Ionicons name="swap-vertical" size={14} color="rgba(255, 255, 255, 0.4)" style={styles.swapIcon} />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: overlayBackgroundDeeper,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sendContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  receiveContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  label: {
    fontSize: 16,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  amountInput: {
    fontSize: 24,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    fontFamily: 'Inter',
    padding: 0,
    margin: 0,
    flex: 1,
    marginRight: 12,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  secondaryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  secondaryText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '400',
  },
  swapIcon: {
    marginLeft: 4,
    transform: [{ rotate: '45deg' }],
  },
});
