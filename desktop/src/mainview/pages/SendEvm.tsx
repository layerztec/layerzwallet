import BigNumber from 'bignumber.js';
import { AlertCircle, X } from 'lucide-react';
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
import { ThemedText } from '../components/ThemedText';
import { BackgroundCaller } from '../modules/background-caller';

type Step = 'address' | 'amount' | 'confirm';

interface CreatedTransaction {
  txhex: string;
  actualFee: number;
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

      setCreatedTransaction({ txhex: signedBytes, actualFee: parseFloat(calculatedMinFee) });
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
  const feeToUse = createdTransaction?.actualFee ?? 0;
  const feeInNative = formatBalance(String(feeToUse), networkDecimals, 8);
  const feeInNativeUnits = new BigNumber(feeToUse).dividedBy(new BigNumber(10).pow(networkDecimals));
  const amountUsdValue = nativeExchangeRate && !isTokenSend ? `$${new BigNumber(amount || '0').multipliedBy(Number(nativeExchangeRate)).toFixed(2)}` : '';
  const usdFee = nativeExchangeRate ? `$${feeInNativeUnits.multipliedBy(Number(nativeExchangeRate)).toFixed(2)}` : '';

  let totalUsd: string;
  let totalDisplay: string;
  if (isTokenSend) {
    // For token sends, only show the token amount (fee shown separately, in native units)
    totalUsd = '';
    totalDisplay = `${amount} ${assetTicker}`;
  } else {
    const totalAmount = new BigNumber(amount || '0').plus(feeInNativeUnits);
    totalUsd = nativeExchangeRate ? `$${totalAmount.multipliedBy(Number(nativeExchangeRate)).toFixed(2)}` : '';
    totalDisplay = `${totalAmount.toFixed()} ${assetTicker}`;
  }

  const formatAddressWithOpacity = (addr: string) => {
    if (!addr) return null;
    if (addr.length < 8) return <span style={styles.addressDisplay}>{addr}</span>;
    const midpoint = Math.floor(addr.length / 2);
    const firstHalf = addr.substring(0, midpoint);
    const secondHalf = addr.substring(midpoint);
    const first4 = addr.substring(0, 4);
    const last4 = addr.substring(addr.length - 4);
    const nbsp = '\u00A0';
    return (
      <div style={styles.addressContainer}>
        <span style={styles.addressDisplay}>
          <span style={{ ...styles.addressDisplay, ...styles.addressHighlight, ...styles.addressLetterSpacing }}>{first4}</span>
          <span style={{ ...styles.addressDisplay, ...styles.addressLetterSpacing }}>
            {nbsp}
            {firstHalf.substring(4)}
          </span>
        </span>
        <span style={styles.addressDisplay}>
          <span style={{ ...styles.addressDisplay, ...styles.addressLetterSpacing }}>
            {secondHalf.substring(0, secondHalf.length - 4)}
            {nbsp}
          </span>
          <span style={{ ...styles.addressDisplay, ...styles.addressHighlight, ...styles.addressLetterSpacing }}>{last4}</span>
        </span>
      </div>
    );
  };

  // ---------- renders ----------
  if (step === 'address') {
    const disabled = !address.trim();
    return (
      <RadialGradientScreen network={network} className="home-screen">
        <ScreenSendHeader network={network} title={`Send ${assetTicker}`} onBackPress={() => navigate('/home')} />
        <div style={styles.stepContainer}>
          <div style={styles.stepScroll}>
            <div style={styles.inputSection}>
              <div style={styles.addressInputContainer}>
                <div style={styles.addressInputWrapper}>
                  <ThemedText style={styles.addressInputLabel}>To</ThemedText>
                  <input
                    style={styles.addressInput}
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
                <div style={styles.errorRow}>
                  <X size={16} color="white" />
                  <ThemedText style={styles.errorRowText}>{errorMessage}</ThemedText>
                </div>
              ) : null}
            </div>

            <TokensView onTokenPress={handleTokenPress} selectedToken={tokenId} />
          </div>

