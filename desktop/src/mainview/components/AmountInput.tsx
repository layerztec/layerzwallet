import BigNumber from 'bignumber.js';
import { ArrowUpDown } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { overlayBackgroundDeeper } from '@shared/constants/Colors';
import { Denomination } from '@shared/types/transfer';

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

/** Web port of mobile `AmountInput`. */
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [localDisplayValue, setLocalDisplayValue] = useState('');
  const isFocused = useRef(false);
  const conversionCache = useRef<Map<string, string>>(new Map());
  // The last native value this input emitted via onChangeText. Used to tell apart the user's own
  // typing from an external value change (e.g. max/balance press) so the field re-syncs for the latter.
  const lastEmittedValue = useRef<string | null>(null);

  const exchangeRateNumber = useMemo(() => {
    return exchangeRate ? Number(exchangeRate) : undefined;
  }, [exchangeRate]);

  useEffect(() => {
    conversionCache.current.clear();
  }, [exchangeRate]);

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
      if (isNaN(Number(result))) {
        return '—';
      }
      conversionCache.current.set(nativeValue, result);
      return result;
    },
    [exchangeRateNumber]
  );

  const fiatToNative = useCallback(
    (fiatValue: string): string => {
      if (fiatValue === '0') return '0';
      // This result becomes the native amount actually sent, so invalid/empty input must
      // resolve to an empty value (not the '—' display placeholder, which would otherwise be
      // stored as the amount).
      if (!exchangeRateNumber || !fiatValue || fiatValue === '') return '';
      // Reuse the exact native amount that produced this fiat string (keeps precision stable on
      // round-trips), but only when the match is unambiguous: several native amounts can round to
      // the same 2-decimal fiat label, so if more than one matches we divide instead of guessing.
      let matchedNative: string | undefined;
      let matchCount = 0;
      for (const [nativeKey, fiatValueInCache] of conversionCache.current.entries()) {
        if (fiatValueInCache === fiatValue) {
          matchedNative = nativeKey;
          if (++matchCount > 1) break;
        }
      }
      if (matchCount === 1 && matchedNative !== undefined) {
        return matchedNative;
      }
      const fiat = new BigNumber(fiatValue);
      const result = fiat.dividedBy(exchangeRateNumber).toFixed(decimals);
      if (isNaN(Number(result))) {
        return '';
      }
      conversionCache.current.set(result, fiatValue);
      return result;
    },
    [exchangeRateNumber, decimals]
  );

  useEffect(() => {
    // Only keep the field untouched while the user is actively typing a fiat amount. A change that
    // didn't come from this input (max/balance press, async balance update) must always refresh the
    // display, otherwise the field can keep stale fiat text while `value` (the native amount that is
    // actually sent) already holds the full balance.
    const isExternalChange = value !== lastEmittedValue.current;
    if (denomination === 'Fiat' && isFocused.current && !isExternalChange) {
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

      const nativeValue = denomination === 'Fiat' ? fiatToNative(normalized) : normalized;
      lastEmittedValue.current = nativeValue;
      onChangeText(nativeValue);
    }
  };

  const handleContainerClick = () => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  };

  const handleDenominationSwitch = () => {
    const normalized = value.trim();
    if (!normalized || isNaN(Number(normalized))) {
      return;
    }
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
    <div
      onClick={handleContainerClick}
      data-testid={testID}
      style={{
        backgroundColor: overlayBackgroundDeeper,
        borderRadius: 20,
        padding: 16,
        height: 86,
        boxSizing: 'border-box',
        position: 'relative',
        cursor: 'text',
      }}
    >
      {onMaxPress && (
        <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 1 }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMaxPress();
            }}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: 40,
              border: 'none',
              padding: '1px 8px',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.8)', fontWeight: 500 }}>max</span>
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 2, gap: 8 }}>
        <input
          ref={inputRef}
          value={localDisplayValue}
          onChange={(e) => handleAmountChange(e.target.value)}
          placeholder="0.00"
          inputMode="decimal"
          disabled={disabled}
          onFocus={() => (isFocused.current = true)}
          onBlur={() => (isFocused.current = false)}
          data-testid={testID ? `${testID}-field` : undefined}
          style={{
            fontSize: 24,
            color: 'rgba(255, 255, 255, 0.8)',
            fontWeight: 600,
            padding: 0,
            margin: 0,
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            minWidth: 0,
          }}
        />
      </div>

      <div style={{ marginTop: 4, display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (canSwitchDenomination) handleDenominationSwitch();
          }}
          disabled={!canSwitchDenomination}
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: canSwitchDenomination ? 'pointer' : 'default',
            opacity: canSwitchDenomination ? 1 : 0.5,
          }}
        >
          <span style={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.5)', fontWeight: 400 }}>{secondaryValue}</span>
          {canSwitchDenomination && <ArrowUpDown size={16} color="rgba(255, 255, 255, 0.5)" style={{ marginLeft: 6, transform: 'rotate(45deg)' }} />}
        </button>

        {onBalancePress ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onBalancePress();
            }}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            <ThemedText style={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.5)', fontWeight: 600 }}>Balance {formattedBalance}</ThemedText>
          </button>
        ) : (
          <ThemedText style={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.5)', fontWeight: 600 }}>Balance {formattedBalance}</ThemedText>
        )}
      </div>
    </div>
  );
}
