import writeQR from '@paulmillr/qr';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ThemedText } from '../../components/ThemedText';

import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { capitalizeFirstLetter, formatBalance } from '@shared/modules/string-utils';
import { NETWORK_ARK, NETWORK_LIQUID, NETWORK_LIQUID_TESTNET, NETWORK_SPARK } from '@shared/types/networks';
import { BackgroundCaller } from '../../modules/background-caller';
import { AddressBubble, Input, WideButton } from './DesignSystem';
import { TLightningWallet } from '@shared/types/TWallet';
import { BreezWallet } from '@shared/class/wallets/breez-wallet';
import assert from 'assert';
import { SparkWallet } from '@shared/class/wallets/spark-wallet';
import { ArkWallet } from '@shared/class/wallets/ark-wallet';

export interface ReceiveLightningProps {
  network: typeof NETWORK_SPARK | typeof NETWORK_LIQUID | typeof NETWORK_LIQUID_TESTNET | typeof NETWORK_ARK;
}

const ReceiveLightning: React.FC = () => {
  const location = useLocation();
  const { network } = location.state as ReceiveLightningProps;
  const navigate = useNavigate();
  const [amount, setAmount] = useState<string>('');
  const [invoice, setInvoice] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const { accountNumber } = useContext(AccountNumberContext);
  const [imgSrc, setImgSrc] = useState('');
  const [limits, setLimits] = useState<{ min: number; max: number } | null>(null);
  const [isWalletInitialized, setIsWalletInitialized] = useState<boolean>(false);
  const [feesSat, setFeesSat] = useState<number | null>(null);
  const walletRef = useRef<TLightningWallet | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isInvoicePaid, setIsInvoicePaid] = useState<boolean>(false);

  // Polling effect for invoice payment status
  useEffect(() => {
    if (!invoice || !walletRef.current) {
      return;
    }

    const pollForPayment = async () => {
      try {
        const wallet = walletRef.current;
        if (!wallet) return;

        console.log('polling for invoice status...');
        const isPaid = await wallet.isInvoicePaid(invoice);
        console.log('polling for invoice status:', { isPaid });
        if (isPaid) {
          setIsInvoicePaid(true);
          // Clear the interval when payment is detected
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
      } catch (error: any) {
        console.error('Error checking invoice payment status:', error);
        setError('Error checking invoice payment status: ' + error.message);
      }
    };

    // Set up interval to poll every 5 seconds
    pollingIntervalRef.current = setInterval(pollForPayment, 3_000);

    // Cleanup function
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [invoice]);

  // Cleanup interval when component unmounts
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

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

  // Initialize the wallet
  useEffect(() => {
    const initializeWallet = async () => {
      try {
        const w = await BackgroundCaller.lazyInitWallet(network, accountNumber);
        assert(w instanceof BreezWallet || w instanceof SparkWallet || w instanceof ArkWallet);
        walletRef.current = w;
        setIsWalletInitialized(true);

        // Fetch limits after wallet is initialized
        if (walletRef.current) {
          const limitsResponse = await walletRef.current.fetchLightningLimits();
          setLimits({
            min: limitsResponse.receive.minSat,
            max: limitsResponse.receive.maxSat,
          });
        }
      } catch (err) {
        console.error('Failed to initialize wallet:', err);
        setError('Failed to initialize wallet. Please try again.');
      }
    };

    initializeWallet();

    return () => {
      walletRef.current = null;
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

    if (!walletRef.current || !isWalletInitialized) {
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

      const response = await walletRef.current.createLightningInvoice(amountSats, 'please pay');

      setFeesSat(response.serviceFeeSat);
      setInvoice(response.invoice);
      setImgSrc(qrGifDataUrl(response.invoice));
    } catch (err: any) {
      console.error('Failed to generate invoice:', err);
      setError('Failed to generate invoice: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isInvoicePaid) {
    return (
      <div style={{ position: 'relative' }}>
        <ThemedText type="headline">Receive Lightning on {network.charAt(0).toUpperCase() + network.slice(1)}</ThemedText>

        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ color: '#4CAF50', fontSize: '48px', marginBottom: '20px' }}>✓</div>
          <h2 style={{ color: '#4CAF50', marginBottom: '15px' }}>
            <ThemedText type="headline">
              Received: +{formatBalance(String(+amount - (feesSat || 0)), getDecimalsByNetwork(network), 8)} {getTickerByNetwork(network)}
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
      <ThemedText type="headline">Receive Lightning on {capitalizeFirstLetter(network)}</ThemedText>

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

          {error && <ThemedText style={{ color: 'red', textAlign: 'center', margin: '10px 0' }}>{error}</ThemedText>}

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