          <button
            type="button"
            style={{ ...styles.continueButton, ...(disabled ? styles.disabledButton : null) }}
            onClick={handleAddressNext}
            disabled={disabled}
            data-testid="send-address-next-button"
          >
            <ThemedText style={styles.continueButtonText}>Next</ThemedText>
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
        <div style={styles.stepContainer}>
          <div style={styles.stepScroll}>
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
              <div style={styles.errorRow}>
                <X size={16} color="white" />
                <ThemedText style={styles.errorRowText}>{errorMessage}</ThemedText>
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
            style={{ ...styles.continueButton, ...(disabled ? styles.disabledButton : null) }}
            onClick={prepareTransaction}
            disabled={disabled}
            data-testid="send-amount-evm-next-button"
          >
            <ThemedText style={styles.continueButtonText}>{isPreparing ? 'Creating...' : 'Next'}</ThemedText>
          </button>
        </div>
      </RadialGradientScreen>
    );
  }

  // step === 'confirm'
  return (
    <RadialGradientScreen network={network} className="home-screen">
      {!isSuccess && <ScreenSendHeader network={network} title={`Send ${assetTicker}`} onBackPress={() => setStep('amount')} />}

      <div style={styles.confirmContainer}>
        <div style={styles.confirmScroll}>
          {error ? (
            <div style={styles.confirmErrorContainer}>
              <AlertCircle size={40} color="#FF3B30" />
              <ThemedText style={styles.confirmErrorTitle}>Error</ThemedText>
              <ThemedText style={styles.confirmErrorText}>{error}</ThemedText>
              <button type="button" style={styles.goBackButton} onClick={() => setError('')}>
                <ThemedText style={styles.goBackButtonText}>Go Back</ThemedText>
              </button>
            </div>
          ) : isSuccess ? (
            <div style={styles.successContainer}>
              <div style={styles.successCheck}>✓</div>
              <ThemedText type="headline" data-testid="send-success-text">
                Transaction Sent!
              </ThemedText>
            </div>
          ) : (
            <>
              <div style={styles.section}>
                <div style={styles.sectionHeader}>
                  <ThemedText style={styles.sectionHeaderText}>Total</ThemedText>
                </div>
                <div style={styles.totalCard}>
                  <ThemedText style={styles.totalAmount}>{totalDisplay}</ThemedText>
                  {totalUsd ? <ThemedText style={styles.totalUsd}>{totalUsd}</ThemedText> : null}
                </div>
              </div>

              <div style={styles.section}>
                <div style={styles.sectionHeader}>
                  <ThemedText style={styles.sectionHeaderText}>Details</ThemedText>
                </div>
                <div style={styles.detailsCard}>
                  <div style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel}>Amount</ThemedText>
                    <div style={styles.detailValueContainer}>
                      <ThemedText style={styles.detailValue}>
                        {amount} {assetTicker}
                      </ThemedText>
                      {amountUsdValue ? <ThemedText style={styles.detailUsd}>{amountUsdValue}</ThemedText> : null}
                    </div>
                  </div>

                  <div style={styles.divider} />

                  <div style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel}>Network Fee</ThemedText>
                    <div style={styles.detailValueContainer}>
                      <ThemedText style={styles.detailValue}>
                        {feeInNative} {nativeTicker}
                      </ThemedText>
                      {usdFee ? <ThemedText style={styles.detailUsd}>{usdFee}</ThemedText> : null}
                    </div>
                  </div>
                </div>
              </div>

              <div style={styles.section}>
                <div style={styles.sectionHeader}>
                  <ThemedText style={styles.sectionHeaderText}>Send to</ThemedText>
                </div>
                <div style={styles.addressCard}>{formatAddressWithOpacity(address)}</div>
              </div>
            </>
          )}
        </div>

        {!error ? (
          <button
            type="button"
            style={{ ...styles.sendButton, ...(isBroadcasting ? styles.disabledButton : null) }}
            onClick={isSuccess ? () => navigate('/home') : broadcast}
            disabled={isBroadcasting}
            data-testid="send-confirm-button"
          >
            <ThemedText style={styles.sendButtonText}>{isSuccess ? 'Back to Wallet' : isBroadcasting ? 'Sending...' : 'Confirm Send'}</ThemedText>
          </button>
        ) : null}
      </div>
    </RadialGradientScreen>
  );
};

const styles: Record<string, React.CSSProperties> = {
  stepContainer: {
    flex: '1 1 auto',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    padding: '0 16px 24px',
  },
  stepScroll: {
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto',
  },
  inputSection: {
    marginBottom: 30,
  },
  addressInputContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    height: 64,
    boxSizing: 'border-box',
    paddingLeft: 24,
    paddingRight: 12,
    gap: 12,
  },
  addressInputWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  addressInputLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    fontWeight: 400,
    marginBottom: 4,
  },
  addressInput: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    padding: 0,
    margin: 0,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    width: '100%',
  },
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
  errorRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  errorRowText: {
    color: 'white',
    fontSize: 14,
  },
  continueButton: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    padding: '16px 0',
    borderRadius: 16,
    border: 'none',
    gap: 8,
    marginTop: 16,
    cursor: 'pointer',
    width: '100%',
    flex: '0 0 auto',
  },
  continueButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: 600,
  },
  disabledButton: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  // confirm
  confirmContainer: {
    flex: '1 1 auto',
    minHeight: 0,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  },
  confirmScroll: {
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto',
    padding: '0 16px 112px',
  },
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 18,
    padding: 2,
    marginBottom: 32,
  },
  sectionHeader: {
    padding: '2px 16px 4px',
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'left',
  },
  totalCard: {
    borderRadius: 20,
    padding: '24px 0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  totalAmount: {
    fontSize: 24,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  totalUsd: {
    fontSize: 16,
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
  },
  detailsCard: {
    borderRadius: 20,
    padding: '16px 0',
  },
  detailRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 16px',
  },
  detailLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: 400,
  },
  detailValueContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 2,
  },
  detailValue: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: 600,
    textAlign: 'right',
  },
  detailUsd: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 16,
    fontWeight: 400,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    margin: '8px 0',
  },
  addressCard: {
    borderRadius: 20,
    padding: 16,
    minHeight: 79,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 380,
    margin: '0 auto',
  },
  addressDisplay: {
    fontFamily: 'monospace',
    lineHeight: '24px',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 18,
    textAlign: 'center',
    wordBreak: 'break-all',
  },
  addressHighlight: {
    color: 'rgb(255, 255, 255)',
  },
  addressLetterSpacing: {
    letterSpacing: 1.6,
  },
  confirmErrorContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
  },
  confirmErrorTitle: {
    fontSize: 24,
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 16,
    marginBottom: 8,
  },
  confirmErrorText: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 24,
  },
  goBackButton: {
    backgroundColor: '#000000',
    padding: '16px 32px',
    borderRadius: 16,
    width: '80%',
    border: 'none',
    cursor: 'pointer',
  },
  goBackButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: 600,
  },
  successContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 20px',
    gap: 16,
  },
  successCheck: {
    color: '#4CAF50',
    fontSize: 64,
    lineHeight: 1,
  },
  sendButton: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    padding: '16px 0',
    borderRadius: 16,
    border: 'none',
    gap: 8,
    height: 56,
    boxSizing: 'border-box',
    cursor: 'pointer',
    zIndex: 1000,
  },
  sendButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: 600,
  },
};

export default SendEvm;
