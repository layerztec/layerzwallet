import { PrepareReceiveRequest, ReceivePaymentRequest } from '@breeztech/breez-sdk-liquid';
import writeQR from '@paulmillr/qr';
import BigNumber from 'bignumber.js';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ThemedText } from '../../components/ThemedText';

import { BreezWallet } from '@shared/class/wallets/breez-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useBalance } from '@shared/hooks/useBalance';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { formatBalance } from '@shared/modules/string-utils';
import { NETWORK_LIQUID, NETWORK_LIQUIDTESTNET } from '@shared/types/networks';
import { StringNumber } from '@shared/types/string-number';
import { BackgroundCaller } from '../../modules/background-caller';
import { getBreezNetwork } from '../../modules/breeze-adapter';
import { AddressBubble, Input, WideButton } from './DesignSystem';

const ReceiveLightning: React.FC = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState<string>('');
  const [invoice, setInvoice] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const network = useContext(NetworkContext).network as typeof NETWORK_LIQUID | typeof NETWORK_LIQUIDTESTNET;
  const { accountNumber } = useContext(AccountNumberContext);
  const [imgSrc, setImgSrc] = useState('');
  const [oldBalance, setOldBalance] = useState<StringNumber>('');
  const { balance } = useBalance(network, accountNumber, BackgroundCaller);
  const [limits, setLimits] = useState<{ min: number; max: number } | null>(null);
  const [isWalletInitialized, setIsWalletInitialized] = useState<boolean>(false);
  const [feesSat, setFeesSat] = useState<number | null>(null);
  const breezWalletRef = useRef<BreezWallet | null>(null);

  const isNewBalanceGT = useCallback((): false | StringNumber => {
    if (Boolean(balance && oldBalance && new BigNumber(balance).gt(oldBalance))) {
      return new BigNumber(balance ?? '0').minus(oldBalance).toString(10);
    }

    return false;
  }, [balance, oldBalance]);

  useEffect(() => {
    if (!oldBalance && balance) {
      // initial update
      setOldBalance(balance);
      return;
    }
  }, [balance, isNewBalanceGT, oldBalance]);

  const qrGifDataUrl = (text: string) => {
    const gifBytes = writeQR(text, 'gif', {
      scale: text.length > 43 ? 4 : 7,
    });
    const blob = new Blob([gifBytes], { type: 'image/gif' });
    return URL.createObjectURL(blob);
  };

  // Handle amount change with validation
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Only allow digits (no decimals)
    if (value === '' || /^\d+$/.test(value)) {
      setAmount(value);
      setError('');
    }
  };

  // Initialize the BreezWallet
  useEffect(() => {
    const initializeWallet = async () => {
      try {
        const breezMnemonic = await BackgroundCaller.getSubMnemonic(accountNumber);
        breezWalletRef.current = new BreezWallet(breezMnemonic, getBreezNetwork(network));
        setIsWalletInitialized(true);

        // Fetch limits after wallet is initialized
        if (breezWalletRef.current) {
          const limitsResponse = await breezWalletRef.current.fetchLightningLimits();
          setLimits({
            min: limitsResponse.receive.minSat,
            max: limitsResponse.receive.maxSat,
          });
        }
      } catch (err) {
        console.error('Failed to initialize Breez wallet:', err);
        setError('Failed to initialize wallet. Please try again.');
      }
    };

    initializeWallet();

    return () => {
      breezWalletRef.current = null;
      setIsWalletInitialized(false);
    };
  }, [network, accountNumber]);

  const generateInvoice = async () => {
    // Validate amount
    if (!amount || amount === '') {
      setError('Please enter an amount');
      return;
    }

    // Check if amount is valid integer
    if (!/^\d+$/.test(amount)) {
      setError('Amount must be a whole number (integer)');
      return;
    }

    const amountSats = parseInt(amount, 10);

    // Check if amount is positive
    if (amountSats <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    if (!breezWalletRef.current || !isWalletInitialized) {
      setError('Wallet is not initialized yet. Please try again.');
      return;
    }

    setIsGenerating(true);
    setError('');
    setFeesSat(null);

    try {
      // Validate against limits
      if (limits) {
        if (amountSats < limits.min) {
          setError(`Amount must be at least ${limits.min} sats`);
          setIsGenerating(false);
          return;
        }
        if (amountSats > limits.max) {
          setError(`Amount must be less than ${limits.max} sats`);
          setIsGenerating(false);
          return;
        }
      }

      // Step 1: Prepare receive payment to get fee information
      const prepareRequest: PrepareReceiveRequest = {
        paymentMethod: 'lightning',
        amount: { type: 'bitcoin', payerAmountSat: amountSats },
      };

      const prepareResponse = await breezWalletRef.current.prepareReceivePayment(prepareRequest);
      setFeesSat(prepareResponse.feesSat);

      // Step 2: Generate the actual lightning invoice
      const receiveRequest: ReceivePaymentRequest = {
        prepareResponse: prepareResponse,
        description: `Payment to ${getTickerByNetwork(network)} wallet`,
      };

      const receiveResponse = await breezWalletRef.current.receivePayment(receiveRequest);
      setInvoice(receiveResponse.destination);
      setImgSrc(qrGifDataUrl(receiveResponse.destination));
    } catch (err) {
      console.error('Failed to generate invoice:', err);
      setError('Failed to generate invoice. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isNewBalanceGT()) {
    return (
      <div style={{ position: 'relative' }}>
        <ThemedText type="headline">Receive Lightning on {network.charAt(0).toUpperCase() + network.slice(1)}</ThemedText>

        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ color: '#4CAF50', fontSize: '48px', marginBottom: '20px' }}>✓</div>
          <h2 style={{ color: '#4CAF50', marginBottom: '15px' }}>
            <ThemedText type="headline">
              Received: +{isNewBalanceGT() ? formatBalance(String(isNewBalanceGT()), getDecimalsByNetwork(network), 8) : ''} {getTickerByNetwork(network)}
            </ThemedText>
          </h2>
          <WideButton onClick={() => navigate('/')}>
            <ThemedText>Back to Wallet</ThemedText>
          </WideButton>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <ThemedText type="headline">Receive Lightning on {network.charAt(0).toUpperCase() + network.slice(1)}</ThemedText>

      {!invoice ? (
        <>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <ThemedText style={{ color: 'gray', fontSize: '18px' }}>Enter amount to receive in sats</ThemedText>
            {limits && (
              <ThemedText style={{ color: 'gray', fontSize: '14px' }}>
                Min: {limits.min} sats | Max: {limits.max} sats
              </ThemedText>
            )}
          </div>

          <div style={{ margin: '20px 0' }}>
            <Input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Amount (sats)" value={amount} onChange={handleAmountChange} style={{ fontSize: '18px', textAlign: 'center' }} />
          </div>

          {error && (
            <div style={{ color: 'red', textAlign: 'center', margin: '10px 0' }}>
              <ThemedText>{error}</ThemedText>
            </div>
          )}

          <WideButton onClick={generateInvoice} disabled={isGenerating || !isWalletInitialized}>
            <ThemedText>{isGenerating ? 'Generating...' : !isWalletInitialized ? 'Initializing...' : 'Generate Invoice'}</ThemedText>
          </WideButton>
        </>
      ) : (
        <>
          <div
            style={{
              color: 'gray',
              textAlign: 'center',
              width: '100%',
              marginBottom: '15px',
            }}
          >
            <ThemedText style={{ fontSize: 18 }}>Scan the QR code or copy the invoice below</ThemedText>
          </div>

          <div
            style={{
              width: '300px',
              height: '300px',
              backgroundColor: '#e0e0e0',
              margin: '0 auto',
              borderRadius: '10px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {imgSrc && <img id="lnInvoiceQr" src={imgSrc} alt="lightning invoice qr" />}
          </div>

          <div style={{ margin: '20px 0' }}>
            <AddressBubble address={invoice} showCopyButton={true} />
          </div>

          <div style={{ margin: '20px 0', textAlign: 'center' }}>
            <ThemedText style={{ color: 'gray', fontSize: '16px' }}>Amount: {amount} sats</ThemedText>
            {feesSat !== null && <ThemedText style={{ color: 'gray', fontSize: '14px' }}>Network Fee: {feesSat} sats</ThemedText>}
          </div>

          <WideButton
            onClick={() => {
              setInvoice('');
              setImgSrc('');
              setFeesSat(null);
            }}
            style={{ marginBottom: '10px' }}
          >
            <ThemedText>Generate New Invoice</ThemedText>
          </WideButton>

          <WideButton onClick={() => navigate('/')}>
            <ThemedText>Back to Wallet</ThemedText>
          </WideButton>
        </>
      )}

      <style>
        {`
          @keyframes fadeInOut {
            0% {
              opacity: 0;
              transform: scale(0.8);
            }
            20% {
              opacity: 1;
              transform: scale(1);
            }
            80% {
              opacity: 1;
              transform: scale(1);
            }
            100% {
              opacity: 0;
              transform: scale(0.8);
            }
          }
        `}
      </style>
    </div>
  );
};

export default ReceiveLightning;
