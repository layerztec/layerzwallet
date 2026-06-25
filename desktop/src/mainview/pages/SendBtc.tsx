import BigNumber from 'bignumber.js';
import { ChevronDown, ChevronRight, TriangleAlert, X } from 'lucide-react';
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import * as BlueElectrum from '@shared/blue_modules/BlueElectrum';
import { TFeeEstimate } from '@shared/blue_modules/BlueElectrum';
import { HDSegwitBech32Wallet } from '@shared/class/wallets/hd-segwit-bech32-wallet';
import { CreateTransactionTarget } from '@shared/class/wallets/types';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useBalance } from '@shared/hooks/useBalance';
import { useExchangeRate } from '@shared/hooks/useExchangeRate';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { sleep } from '@shared/modules/sleep';
import { formatBalance } from '@shared/modules/string-utils';
import { validateAddress } from '@shared/modules/wallet-utils';
import { GetBtcSendDataResponse } from '@shared/types/IBackgroundCaller';
import { NETWORK_BITCOIN } from '@shared/types/networks';

import AmountInput from '../components/AmountInput';
import { RadialGradientScreen } from '../components/home/RadialGradientScreen';
import ScreenSendHeader from '../components/navigation/ScreenSendHeader';
import SendConfirmView from '../components/send/SendConfirmView';
import { sendFormStyles } from '../components/send/sendStyles';
import { ThemedText } from '../components/ThemedText';
import { BackgroundCaller } from '../modules/background-caller';

type Step = 'address' | 'amount' | 'confirm';

enum FeeIndex {
  Fast = 'fast',
  Medium = 'medium',
  Slow = 'slow',
}

const FeeOptions = [
  { index: FeeIndex.Fast, name: 'Fast', key: 'fast' as keyof TFeeEstimate },
  { index: FeeIndex.Medium, name: 'Medium', key: 'medium' as keyof TFeeEstimate },
  { index: FeeIndex.Slow, name: 'Slow', key: 'slow' as keyof TFeeEstimate },
] as const;

interface CreatedTransaction {
  txhex: string;
  actualFee: number;
  feeRate: number;
}

/**
 * Send Bitcoin (on-chain) transactions. Web port of the mobile multi-step `/send` flow:
 * send-address -> send-amount-btc -> send-confirm. UTXO/fee data is fetched inline
 * (mobile fetches it in the send `_layout`).
 */
