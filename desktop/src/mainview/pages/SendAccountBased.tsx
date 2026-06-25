import assert from 'assert';
import BigNumber from 'bignumber.js';
import { X } from 'lucide-react';
import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router';

import { ArkWallet } from '@shared/class/wallets/ark-wallet';
import { walletCanHaveTokens } from '@shared/class/wallets/interface-can-have-tokens';
import { SparkWallet } from '@shared/class/wallets/spark-wallet';
import { StacksWallet } from '@shared/class/wallets/stacks-wallet';
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
import { NETWORK_ARK, NETWORK_ARK_MUTINYNET, NETWORK_SPARK, NETWORK_STACKS } from '@shared/types/networks';
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

/**
 * Send native-coin and token transactions for single-address (account-based)
 * wallets (Ark, Spark, Stacks). Web port of the mobile multi-step `/send` flow:
 * send-address -> send-amount-acc -> send-confirm.
 */
const SendAccountBased: React.FC = () => {
  const navigate = useNavigate();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);

  const nativeTicker = getTickerByNetwork(network);
  const networkDecimals = getDecimalsByNetwork(network);

  const [step, setStep] = useState<Step>('address');
  const [address, setAddress] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [tokenId, setTokenId] = useState<string | undefined>(undefined);
  const [memo, setMemo] = useState<string>('');
  const [denomination, setDenomination] = useState<Denomination>('Native');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // confirm-step state
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
    setMemo('');
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
    try {
      if (!validateAddress(network, address)) return 'Invalid recipient address';
    } catch (e: any) {
      return e.message || 'Invalid recipient address';
    }
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

  const handleAmountNext = () => {
    const err = validateAmount();
    if (err) {
      setErrorMessage(err);
      return;
    }
    setErrorMessage('');
    setStep('confirm');
  };

  // ---- step 3: confirm ----
  const broadcast = async () => {
    setIsBroadcasting(true);
    setError('');
    try {
      assert(network === NETWORK_ARK || network === NETWORK_ARK_MUTINYNET || network === NETWORK_SPARK || network === NETWORK_STACKS, 'Internal error: wallet of incorrect type');
      const wallet = await BackgroundCaller.lazyInitWallet(network, accountNumber);
      assert(wallet instanceof ArkWallet || wallet instanceof SparkWallet || wallet instanceof StacksWallet, 'Internal error: incorrect wallet instance');

      if (tokenInfo && walletCanHaveTokens(wallet)) {
        const amountInBase = BigInt(new BigNumber(amount).multipliedBy(new BigNumber(10).pow(tokenInfo.decimals)).toString(10));
        const transactionId = await wallet.transferToken(tokenInfo.id, amountInBase, address, memo || undefined);
        if (!transactionId) {
          throw new Error('Transaction failed');
        }
      } else {
        const amountInBase = new BigNumber(amount).multipliedBy(new BigNumber(10).pow(networkDecimals)).toString(10);
        const transactionId = await wallet.pay(address, Number(amountInBase));
        if (!transactionId) {
          throw new Error('Transaction failed');
        }
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

  // Account-based sends carry no precomputed fee (mobile shows 0). Fee is always in the native coin.
  const feeToUse = 0;
  const feeInNative = formatBalance(String(feeToUse), networkDecimals, 8);
  const amountUsdValue = nativeExchangeRate && !isTokenSend ? `$${new BigNumber(amount || '0').multipliedBy(Number(nativeExchangeRate)).toFixed(2)}` : '';
  const usdFee = nativeExchangeRate ? `$${new BigNumber(feeToUse).dividedBy(new BigNumber(10).pow(networkDecimals)).multipliedBy(Number(nativeExchangeRate)).toFixed(2)}` : '';

  let totalUsd: string | undefined;
  let totalDisplay: string;
  if (isTokenSend) {
    // For token sends, only show the token amount (fee shown separately, in native units)
    totalUsd = undefined;
    totalDisplay = `${amount} ${assetTicker}`;
  } else {
    const totalAmount = new BigNumber(amount || '0').plus(new BigNumber(feeToUse).dividedBy(new BigNumber(10).pow(networkDecimals)));
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
    const disabled = !amount || !!errorMessage;
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
              testID="send-amount-acc-input"
            />

            {errorMessage ? (
              <div style={sendFormStyles.errorRow}>
                <X size={16} color="white" />
                <ThemedText style={sendFormStyles.errorRowText}>{errorMessage}</ThemedText>
              </div>
            ) : null}

            {/* Memo field - only shown for Stacks STX token */}
            {tokenInfo?.id === 'STX' ? (
              <div style={styles.memoSection}>
                <ThemedText style={styles.memoLabel}>Memo (optional)</ThemedText>
                <input style={styles.memoInput} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Enter memo" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
              </div>
            ) : null}
          </div>

          <button
            type="button"
            style={{ ...sendFormStyles.continueButton, ...(disabled ? sendFormStyles.disabledButton : null) }}
            onClick={handleAmountNext}
            disabled={disabled}
            data-testid="send-amount-acc-next-button"
          >
            <ThemedText style={sendFormStyles.continueButtonText}>Next</ThemedText>
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
  memoSection: {
    marginTop: 24,
  },
  memoLabel: {
    display: 'block',
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: 500,
    marginBottom: 8,
  },
  memoInput: {
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: '12px 16px',
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    border: '1px solid rgba(255, 255, 255, 0.2)',
    outline: 'none',
  },
};

export default SendAccountBased;
