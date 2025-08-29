import assert from 'assert';
import BigNumber from 'bignumber.js';
import { SendIcon } from 'lucide-react';
import React, { useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useTokenBalance } from '@shared/hooks/useTokenBalance';
import { capitalizeFirstLetter, formatBalance } from '@shared/modules/string-utils';
import { NETWORK_SPARK } from '@shared/types/networks';
import { AskMnemonicContext } from '../../hooks/AskMnemonicContext';
import { BackgroundCaller } from '../../modules/background-caller';
import { HodlButton, Input, WideButton } from './DesignSystem';
import { SparkWallet } from '@shared/class/wallets/spark-wallet';
import { TokenBalanceMap, UserTokenMetadata } from '@buildonspark/spark-sdk';
import { useBalance } from '@shared/hooks/useBalance';

export interface SendTokenSparkProps {
  tokenPublicKey: string;
}

// Enum for the different steps in the send token flow
export enum SendTokenSparkStep {
  Init,
  Loading,
  Preparing,
  Prepared,
  Sending,
  Sent,
}

const SendTokenSpark: React.FC = () => {
  const [step, setStep] = useState<SendTokenSparkStep>(SendTokenSparkStep.Init);
  const location = useLocation();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { tokenPublicKey } = location.state as SendTokenSparkProps;
  const { balance: balanceNative } = useBalance(network, accountNumber, BackgroundCaller);
  const { balance } = useTokenBalance(network, accountNumber, tokenPublicKey, BackgroundCaller);

  const [toAddress, setToAddress] = useState<string>('');
  const [amountToSend, setAmountToSend] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [token, setToken] = useState<UserTokenMetadata>();
  const [tokenIdentifier, setTokenIdentifier] = useState<string>('');
  const { askMnemonic } = useContext(AskMnemonicContext);

  // loading token
  useEffect(() => {
    const loadToken = async () => {
      try {
        const wallet = await BackgroundCaller.lazyInitWallet(NETWORK_SPARK, accountNumber);
        assert(wallet instanceof SparkWallet, 'Not a Spark wallet');

        const tokenBalances: TokenBalanceMap = wallet.getTokenBalances();

        for (const [key, value] of tokenBalances.entries()) {
          if (value.tokenMetadata.tokenPublicKey === tokenPublicKey) {
            setToken(value.tokenMetadata);
            setTokenIdentifier(key);
            return;
          }
        }
        setError('Token not found');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    loadToken();
  }, [accountNumber, tokenPublicKey]);

  useEffect(() => {
    // do nothing, just to trigger a re-render when balanceNative changes;
    // because sparkTokens in `useTokenBalance` are not fetched from network, they are only taken from cached value which updates
    // only when SparkWallet updates his native balance
  }, [balanceNative, network]);

  const actuallySend = async () => {
    try {
      assert(token, 'internal error: token not loaded');
      setStep(SendTokenSparkStep.Sending);
      await new Promise((resolve) => setTimeout(resolve, 200)); // propagate ui
      const wallet = await BackgroundCaller.lazyInitWallet(NETWORK_SPARK, accountNumber);
      assert(wallet instanceof SparkWallet, 'Not a Spark wallet');

      const satValueToSend = new BigNumber(amountToSend).multipliedBy(new BigNumber(10).pow(token.decimals)).toFixed(0);

      const transactionId = await wallet.transferTokens(tokenIdentifier, BigInt(satValueToSend), toAddress);

      if (transactionId) {
        setStep(SendTokenSparkStep.Sent);
      } else {
        setError('Error: transaction failed (unknown error)');
      }
    } catch (error: any) {
      setError(error.message);
      setStep(SendTokenSparkStep.Init);
    }
  };

  const prepareTransaction = async () => {
    setStep(SendTokenSparkStep.Loading);
    await new Promise((resolve) => setTimeout(resolve, 200)); // propagate ui
    setError('');
    try {
      assert(balance, 'internal error: balance not loaded');
      assert(token, 'internal error: token not loaded');
      assert(toAddress, 'recipient address empty');
      const amt = parseFloat(amountToSend);
      assert(!isNaN(amt), 'Invalid amount');
      assert(amt > 0, 'Amount should be > 0');

      const satValueToSendBN = new BigNumber(amt);
      const satValueToSend = satValueToSendBN.multipliedBy(new BigNumber(10).pow(token.decimals)).toString(10);
      assert(new BigNumber(balance).gte(satValueToSend), 'Not enough balance');

      await askMnemonic(); // asking only to make sure user knows it, we dont actually need it
      setStep(SendTokenSparkStep.Prepared);
    } catch (error: any) {
      console.error(error.message);
      setError(error.message);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: '0px' }}>Send {token?.tokenName}</h2>
      <span style={{ color: 'gray' }}>on {capitalizeFirstLetter(network)}</span>
      <br />
      <br />

      {step !== SendTokenSparkStep.Sent ? (
        <>
          <div style={{ textAlign: 'left' }}>
            <b>Recipient</b>
            <div style={{ marginBottom: '10px' }}></div>
            <Input data-testid="recipient-address-input" type="text" placeholder="Enter the recipient's address" onChange={(event) => setToAddress(event.target.value)} />
          </div>
          <hr />
          <div style={{ textAlign: 'left' }}>
            <b>Amount</b>
            <div style={{ marginBottom: '10px' }}></div>
            <Input type="numbers" data-testid="amount-input" placeholder="0.00" onChange={(event) => setAmountToSend(event.target.value)} />
            <div style={{ color: 'gray', width: '100%', marginBottom: '15px' }}>
              <span style={{ fontSize: 16 }}>
                Available balance: {token?.tokenTicker} {balance ? formatBalance(balance, token?.decimals ?? 0, 2) : ''}
              </span>
            </div>
          </div>
        </>
      ) : null}

      <br />
      <div style={{ width: '100%' }}>
        {error ? (
          <div style={{ color: 'red', width: '100%', marginBottom: '15px' }}>
            <span style={{ fontSize: 16 }}>{error}</span>
          </div>
        ) : null}

        {step === SendTokenSparkStep.Loading ? <span>loading...</span> : null}
        {step === SendTokenSparkStep.Sending ? <span>sending...</span> : null}

        {step === SendTokenSparkStep.Init ? (
          <WideButton data-testid="send-screen-send-button" onClick={prepareTransaction}>
            <SendIcon />
            Send
          </WideButton>
        ) : null}

        {step === SendTokenSparkStep.Prepared ? (
          <div>
            <HodlButton onHold={actuallySend}>
              <SendIcon />
              Hold to confirm send
            </HodlButton>

            <button
              onClick={() => {
                setStep(SendTokenSparkStep.Init);
                setError('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'gray',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: '16px',
                marginTop: '10px',
              }}
            >
              Cancel
            </button>
          </div>
        ) : null}
        {step === SendTokenSparkStep.Sent ? (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 24 }}>
              <div
                style={{
                  background: '#e6f9ed',
                  borderRadius: '50%',
                  width: 64,
                  height: 64,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                }}
              >
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                  <circle cx="18" cy="18" r="18" fill="#4BB543" />
                  <path d="M11 19.5L16 24.5L25 15.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div style={{ fontWeight: 600, fontSize: 18, color: '#222', marginBottom: 6 }}>Transaction Sent!</div>
              <div style={{ color: '#666', fontSize: 15, marginBottom: 18, textAlign: 'center', maxWidth: 220 }}>Your token transfer was successful.</div>
              <button
                onClick={() => {
                  setStep(SendTokenSparkStep.Init);
                  setError('');
                }}
                style={{
                  background: '#4BB543',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  padding: '10px 28px',
                  fontSize: '16px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  boxShadow: '0 1px 4px rgba(75,181,67,0.08)',
                  transition: 'background 0.2s',
                }}
              >
                Send Another
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SendTokenSpark;