const SendBtc: React.FC = () => {
  const navigate = useNavigate();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);

  const ticker = getTickerByNetwork(network);
  const networkDecimals = getDecimalsByNetwork(network);

  const { balance } = useBalance(network, accountNumber, BackgroundCaller);
  const { exchangeRate } = useExchangeRate(network, 'USD');

  const [step, setStep] = useState<Step>('address');
  const [address, setAddress] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [denomination, setDenomination] = useState<'Native' | 'Fiat'>('Native');

  // bitcoin send data (UTXOs, change address, address caches) + fee estimate
  const [sendData, setSendData] = useState<GetBtcSendDataResponse | undefined>(undefined);
  const [estimateFees, setEstimateFees] = useState<TFeeEstimate | undefined>(undefined);
  const [feeLoadingError, setFeeLoadingError] = useState<string | undefined>(undefined);
  const [isLoadingSendData, setIsLoadingSendData] = useState(false);
  const [isLoadingFees, setIsLoadingFees] = useState(false);

  // fee selection
  const [selectedFeeRate, setSelectedFeeRate] = useState<number | undefined>();
  const [selectedFeeIndex, setSelectedFeeIndex] = useState<FeeIndex | undefined>();
  const [isFeeSelectorExpanded, setIsFeeSelectorExpanded] = useState(false);
  const [customFeeRate, setCustomFeeRate] = useState<number | undefined>();

  const [isCreatingTransaction, setIsCreatingTransaction] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [transactionError, setTransactionError] = useState<string | null>(null);

  // confirm-step state
  const [createdTransaction, setCreatedTransaction] = useState<CreatedTransaction | undefined>(undefined);
  const [error, setError] = useState<string>('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const wallet = useRef(new HDSegwitBech32Wallet()).current;

  const formattedBalance = formatBalance(balance || '0', networkDecimals);

  // Load Bitcoin UTXO send data (only relevant while the active network is Bitcoin)
  useEffect(() => {
    if (network !== NETWORK_BITCOIN) return;
    let cancelled = false;
    const load = async () => {
      setIsLoadingSendData(true);
      try {
        const r = await BackgroundCaller.getBtcSendData(accountNumber);
        if (!cancelled) setSendData(r);
      } catch (e) {
        console.error('Failed to fetch Bitcoin UTXOs', e);
      } finally {
        if (!cancelled) setIsLoadingSendData(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [accountNumber, network]);

  // Load Bitcoin fee estimates (only relevant while the active network is Bitcoin)
  useEffect(() => {
    if (network !== NETWORK_BITCOIN) return;
    let cancelled = false;
    const load = async () => {
      setIsLoadingFees(true);
      setFeeLoadingError(undefined);
      try {
        if (!BlueElectrum.mainConnected) {
          await BlueElectrum.connectMain();
        }
        const r = await BlueElectrum.estimateFees();
        if (!cancelled) {
          setEstimateFees(r);
          setFeeLoadingError(undefined);
        }
      } catch (e) {
        if (!cancelled) setFeeLoadingError(e instanceof Error ? e.message : 'Failed to load network fees');
      } finally {
        if (!cancelled) setIsLoadingFees(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [network]);

  const isLoading = isLoadingSendData || isLoadingFees;

  const handleDenominationSwitch = () => {
    if (exchangeRate) {
      setDenomination(denomination === 'Native' ? 'Fiat' : 'Native');
    }
  };

  const formatFee = (feeInSats: number): string => {
    if (denomination === 'Fiat' && exchangeRate) {
      const feeInNative = new BigNumber(feeInSats).dividedBy(new BigNumber(10).pow(networkDecimals));
      const feeInFiat = feeInNative.multipliedBy(Number(exchangeRate));
      return `$${feeInFiat.toFixed(2)}`;
    }
    return `${formatBalance(feeInSats.toString(), networkDecimals)} ${ticker}`;
  };

  const [feeRate, feeIndex] = useMemo<[number, FeeIndex]>(() => {
    if (selectedFeeRate !== undefined) return [selectedFeeRate, selectedFeeIndex ?? FeeIndex.Medium];
    if (customFeeRate !== undefined) return [customFeeRate, FeeIndex.Slow];
    if (estimateFees) return [estimateFees.medium, FeeIndex.Medium];
    return [1, FeeIndex.Slow];
  }, [selectedFeeRate, customFeeRate, estimateFees, selectedFeeIndex]);

  const feeName = useMemo(() => {
    switch (feeIndex) {
      case FeeIndex.Fast:
        return 'Fast';
      case FeeIndex.Medium:
        return 'Medium';
      case FeeIndex.Slow:
        return 'Slow';
      default:
        return 'Network Fee';
    }
  }, [feeIndex]);

  const feeRateOptions = useMemo<{ [rate: number]: number }>(() => {
    if (!sendData?.utxos || !address) {
      return {};
    }

    const options = new Set<number>([feeRate]);
    if (estimateFees) {
      options.add(estimateFees.slow);
      options.add(estimateFees.medium);
      options.add(estimateFees.fast);
    }

    const satValue = new BigNumber(parseFloat(amount || '0')).multipliedBy(new BigNumber(10).pow(networkDecimals)).toNumber();

    const targets: CreateTransactionTarget[] = [
      {
        address: validateAddress(network, address) ? address : '36JxaUrpDzkEerkTf1FzwHNE1Hb7cCjgJV',
        value: Number.isNaN(satValue) || satValue === 0 ? 546 : satValue,
      },
    ];

    const result: { [key: number]: number } = {};
    Array.from(options).forEach((v) => {
      try {
        const { fee } = wallet.coinselect(sendData.utxos, targets, v);
        result[v] = fee;
      } catch (e: any) {
        if (e.message?.includes('Not enough')) {
          const targets2 = targets.map((t, index) => (index > 0 ? { ...t, value: 546 } : { address: t.address }));
          try {
            const { fee } = wallet.coinselect(sendData.utxos, targets2, v);
            result[v] = fee;
          } catch {}
        }
      }
    });

    return result;
  }, [feeRate, estimateFees, sendData?.utxos, amount, address, network, wallet, networkDecimals]);

  const maxAmount = useMemo<string | undefined>(() => {
    if (!sendData?.utxos || !address) {
      return undefined;
    }

    const targets: CreateTransactionTarget[] = [{ address }];
    try {
      const res1 = wallet.coinselect(sendData.utxos, targets, feeRate);
      return new BigNumber(res1.outputs[0].value).dividedBy(new BigNumber(10).pow(networkDecimals)).toString();
    } catch (e: any) {
      if (e.message?.includes('Not enough')) {
        try {
          const res2 = wallet.coinselect(sendData.utxos, targets, 1);
          return new BigNumber(res2.outputs[0].value).dividedBy(new BigNumber(10).pow(networkDecimals)).toString();
        } catch {}
      }
    }
    return undefined;
  }, [feeRate, sendData?.utxos, address, wallet, networkDecimals]);

  // ---- step 1: address ----
  const handleAddressNext = () => {
    if (!address.trim()) {
      setValidationError('Please enter a recipient address');
      return;
    }
    setValidationError(null);
    try {
      if (!validateAddress(network, address)) {
        throw new Error('Invalid address');
      }
      setStep('amount');
    } catch (e: any) {
      setValidationError(e.message || 'Failed to validate address');
    }
  };

  // ---- step 2: amount ----
  const handleMaxPress = () => {
    if (maxAmount) {
      setAmount(maxAmount);
    } else {
      setValidationError('Failed to calculate maximum amount');
    }
  };

  const handleCustomFeeChange = (text: string) => {
    const normalized = text.replace(',', '.');
    if (normalized === '' || /^\d*\.?\d*$/.test(normalized)) {
      setCustomFeeRate(normalized === '' ? undefined : Number(normalized));
      setSelectedFeeRate(undefined);
    }
  };

  const validateAmount = (): { isValid: boolean; error: string | null } => {
    if (!amount || !balance) return { isValid: false, error: 'Please enter an amount' };
    if (amount.includes('.') && amount.split('.')[1]?.length > networkDecimals) {
      return { isValid: false, error: `Maximum ${networkDecimals} decimal place${networkDecimals !== 1 ? 's' : ''} allowed` };
    }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return { isValid: false, error: 'Amount must be greater than 0' };
    const satValue = new BigNumber(amt).multipliedBy(new BigNumber(10).pow(networkDecimals)).toString(10);
    if (!new BigNumber(balance).gte(satValue)) {
      return { isValid: false, error: 'Insufficient balance' };
    }
    return { isValid: true, error: null };
  };

  const validateFee = (): { isValid: boolean; error: string | null } => {
    if (feeLoadingError && customFeeRate === undefined) {
      return { isValid: false, error: 'Please enter a custom fee rate' };
    }
    if (customFeeRate !== undefined && (isNaN(customFeeRate) || customFeeRate <= 0)) {
      return { isValid: false, error: 'Please enter a valid fee rate' };
    }
    return { isValid: true, error: null };
  };

  const handleAmountNext = async () => {
    const amountValidation = validateAmount();
    if (!amountValidation.isValid) {
      setValidationError(amountValidation.error);
      return;
    }
    const feeValidation = validateFee();
    if (!feeValidation.isValid) {
      setValidationError(feeValidation.error);
      return;
    }

    if (!amount || !sendData) return;

    setValidationError(null);
    setTransactionError(null);
    setIsCreatingTransaction(true);
    await sleep(100);

    try {
      const satValue = new BigNumber(parseFloat(amount)).multipliedBy(new BigNumber(10).pow(networkDecimals)).toString(10);

      if (!validateAddress(network, address)) {
        throw new Error('Recipient address is not valid');
      }

      const mnemonic = await BackgroundCaller.getMasterSeed();
      wallet.setSecret(mnemonic);
      wallet.setDerivationPath(`m/84'/0'/${accountNumber}'`);

      const targets: CreateTransactionTarget[] = [{ address, value: Number(satValue) }];

      // setting up internals of a wallet to properly function:
      for (const [key, value] of Object.entries(sendData.extraProperties)) {
        (wallet as any)[key] = value;
      }

      const { tx, fee } = wallet.createTransaction(sendData.utxos, targets, feeRate, sendData.changeAddress);
      if (!tx) {
        throw new Error('Failed to create transaction');
      }

      setCreatedTransaction({ txhex: tx.toHex(), actualFee: fee, feeRate });
      setStep('confirm');
    } catch (e: any) {
      console.error('Failed to create transaction:', e);
      setTransactionError(e.message || 'Failed to create transaction');
    } finally {
      setIsCreatingTransaction(false);
    }
  };

  // ---- step 3: confirm ----
  const broadcast = async () => {
    setIsBroadcasting(true);
    setError('');
    try {
      if (!createdTransaction?.txhex) {
        throw new Error('Transaction hex is required');
      }
      if (!BlueElectrum.mainConnected) {
        await BlueElectrum.connectMain();
      }
      const result = await BlueElectrum.broadcastV2(createdTransaction.txhex);
      if (!result) {
        throw new Error('Transaction broadcast failed');
      }
      setIsSuccess(true);
    } catch (e: any) {
      console.error('Failed to broadcast transaction:', e);
      setError(e.message || 'Failed to broadcast transaction');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const exchangeRateString = exchangeRate !== undefined ? String(exchangeRate) : undefined;

  const feeToUse = createdTransaction?.actualFee ?? 0;
  const feeInNative = formatBalance(String(feeToUse), networkDecimals, 8);
  const feeInNativeUnits = new BigNumber(feeToUse).dividedBy(new BigNumber(10).pow(networkDecimals));
  const amountUsdValue = exchangeRate ? `$${new BigNumber(amount || '0').multipliedBy(Number(exchangeRate)).toFixed(2)}` : '';
  const usdFee = exchangeRate ? `$${feeInNativeUnits.multipliedBy(Number(exchangeRate)).toFixed(2)}` : '';
  const totalAmount = new BigNumber(amount || '0').plus(feeInNativeUnits);
  const totalUsd = exchangeRate ? `$${totalAmount.multipliedBy(Number(exchangeRate)).toFixed(2)}` : undefined;
  const totalDisplay = `${totalAmount.toFixed()} ${ticker}`;

  // ---------- renders ----------
  if (step === 'address') {
    const disabled = !address.trim();
    return (
      <RadialGradientScreen network={network} className="home-screen">
        <ScreenSendHeader network={network} title={`Send ${ticker}`} onBackPress={() => navigate('/home')} />
        <div style={sendFormStyles.stepContainer}>
          <div style={sendFormStyles.stepScroll}>
            <div style={sendFormStyles.inputSection}>
              <div style={sendFormStyles.addressInputContainer}>
                <div style={sendFormStyles.addressInputWrapper}>
                  <ThemedText style={sendFormStyles.addressInputLabel}>To</ThemedText>
                  <input
                    style={sendFormStyles.addressInput}
                    data-testid="send-address-input"
                    placeholder="Enter address"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
              </div>

              {validationError ? (
                <div style={sendFormStyles.errorRow}>
                  <X size={16} color="white" />
                  <ThemedText style={sendFormStyles.errorRowText}>{validationError}</ThemedText>
                </div>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            style={{ ...sendFormStyles.continueButton, ...(disabled ? sendFormStyles.disabledButton : null) }}
            onClick={handleAddressNext}
            disabled={disabled}
            data-testid="send-address-next-button"
          >
            <ThemedText style={sendFormStyles.continueButtonText}>Next</ThemedText>
          </button>
        </div>
      </RadialGradientScreen>
    );
  }

  if (step === 'amount') {
    const buttonDisabled = isLoading || (!!feeLoadingError && customFeeRate === undefined) || !amount || !sendData || isCreatingTransaction;
    return (
      <RadialGradientScreen network={network} className="home-screen">
        <ScreenSendHeader network={network} title={`Send ${ticker}`} onBackPress={() => setStep('address')} />
        <div style={sendFormStyles.stepContainer}>
          <div style={sendFormStyles.stepScroll}>
            <AmountInput
              value={amount}
              onChangeText={(text) => {
                setAmount(text);
                setValidationError(null);
              }}
              ticker={ticker}
              balance={formattedBalance}
              exchangeRate={exchangeRateString}
              denomination={denomination}
              decimals={networkDecimals}
              onDenominationSwitch={handleDenominationSwitch}
              onMaxPress={handleMaxPress}
              onBalancePress={handleMaxPress}
              testID="send-amount-btc-input"
            />

            {validationError ? (
              <div style={sendFormStyles.errorRow}>
                <X size={16} color="white" />
                <ThemedText style={sendFormStyles.errorRowText}>{validationError}</ThemedText>
              </div>
            ) : null}

            {transactionError ? (
              <div style={sendFormStyles.errorRow}>
                <X size={16} color="white" />
                <ThemedText style={sendFormStyles.errorRowText}>{transactionError}</ThemedText>
              </div>
            ) : null}

            {isLoading ? (
              <div style={styles.loadingContainer}>
                <ThemedText style={styles.loadingText}>Loading network fees...</ThemedText>
              </div>
            ) : null}

            {!isLoading && feeLoadingError ? (
              <div style={styles.feeErrorContainer}>
                <div style={styles.feeErrorHeader}>
                  <TriangleAlert size={20} color="#FF9500" />
                  <ThemedText style={styles.feeErrorTitle}>Network fees unavailable</ThemedText>
                </div>
                <ThemedText style={styles.feeErrorText}>{feeLoadingError || 'Unable to load network fees. Please enter a custom fee rate manually.'}</ThemedText>
                <div style={styles.customFeeInputContainer}>
                  <ThemedText style={styles.customFeeLabel}>Custom Fee Rate (sats/vB)</ThemedText>
                  <input
                    style={styles.customFeeInput}
                    placeholder="Enter fee rate"
                    inputMode="decimal"
                    value={customFeeRate ? String(customFeeRate) : ''}
                    onChange={(e) => handleCustomFeeChange(e.target.value)}
                    data-testid="send-custom-fee-input"
                  />
                </div>
              </div>
            ) : null}

            {!isLoading && !feeLoadingError ? (
              <div style={styles.feeSelectorContainer}>
                <button type="button" style={styles.feeSelectorHeader} onClick={() => setIsFeeSelectorExpanded((v) => !v)} data-testid="send-fee-selector">
                  {isFeeSelectorExpanded ? (
                    <>
                      <ThemedText style={styles.feeSelectorTitle}>Network Fee</ThemedText>
                      <ChevronDown size={20} color="rgba(255, 255, 255, 0.6)" />
                    </>
                  ) : (
                    <>
                      <div style={styles.feeSelectorCollapsedContent}>
                        <ThemedText style={styles.feeSelectorLabel}>Network Fee</ThemedText>
                        <ThemedText style={styles.feeSelectorSelected}>
                          {feeName}
                          {feeRateOptions[feeRate] ? ` - ${formatFee(feeRateOptions[feeRate])}` : ''}
                        </ThemedText>
                      </div>
                      <ChevronRight size={20} color="rgba(255, 255, 255, 0.6)" />
                    </>
                  )}
                </button>

                {estimateFees && isFeeSelectorExpanded ? (
                  <div style={styles.feeOptionsContainer}>
                    {FeeOptions.map((option) => (
                      <button
                        key={option.index}
                        type="button"
                        style={{ ...styles.feeOption, ...(feeIndex === option.index ? styles.selectedFeeOption : null) }}
                        onClick={() => {
                          setSelectedFeeRate(estimateFees[option.index]);
                          setSelectedFeeIndex(option.index);
                          setIsFeeSelectorExpanded(false);
                        }}
                      >
                        <div style={styles.feeOptionContent}>
                          <ThemedText style={styles.feeOptionName}>{option.name}</ThemedText>
                          <ThemedText style={styles.feeOptionRate}>{estimateFees[option.key]} sats v/b</ThemedText>
                        </div>
                        <ThemedText style={styles.feeOptionAmount}>{feeRateOptions[estimateFees[option.key]] !== undefined ? formatFee(feeRateOptions[estimateFees[option.key]]) : ''}</ThemedText>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            style={{ ...sendFormStyles.continueButton, ...(buttonDisabled ? sendFormStyles.disabledButton : null) }}
            onClick={handleAmountNext}
            disabled={buttonDisabled}
            data-testid="send-amount-btc-next-button"
          >
            <ThemedText style={sendFormStyles.continueButtonText}>{isCreatingTransaction ? 'Creating...' : 'Next'}</ThemedText>
          </button>
        </div>
      </RadialGradientScreen>
    );
  }

  // step === 'confirm'
  return (
    <SendConfirmView
      network={network}
      title={`Send ${ticker}`}
      totalDisplay={totalDisplay}
      totalUsd={totalUsd}
      amount={amount}
      amountTicker={ticker}
      amountUsdValue={amountUsdValue}
      feeInNative={feeInNative}
      feeTicker={ticker}
      usdFee={usdFee}
      address={address}
      error={error}
      isSuccess={isSuccess}
      isBroadcasting={isBroadcasting}
      onBack={() => setStep('amount')}
      onConfirm={broadcast}
      onClearError={() => setError('')}
      onDone={() => navigate('/home')}
    />
  );
};

const styles: Record<string, React.CSSProperties> = {
  loadingContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '20px 0',
    gap: 12,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  feeSelectorContainer: {
    marginTop: 24,
  },
  feeSelectorHeader: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: '0 17px',
    borderRadius: 16,
    height: 64,
    width: '100%',
    border: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  feeSelectorTitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 18,
    fontWeight: 400,
  },
  feeSelectorCollapsedContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  feeSelectorLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
  },
  feeSelectorSelected: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
  },
  feeOptionsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
  },
  feeOption: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 16px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    height: 64,
    width: '100%',
    border: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  selectedFeeOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  feeOptionContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  feeOptionName: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: 500,
    marginBottom: 2,
  },
  feeOptionRate: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
  },
  feeOptionAmount: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    textAlign: 'right',
  },
  feeErrorContainer: {
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
    border: '1px solid rgba(255, 149, 0, 0.3)',
  },
  feeErrorHeader: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  feeErrorTitle: {
    color: '#FF9500',
    fontSize: 16,
    fontWeight: 600,
  },
  feeErrorText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 16,
  },
  customFeeInputContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  customFeeLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: 500,
  },
  customFeeInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: '12px 16px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    outline: 'none',
  },
};

export default SendBtc;
