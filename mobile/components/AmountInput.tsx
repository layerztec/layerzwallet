import { Denomination } from '@/app/send/_layout';
import { Ionicons } from '@expo/vector-icons';
import BigNumber from 'bignumber.js';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemedText } from './ThemedText';

export interface AmountInputProps {
  value: string;
  onChangeText: (text: string) => void;
  ticker: string;
  balance: string;
  exchangeRate?: string;
  denomination: Denomination;
  decimals: number;
  onDenominationSwitch?: () => void;
  onMaxPress?: () => void;
  onBalancePress?: () => void;
  disabled?: boolean;
  testID?: string;
}

export default function AmountInput({
  value,
  onChangeText,
  ticker,
  balance,
  exchangeRate,
  denomination,
  decimals,
  onDenominationSwitch,
  onMaxPress,
  onBalancePress,
  disabled = false,
  testID,
}: AmountInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [localDisplayValue, setLocalDisplayValue] = useState('');
  const isFocused = useRef(false);
  const conversionCache = useRef<Map<string, string>>(new Map()); // convert cache

  const exchangeRateNumber = useMemo(() => {
    return exchangeRate ? Number(exchangeRate) : undefined;
  }, [exchangeRate]);

  useEffect(() => {
    conversionCache.current.clear();
    // Clear cache when exchange rate changes
  }, [exchangeRate]);

  // Convert native to fiat
  const nativeToFiat = useCallback(
    (nativeValue: string): string => {
      if (nativeValue === '0') return '0';
      if (!exchangeRateNumber || !nativeValue || nativeValue === '') return '—';
      const cached = conversionCache.current.get(nativeValue);
      if (cached !== undefined) {
        return cached;
      }
      const native = new BigNumber(nativeValue);
      const result = native.multipliedBy(exchangeRateNumber).toFixed(2);
      conversionCache.current.set(nativeValue, result);
      return result;
    },
    [exchangeRateNumber]
  );

  // Convert fiat to native
  const fiatToNative = useCallback(
    (fiatValue: string): string => {
      if (fiatValue === '0') return '0';
      if (!exchangeRateNumber || !fiatValue || fiatValue === '') return '—';
      for (const [nativeKey, fiatValueInCache] of conversionCache.current.entries()) {
        if (fiatValueInCache === fiatValue) {
          return nativeKey;
        }
      }
      const fiat = new BigNumber(fiatValue);
      const result = fiat.dividedBy(exchangeRateNumber).toFixed(decimals);
      conversionCache.current.set(result, fiatValue);
      return result;
    },
    [exchangeRateNumber, decimals]
  );

  useEffect(() => {
    // Don't update localDisplayValue when input is focused in fiat mode
    if (denomination === 'Fiat' && isFocused.current) {
      return;
    }
    const displayValue = denomination === 'Native' ? value : nativeToFiat(value);
    setLocalDisplayValue(displayValue);
  }, [value, denomination, nativeToFiat]);

  const handleAmountChange = (text: string) => {
    isFocused.current = true;
    const normalized = text.replace(',', '.');
    if (normalized === '' || /^\d*\.?\d*$/.test(normalized)) {
      setLocalDisplayValue(normalized);

      if (denomination === 'Fiat') {
        const nativeValue = fiatToNative(normalized);
        onChangeText(nativeValue);
      } else {
        onChangeText(normalized);
      }
    }
  };

  const handleContainerPress = () => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  };

  const handleDenominationSwitch = () => {
    isFocused.current = false;
    onDenominationSwitch?.();
  };

  const secondaryValue = useMemo(() => {
    if (denomination === 'Native') {
      const fiat = nativeToFiat(value);
      return `${fiat} USD`;
    } else {
      return `${value} ${ticker}`;
    }
  }, [value, denomination, ticker, nativeToFiat]);

  const canSwitchDenomination = !!exchangeRateNumber && !!onDenominationSwitch;

  const formattedBalance = useMemo(() => {
    if (denomination === 'Fiat' && exchangeRateNumber) {
      const balanceBN = new BigNumber(balance);
      const fiatBalance = balanceBN.multipliedBy(exchangeRateNumber);
      return `$${fiatBalance.toFixed(2)}`;
    } else {
      return `${balance} ${ticker}`;
    }
  }, [balance, denomination, exchangeRateNumber, ticker]);

  return (
    <TouchableOpacity style={styles.container} onPress={handleContainerPress} activeOpacity={1} testID={testID}>
      {/* Max Button */}
      {onMaxPress && (
        <View style={styles.maxButtonContainer}>
          <TouchableOpacity style={styles.maxButton} onPress={onMaxPress}>
            <ThemedText style={styles.maxButtonText}>max</ThemedText>
          </TouchableOpacity>
        </View>
      )}

      {/* Amount Input */}
      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          style={styles.amountInput}
          value={localDisplayValue}
          onChangeText={handleAmountChange}
          placeholder="0.00"
          placeholderTextColor="rgba(255, 255, 255, 0.5)"
          keyboardType="numeric"
          editable={!disabled}
          onFocus={() => (isFocused.current = true)}
          onBlur={() => (isFocused.current = false)}
        />
      </View>

      {/* Bottom Row: Secondary Value and Balance */}
      <View style={styles.bottomRow}>
        <TouchableOpacity
          style={styles.usdContainer}
          onPress={canSwitchDenomination ? handleDenominationSwitch : undefined}
          disabled={!canSwitchDenomination}
          activeOpacity={canSwitchDenomination ? 0.7 : 1}
        >
          <ThemedText style={[styles.usdText, !canSwitchDenomination && styles.disabledText]}>{secondaryValue}</ThemedText>
          {canSwitchDenomination && <Ionicons name="swap-vertical" size={16} color="rgba(255, 255, 255, 0.5)" style={styles.swapIcon} />}
        </TouchableOpacity>

        {onBalancePress ? (
          <TouchableOpacity onPress={onBalancePress} activeOpacity={0.7}>
            <ThemedText style={styles.balanceText}>Balance {formattedBalance}</ThemedText>
          </TouchableOpacity>
        ) : (
          <ThemedText style={styles.balanceText}>Balance {formattedBalance}</ThemedText>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
    padding: 16,
    height: 86,
    position: 'relative',
  },
  maxButtonContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
  },
  maxButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 40,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  maxButtonText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 2,
    gap: 8,
  },
  amountInput: {
    fontSize: 24,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    fontFamily: 'Inter',
    padding: 0,
    margin: 0,
    flex: 1,
  },
  bottomRow: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  usdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  usdText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '400',
  },
  swapIcon: {
    marginLeft: 6,
    transform: [{ rotate: '45deg' }],
  },
  balanceText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '600',
  },
  disabledText: {
    opacity: 0.5,
  },
});
