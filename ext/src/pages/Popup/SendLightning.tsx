import { Scan, ZapIcon } from 'lucide-react';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ThemedText } from '../../components/ThemedText';
import * as bolt11 from 'bolt11';
import * as bip21 from 'bip21';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { formatBalance } from '@shared/modules/string-utils';
import { NETWORK_BITCOIN, NETWORK_LIQUID, NETWORK_LIQUID_TESTNET, NETWORK_SPARK } from '@shared/types/networks';
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
import Lnurl, { LnurlPayServicePayload } from '@shared/class/lnurl';

export interface SendLightningProps {
  network: typeof NETWORK_SPARK | typeof NETWORK_LIQUID | typeof NETWORK_LIQUID_TESTNET;
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
  const [lnurl, setLnurl] = useState<Lnurl | undefined>();
  const [isPayingToLightningAddress, setIsPayingToLightningAddress] = useState<boolean>(false);
  const [lnurlPayServicePayload, setLnurlPayServicePayload] = useState<LnurlPayServicePayload | undefined>(undefined);
  const [lnAddressAmountToSend, setLnAddressAmountToSend] = useState<string>('');

  const onInvoiceInput = async (raw: string) => {
    const scanned = raw.trim().replace('lightning:', '').replace('LIGHTNING:', '');
    setInvoice(scanned);
    setError('');
    setLnurl(undefined);
    setIsPayingToLightningAddress(false);
    setLnurlPayServicePayload(undefined);
    setLnAddressAmountToSend('');

    try {
      if (Lnurl.isLightningAddress(scanned)) {
        const ln = new Lnurl(scanned);
        const response = await ln.callLnurlPayService();
        if (response) {
          setLnurl(ln);
          setIsPayingToLightningAddress(true);
          setLnurlPayServicePayload(response);
          if (response.min && response.min === response.max) {
            setLnAddressAmountToSend(String(response.min));
          }
          return;
        }
      }

      try {
        const bip21decoded = bip21.decode(scanned);
        // @ts-ignore lightning is a widely used bip21 extension
        if (bip21decoded?.options?.lightning) {
          // @ts-ignore
          const lnInv = bip21decoded.options.lightning as string;
          setInvoice(lnInv);
          // fallthrough to bolt11 decode below
        }
      } catch {}

      const decoded = bolt11.decode(scanned);
      setAmountToSend(decoded.satoshis ? String(decoded.satoshis) : '');

      if (!decoded.satoshis) {
        throw new Error('Could not determine payment amount from invoice');
      }

      const feeBN = new BigNumber(decoded.satoshis).dividedBy(100).multipliedBy(maxFeePercent).toNumber();
      setFeeSats(Math.max(Math.round(feeBN), 2));
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

  const prepareLightningAddressPayment = async () => {
    setSendState('preparing');
    setError('');
    try {
      assert(walletRef.current, 'Internal error: wallet not initialized');
      assert(lnurl && lnAddressAmountToSend && parseInt(lnAddressAmountToSend), 'Internal error: lnurl and amount to send not set');
      await askMnemonic();
      const bolt11payload = await lnurl.requestBolt11FromLnurlPayService(parseInt(lnAddressAmountToSend), 'LayerzWallet');
      if (bolt11payload && bolt11payload.pr) {
        setSendState('prepared');
        await onInvoiceInput(bolt11payload.pr);
      } else {
        throw new Error('Fetching invoice from LNURL service failed');
      }
    } catch (error: any) {
      console.error('Prepare lightning address payment error:', error);
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

  const sendLightningAddressPayment = async () => {
    try {
      if (!walletRef.current) {
        throw new Error('Internal error: wallet not initialized');
      }
      assert(lnurl && lnAddressAmountToSend && parseInt(lnAddressAmountToSend), 'Internal error: lnurl and amount to send not set');
      setSendState('sending');
      await new Promise((r) => setTimeout(r, 200));
      if (invoice) {
        const paymentResponse = await walletRef.current.payLightningInvoice(invoice, maxFeePercent);
        if (paymentResponse) {
          setSendState('success');
        } else {
          setSendState('idle');
          setError('Payment failed');
        }
      }
    } catch (error: any) {
      console.error('Send lightning address payment error:', error);
      setError(error.message);
      setSendState('idle');
    }
  };

  const handleCancel = () => {
    setInvoice('');
    setError('');
    setLnurl(undefined);
    setIsPayingToLightningAddress(false);
    setLnurlPayServicePayload(undefined);
    setLnAddressAmountToSend('');
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
        <ThemedText type="defaultSemiBold">Lightning Invoice or Lightning Address</ThemedText>
        <div style={{ marginBottom: '10px' }}></div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Input
            data-testid="lightning-invoice-input"
            type="text"
            placeholder="Lightning invoice or Lightning address here"
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

        {isPayingToLightningAddress && (
          <div style={{ backgroundColor: '#f5f5f5', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Paying to Lightning Address</h3>
            {lnurlPayServicePayload?.description ? (
              <div style={{ marginBottom: '10px' }}>
                <span>Description: </span>
                <strong>{lnurlPayServicePayload.description}</strong>
              </div>
            ) : null}
            {lnurlPayServicePayload?.min && lnurlPayServicePayload?.max && (
              <Input
                type="number"
                value={lnAddressAmountToSend}
                onChange={(e) => setLnAddressAmountToSend(e.target.value)}
                placeholder={`Enter amount between ${lnurlPayServicePayload.min} and ${lnurlPayServicePayload.max} sats`}
                disabled={!!lnurlPayServicePayload?.fixed}
              />
            )}
          </div>
        )}

        {!isPayingToLightningAddress && invoice && amountToSend && (
          <div style={{ backgroundColor: '#f5f5f5', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Payment Details</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Amount:</span>
              <strong>
                {amountToSend ? formatBalance(amountToSend, getDecimalsByNetwork(NETWORK_BITCOIN)) : ''} {getTickerByNetwork(NETWORK_BITCOIN)}
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

        {isPayingToLightningAddress && sendState === 'idle' && (
          <WideButton onClick={prepareLightningAddressPayment} style={{ backgroundColor: '#FF9500' }}>
            <ZapIcon />
            <ThemedText>Send</ThemedText>
          </WideButton>
        )}

        {!isPayingToLightningAddress && sendState === 'idle' && invoice && amountToSend && (
          <WideButton data-testid="verify-payment-button" onClick={prepareTransaction} style={{ backgroundColor: '#FF9500' }}>
            <ZapIcon />
            <ThemedText>Send</ThemedText>
          </WideButton>
        )}

        {isPayingToLightningAddress && sendState === 'prepared' && (
          <div>
            <HodlButton onHold={sendLightningAddressPayment} style={{ backgroundColor: '#FF9500' }}>
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

        {!isPayingToLightningAddress && sendState === 'prepared' && (
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
