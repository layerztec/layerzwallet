import type { PrepareSendRequest, PrepareSendResponse } from '@breeztech/breez-sdk-liquid';
import assert from 'assert';
import BigNumber from 'bignumber.js';
import { X } from 'lucide-react';
import React, { useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { BreezWallet, LBTC_ASSET_IDS } from '@shared/class/wallets/breez-wallet';
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
import { NETWORK_LIQUID, NETWORK_LIQUID_TESTNET } from '@shared/types/networks';
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
 * Send native-coin (L-BTC) and asset (token) transactions for Liquid (Breez SDK).
 * Web port of the mobile multi-step `/send` flow: send-address -> send-amount-liquid -> send-confirm.
 */
const SendLiquid: React.FC = () => {
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
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isPreparing, setIsPreparing] = useState(false);

  // confirm-step state
  const [prepareResult, setPrepareResult] = useState<PrepareSendResponse | undefined>(undefined);
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

  // Selected asset (token when one is chosen, otherwise native L-BTC)
  const assetTicker = tokenInfo ? tokenInfo.symbol : nativeTicker;
  const assetDecimals = tokenInfo ? tokenInfo.decimals : networkDecimals;
  const assetBalance = tokenInfo ? tokenBalance : nativeBalance;
  const assetExchangeRate = tokenInfo ? tokenExchangeRate : nativeExchangeRate;
  const formattedBalance = formatBalance(assetBalance || '0', assetDecimals);

  // Breez asset id to send: selected token, otherwise default L-BTC for the network.
  const targetAssetId = useMemo(() => {
    const defaultAssetId = network === NETWORK_LIQUID ? LBTC_ASSET_IDS.mainnet : LBTC_ASSET_IDS.testnet;
    return tokenId || defaultAssetId;
  }, [tokenId, network]);

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
    if (!validateAddress(network, address)) return 'Invalid recipient address';
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
      assert(network === NETWORK_LIQUID || network === NETWORK_LIQUID_TESTNET, 'Network must be Liquid');
      const wallet = await BackgroundCaller.lazyInitWallet(network, accountNumber);
      assert(wallet instanceof BreezWallet, 'Wallet must be a BreezWallet');

      const prepareRequest: PrepareSendRequest = {
        destination: address,
        amount: {
          type: 'asset',
          toAsset: targetAssetId,
          receiverAmount: parseFloat(amount),
        },
      };

      const prepareResponse = await wallet.prepareSendPayment(prepareRequest);
      setPrepareResult(prepareResponse);
      setStep('confirm');
    } catch (e: any) {
      console.error('Failed to prepare transaction:', e);
      setErrorMessage('Failed to prepare transaction: ' + (e.message || e));
    } finally {
      setIsPreparing(false);
    }
  };

  // ---- step 3: confirm ----
  const broadcast = async () => {
    setIsBroadcasting(true);
    setError('');
    try {
      assert(prepareResult, 'Liquid prepare result is required');
      assert(network === NETWORK_LIQUID || network === NETWORK_LIQUID_TESTNET, 'Network must be Liquid');
      const wallet = await BackgroundCaller.lazyInitWallet(network, accountNumber);
      assert(wallet instanceof BreezWallet, 'Wallet must be a BreezWallet');
      const result = await wallet.sendPayment({ prepareResponse: prepareResult });
      if (!result) {
        throw new Error('Transaction failed');
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

  // Liquid fee comes from the prepare result and is always denominated in the native coin (sats).
  const feeToUse = prepareResult?.feesSat ?? 0;
  const feeInNative = formatBalance(String(feeToUse), networkDecimals, 8);
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
              testID="send-amount-liquid-input"
            />

            {errorMessage ? (
              <div style={sendFormStyles.errorRow}>
                <X size={16} color="white" />
                <ThemedText style={sendFormStyles.errorRowText}>{errorMessage}</ThemedText>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            style={{ ...sendFormStyles.continueButton, ...(disabled ? sendFormStyles.disabledButton : null) }}
            onClick={prepareTransaction}
            disabled={disabled}
            data-testid="send-amount-liquid-next-button"
          >
            <ThemedText style={sendFormStyles.continueButtonText}>{isPreparing ? 'Preparing...' : 'Next'}</ThemedText>
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

export default SendLiquid;
