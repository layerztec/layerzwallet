import BigNumber from 'bignumber.js';
import { X } from 'lucide-react';
import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router';

import { EvmWallet } from '@shared/class/evm-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useBalance } from '@shared/hooks/useBalance';
import { useExchangeRate } from '@shared/hooks/useExchangeRate';
import { useTokenBalance } from '@shared/hooks/useTokenBalance';
import { useTokenDiscovery } from '@shared/hooks/useTokenDiscovery';
import { useTokenExchangeRate } from '@shared/hooks/useTokenExchangeRate';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { formatBalance } from '@shared/modules/string-utils';
import { validateAddress } from '@shared/modules/wallet-utils';
import { CachedTokenInfo } from '@shared/types/token-info';
import { Denomination } from '@shared/types/transfer';

import { LayerzStorage } from '../class/layerz-storage';
import AmountInput from '../components/AmountInput';
import { RadialGradientScreen } from '../components/home/RadialGradientScreen';
import { TokensView } from '../components/home/TokensView';
import ScreenSendHeader from '../components/navigation/ScreenSendHeader';
import SendConfirmView from '../components/send/SendConfirmView';
import { sendFormStyles } from '../components/send/sendStyles';
import { ThemedText } from '../components/ThemedText';
import { BackgroundCaller } from '../modules/background-caller';

type Step = 'address' | 'amount' | 'confirm';

interface CreatedTransaction {
  txhex: string;
  // Fee in wei / base units. Kept as a string because 18-decimal chains routinely exceed
  // Number.MAX_SAFE_INTEGER, and parseFloat would silently lose precision.
  actualFee: string;
}

/**
 * Send native-coin and token (ERC-20) transactions for EVM wallets (Rootstock, Citrea,
 * Alpen, Sepolia, ...). Web port of the mobile multi-step `/send` flow:
 * send-address -> send-amount-evm -> send-confirm.
 */
