import { Scan, ZapIcon } from 'lucide-react';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ThemedText } from '../../components/ThemedText';
import * as bolt11 from 'bolt11';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { formatBalance } from '@shared/modules/string-utils';
import { NETWORK_BITCOIN, NETWORK_LIQUID, NETWORK_LIQUIDTESTNET, NETWORK_SPARK } from '@shared/types/networks';
import { AskMnemonicContext } from '../../hooks/AskMnemonicContext';
import { useScanQR } from '../../hooks/ScanQrContext';
import { BackgroundCaller } from '../../modules/background-caller';
import { Button, HodlButton, Input, WideButton } from './DesignSystem';
import BigNumber from 'bignumber.js';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { TLightningWallet } from '@shared/types/TWallet';
import assert from 'assert';
import { BreezWallet } from '@shared/class/wallets/breez-wallet';
import { SparkWallet } from '@shared/class/wallets/spark-wallet';

export interface SendLightningProps {
  network: typeof NETWORK_SPARK | typeof NETWORK_LIQUID | typeof NETWORK_LIQUIDTESTNET;
}

const maxFeePercent = 5; // hardcoded at the moment. might give user option to adjust later

const SendLightning: React.FC = () => {
  const location = useLocation();
  const { network } = location.state as SendLightningProps;
  const scanQr = useScanQR();
  const navigate = useNavigate();
  const { askMnemonic } = useContext(AskMnemonicContext);
  const [invoice, setInvoice] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [sendState, setSendState] = useState<'idle' | 'preparing' | 'prepared' | 'sending' | 'success'>('idle');
  const [feeSats, setFeeSats] = useState<number | null>(null);
  const [amountToSend, setAmountToSend] = useState<string>('');
  const { accountNumber } = useContext(AccountNumberContext);
  const walletRef = useRef<TLightningWallet | null>(null);

  const onInvoiceInput = async (scanned: string) => {
    setInvoice(scanned);
    try {
      const decoded = bolt11.decode(scanned.trim());
      setAmountToSend(String(decoded.satoshis));

      if (!decoded.satoshis) {
        throw new Error('Could not determine payment amount from invoice');
      }

      const feeBN = new BigNumber(decoded.satoshis).dividedBy(100).multipliedBy(maxFeePercent).toNumber();
      setFeeSats(Math.max(Math.round(feeBN), 1));
      setError('');
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleQRScan = async () => {
    const scanned = await scanQr();
    if (scanned && scanned.trim()) {
      await onInvoiceInput(scanned.trim());
    }
  };

  // Initialize the wallet
  useEffect(() => {
    const initializeWallet = async () => {
      try {
        const w = await BackgroundCaller.lazyInitWallet(network, accountNumber);
        assert(w instanceof BreezWallet || w instanceof SparkWallet);
        walletRef.current = w;
      } catch (err) {
        console.error('Failed to initialize wallet:', err);
        setError('Failed to initialize wallet. Please try again.');
      }
    };

    initializeWallet();

    return () => {
      walletRef.current = null;
    };
  }, [network, accountNumber]);

  const prepareTransaction = async () => {
    setSendState('preparing');
    setError('');
    try {
      await askMnemonic(); // verify password

      setSendState('prepared');
    } catch (error: any) {
      console.error('Prepare transaction error:', error);
      setError(error.message);
      setSendState('idle');
    }
  };

  const sendPayment = async () => {
    try {
      if (!walletRef.current) {
        throw new Error('Internal error: wallet not initialized');
      }

      setSendState('sending');
      await new Promise((r) => setTimeout(r, 200)); // propagate

      // Send payment
      const paymentResponse = await walletRef.current.payLightningInvoice(invoice, maxFeePercent);

      if (paymentResponse) {
        setSendState('success');
      } else {
        setSendState('idle');
        setError('Payment failed');
      }
    } catch (error: any) {
      console.error('Send payment error:', error);
      setError(error.message);
    }
  };

  const handleCancel = () => {
    setSendState('idle');
  };

  if (sendState === 'success') {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <div style={{ color: '#4CAF50', fontSize: '48px', marginBottom: '20px' }}>✓</div>
        <h2 style={{ color: '#4CAF50', marginBottom: '15px' }}>
          <ThemedText type="headline">Sent!</ThemedText>
        </h2>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          <ThemedText>{amountToSend ? formatBalance(amountToSend, 8, 8) : ''} sats have been sent</ThemedText>
        </p>
        <WideButton onClick={() => navigate('/')}>
          <ThemedText>Back to Wallet</ThemedText>
        </WideButton>
      </div>
    );
  }

  return (
    <div>
      <ThemedText type="headline">Send Lightning</ThemedText>
      <div style={{ textAlign: 'left' }}>
        <ThemedText type="defaultSemiBold">Lightning Invoice</ThemedText>
        <div style={{ marginBottom: '10px' }}></div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Input
            data-testid="lightning-invoice-input"
            type="text"
            placeholder="Enter the Lightning invoice"
            onChange={(event) => onInvoiceInput(event.target.value)}
            value={invoice}
            style={{ flexGrow: 1, marginRight: '10px' }}
          />
          <Button
            style={{
              marginBottom: '10px',
              marginLeft: '5px',
              border: '1px solid #282c34',
              borderRadius: '5px',
              width: '50px',
              height: '40px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'white',
              color: 'black',
              cursor: 'pointer',
              paddingLeft: '25px',
            }}
            onClick={handleQRScan}
          >
            <Scan />
          </Button>
        </div>
      </div>

      <br />
      <div style={{ width: '100%' }}>
        {error && (
          <div style={{ color: 'red', width: '100%', marginBottom: '15px' }}>
            <span style={{ fontSize: 16 }}>{error}</span>
          </div>
        )}

        {sendState === 'preparing' || sendState === 'sending' ? <span>loading...</span> : null}

        {invoice && amountToSend && (
          <div style={{ backgroundColor: '#f5f5f5', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Payment Details</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Amount:</span>
              <strong>
                {amountToSend ? formatBalance(amountToSend, getDecimalsByNetwork(NETWORK_BITCOIN)) : ''} {getTickerByNetwork(network)}
              </strong>
            </div>
            {feeSats !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Fee:</span>
                <strong>up to {feeSats} sats</strong>
              </div>
            )}
          </div>
        )}

        {sendState === 'idle' && (
          <WideButton data-testid="verify-payment-button" onClick={prepareTransaction} style={{ backgroundColor: '#FF9500' }}>
            <ZapIcon />
            <ThemedText>Send</ThemedText>
          </WideButton>
        )}

        {sendState === 'prepared' && (
          <div>
            <HodlButton onHold={sendPayment} style={{ backgroundColor: '#FF9500' }}>
              <ZapIcon />
              <ThemedText>Hold to send payment</ThemedText>
            </HodlButton>

            <button
              onClick={handleCancel}
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
              <ThemedText>Cancel</ThemedText>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SendLightning;