const SendEvm: React.FC = () => {
  const navigate = useNavigate();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);

  const nativeTicker = getTickerByNetwork(network);
  const networkDecimals = getDecimalsByNetwork(network);

  const [step, setStep] = useState<Step>('address');
  const [address, setAddress] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [tokenId, setTokenId] = useState<string | undefined>(undefined);
  const [denomination, setDenomination] = useState<Denomination>('Native');
  const [feeMultiplier, setFeeMultiplier] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isPreparing, setIsPreparing] = useState(false);

  // confirm-step state
  const [createdTransaction, setCreatedTransaction] = useState<CreatedTransaction | undefined>(undefined);
  const [error, setError] = useState<string>('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Asset data: native + token (hooks called unconditionally, then we pick based on selection)
  const { balance: nativeBalance } = useBalance(network, accountNumber, BackgroundCaller);
  const { exchangeRate: nativeExchangeRate } = useExchangeRate(network, 'USD');
  const { tokenList } = useTokenDiscovery(network, accountNumber, BackgroundCaller, LayerzStorage);
  const { balance: tokenBalance } = useTokenBalance(network, accountNumber, tokenId ?? '', BackgroundCaller);
  const { tokenExchangeRate } = useTokenExchangeRate(network, tokenId ?? '', 'USD');

  const tokenInfo: CachedTokenInfo | undefined = tokenId ? tokenList.find((t) => t.id === tokenId) : undefined;
  const isTokenSend = !!tokenInfo;

  // Selected asset (token when one is chosen, otherwise native coin)
  const assetTicker = tokenInfo ? tokenInfo.symbol : nativeTicker;
  const assetDecimals = tokenInfo ? tokenInfo.decimals : networkDecimals;
  const assetBalance = tokenInfo ? tokenBalance : nativeBalance;
  const assetExchangeRate = tokenInfo ? tokenExchangeRate : nativeExchangeRate;
  const formattedBalance = formatBalance(assetBalance || '0', assetDecimals);

  // ---- step 1: address ----
  const handleTokenPress = (clickedToken: CachedTokenInfo) => {
    setTokenId(tokenId === clickedToken.id ? undefined : clickedToken.id);
    setAmount('');
    setDenomination('Native');
  };

  const handleAddressNext = () => {
    if (!address.trim()) {
      setErrorMessage('Please enter a recipient address');
      return;
    }
    setErrorMessage('');
    try {
      if (!validateAddress(network, address)) {
        throw new Error('Invalid address');
      }
      setStep('amount');
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to validate address');
    }
  };

  // ---- step 2: amount ----
  const handleDenominationSwitch = () => {
    if (assetExchangeRate) {
      setDenomination(denomination === 'Native' ? 'Fiat' : 'Native');
    }
  };

  const handleMaxPress = () => {
    if (!assetBalance) return;
    setAmount(formattedBalance);
  };

  const validateAmount = (): string | null => {
    if (!address?.trim()) return 'Recipient address is required';
    if (!EvmWallet.isAddressValid(address)) return 'Invalid recipient address';
    if (!amount) return 'Please enter an amount';
    if (amount.includes('.') && amount.split('.')[1]?.length > assetDecimals) {
      return `Maximum ${assetDecimals} decimal place${assetDecimals !== 1 ? 's' : ''} allowed`;
    }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return 'Amount must be greater than 0';
    if (!assetBalance) return 'Balance not loaded';
    const amountInBase = new BigNumber(amt).multipliedBy(new BigNumber(10).pow(assetDecimals));
    if (amountInBase.isNaN() || amountInBase.lte(0)) return 'Invalid amount';
    if (new BigNumber(assetBalance).lt(amountInBase)) return 'Insufficient balance';
    return null;
  };

  const prepareTransaction = async () => {
    const err = validateAmount();
    if (err) {
      setErrorMessage(err);
      return;
    }
    setErrorMessage('');
    setIsPreparing(true);
    try {
      const sender = await BackgroundCaller.getAddress(network, accountNumber);
      const value = new BigNumber(amount || '0').multipliedBy(new BigNumber(10).pow(assetDecimals)).toString(10);

      const e = new EvmWallet();
      const paymentTransaction = tokenInfo ? await e.createTokenTransferTransaction(sender, address, tokenInfo, value) : await e.createPaymentTransaction(sender, address, value);

      const feeData = await e.getFeeData(network);
      let baseFee: bigint;
      try {
        baseFee = await e.getBaseFeePerGas(network);
      } catch {
        baseFee = 0n;
      }
      const prepared = await e.prepareTransaction(paymentTransaction, network, feeData, BigInt(Math.round(feeMultiplier)));
      const calculatedMinFee = e.calculateMinFee(baseFee, prepared);

      const mnemonic = await BackgroundCaller.getMasterSeed();
      const signedBytes = await e.signTransaction(prepared, mnemonic, accountNumber);

      setCreatedTransaction({ txhex: signedBytes, actualFee: calculatedMinFee });
      setStep('confirm');
    } catch (e: any) {
      console.error('Failed to prepare transaction:', e);
      setErrorMessage(e.message || 'Failed to prepare transaction');
    } finally {
      setIsPreparing(false);
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
      const e = new EvmWallet();
      const txid = await e.broadcastTransaction(network, createdTransaction.txhex);
      if (!txid || typeof txid !== 'string') {
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

  const exchangeRateString = assetExchangeRate !== undefined ? String(assetExchangeRate) : undefined;

  // EVM fee is computed during prepare and always denominated in the native coin.
  const feeToUse = createdTransaction?.actualFee ?? '0';
  const feeInNative = formatBalance(feeToUse, networkDecimals, 8);
  const feeInNativeUnits = new BigNumber(feeToUse).dividedBy(new BigNumber(10).pow(networkDecimals));
  const amountUsdValue = nativeExchangeRate && !isTokenSend ? `$${new BigNumber(amount || '0').multipliedBy(Number(nativeExchangeRate)).toFixed(2)}` : '';
  const usdFee = nativeExchangeRate ? `$${feeInNativeUnits.multipliedBy(Number(nativeExchangeRate)).toFixed(2)}` : '';

  let totalUsd: string | undefined;
  let totalDisplay: string;
  if (isTokenSend) {
    // For token sends, only show the token amount (fee shown separately, in native units)
    totalUsd = undefined;
    totalDisplay = `${amount} ${assetTicker}`;
  } else {
    const totalAmount = new BigNumber(amount || '0').plus(feeInNativeUnits);
    totalUsd = nativeExchangeRate ? `$${totalAmount.multipliedBy(Number(nativeExchangeRate)).toFixed(2)}` : undefined;
    totalDisplay = `${totalAmount.toFixed()} ${assetTicker}`;
  }

  // ---------- renders ----------
  if (step === 'address') {
    const disabled = !address.trim();
    return (
      <RadialGradientScreen network={network} className="home-screen">
        <ScreenSendHeader network={network} title={`Send ${assetTicker}`} onBackPress={() => navigate('/home')} />
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

              {errorMessage ? (
                <div style={sendFormStyles.errorRow}>
                  <X size={16} color="white" />
                  <ThemedText style={sendFormStyles.errorRowText}>{errorMessage}</ThemedText>
                </div>
              ) : null}
            </div>

            <TokensView onTokenPress={handleTokenPress} selectedToken={tokenId} />
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
    const disabled = !amount || !!errorMessage || isPreparing;
    return (
      <RadialGradientScreen network={network} className="home-screen">
        <ScreenSendHeader network={network} title={`Send ${assetTicker}`} onBackPress={() => setStep('address')} />
        <div style={sendFormStyles.stepContainer}>
          <div style={sendFormStyles.stepScroll}>
            <AmountInput
              value={amount}
              onChangeText={(text) => {
                setAmount(text);
                setErrorMessage('');
              }}
              ticker={assetTicker}
              balance={formattedBalance}
              exchangeRate={exchangeRateString}
              denomination={denomination}
              decimals={assetDecimals}
              onDenominationSwitch={handleDenominationSwitch}
              onMaxPress={handleMaxPress}
              onBalancePress={handleMaxPress}
              testID="send-amount-evm-input"
            />

            {errorMessage ? (
              <div style={sendFormStyles.errorRow}>
                <X size={16} color="white" />
                <ThemedText style={sendFormStyles.errorRowText}>{errorMessage}</ThemedText>
              </div>
            ) : null}

            <div style={styles.feeSection}>
              <ThemedText style={styles.feeLabel}>Fee Speed: {feeMultiplier.toFixed(0)}x</ThemedText>
              <div style={styles.sliderContainer}>
                <input type="range" min={1} max={5} step={1} value={feeMultiplier} onChange={(e) => setFeeMultiplier(Number(e.target.value))} style={styles.slider} data-testid="send-fee-slider" />
                <div style={styles.sliderLabels}>
                  <ThemedText style={styles.sliderLabel}>Slower</ThemedText>
                  <ThemedText style={styles.sliderLabel}>Faster</ThemedText>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            style={{ ...sendFormStyles.continueButton, ...(disabled ? sendFormStyles.disabledButton : null) }}
            onClick={prepareTransaction}
            disabled={disabled}
            data-testid="send-amount-evm-next-button"
          >
            <ThemedText style={sendFormStyles.continueButtonText}>{isPreparing ? 'Creating...' : 'Next'}</ThemedText>
          </button>
        </div>
      </RadialGradientScreen>
    );
  }

  // step === 'confirm'
  return (
    <SendConfirmView
      network={network}
      title={`Send ${assetTicker}`}
      totalDisplay={totalDisplay}
      totalUsd={totalUsd}
      amount={amount}
      amountTicker={assetTicker}
      amountUsdValue={amountUsdValue}
      feeInNative={feeInNative}
      feeTicker={nativeTicker}
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
  feeSection: {
    marginTop: 24,
  },
  feeLabel: {
    display: 'block',
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: 500,
    marginBottom: 12,
  },
  sliderContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 16,
  },
  slider: {
    width: '100%',
    height: 40,
    accentColor: 'rgba(255, 255, 255, 0.9)',
    cursor: 'pointer',
  },
  sliderLabels: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
};

export default SendEvm;
