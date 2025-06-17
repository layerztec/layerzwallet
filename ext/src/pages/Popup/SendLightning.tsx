import BigNumber from 'bignumber.js';
import { Scan, ZapIcon } from 'lucide-react';
import React, { useContext, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ThemedText } from '../../components/ThemedText';
import { PrepareSendRequest, PrepareSendResponse, SendPaymentRequest } from '@breeztech/breez-sdk-liquid';

import { BreezWallet, getBreezNetwork } from '@shared/class/wallets/breez-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { formatBalance } from '@shared/modules/string-utils';
import { NETWORK_LIQUID, NETWORK_LIQUIDTESTNET } from '@shared/types/networks';
import { AskMnemonicContext } from '../../hooks/AskMnemonicContext';
import { useScanQR } from '../../hooks/ScanQrContext';
import { BackgroundCaller } from '../../modules/background-caller';
import { Button, HodlButton, Input, WideButton } from './DesignSystem';

const SendLightning: React.FC = () => {
  const scanQr = useScanQR();
  const navigate = useNavigate();
  const { askMnemonic } = useContext(AskMnemonicContext);
  const [invoice, setInvoice] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [sendState, setSendState] = useState<'idle' | 'preparing' | 'prepared' | 'success'>('idle');
  const [preparedResponse, setPreparedResponse] = useState<PrepareSendResponse | null>(null);
  const [feeSats, setFeeSats] = useState<number | null>(null);
  const [amountToSend, setAmountToSend] = useState<string>('');
  const network = useContext(NetworkContext).network as typeof NETWORK_LIQUID | typeof NETWORK_LIQUIDTESTNET;
  const { accountNumber } = useContext(AccountNumberContext);
  const breezWallet = useRef<BreezWallet | null>(null);

  const handleQRScan = async () => {
    const scanned = await scanQr();
    if (scanned) {
      setInvoice(scanned);
    }
  };

  const prepareTransaction = async () => {
    setSendState('preparing');
    setError('');
    try {
      // Validate invoice
      if (!invoice || invoice.trim() === '') {
        throw new Error('Please enter a valid Lightning invoice');
      }

      const mnemonic = await BackgroundCaller.getSubMnemonic(accountNumber);
      const wallet = new BreezWallet(mnemonic, getBreezNetwork(network));
      breezWallet.current = wallet;

      // Prepare the payment
      const prepareSendRequest: PrepareSendRequest = {
        destination: invoice.trim(),
      };

      const prepareResponse = await wallet.prepareSendPayment(prepareSendRequest);
      setPreparedResponse(prepareResponse);
      setFeeSats(prepareResponse.feesSat || 0);

      // Extract amount information from the destination
      if (prepareResponse.destination.type === 'bolt11' && prepareResponse.destination.invoice.amountMsat) {
        const msat = new BigNumber(prepareResponse.destination.invoice.amountMsat);
        const satAmount = msat.dividedBy(1000).integerValue(BigNumber.ROUND_FLOOR);
        setAmountToSend(satAmount.toString());
      } else {
        throw new Error('Could not determine payment amount from invoice');
      }

      setSendState('prepared');
    } catch (error: any) {
      console.error('Prepare transaction error:', error);
      setError(error.message);
      setSendState('idle');
    }
  };

  const sendPayment = async () => {
    try {
      if (!breezWallet.current || !preparedResponse) {
        throw new Error('Transaction not properly prepared');
      }

      await askMnemonic(); // verify password
      const sendRequest: SendPaymentRequest = {
        prepareResponse: preparedResponse,
      };

      // Send payment
      const paymentResponse = await breezWallet.current.sendPayment(sendRequest);
      console.log('Payment sent:', paymentResponse);
      setSendState('success');
    } catch (error: any) {
      console.error('Send payment error:', error);
      setError(error.message);
    }
  };

  const handleCancel = () => {
    setSendState('idle');
    setPreparedResponse(null);
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
            onChange={(event) => setInvoice(event.target.value)}
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

        {sendState === 'preparing' ? <span>loading...</span> : null}

        {sendState === 'prepared' && (
          <div style={{ backgroundColor: '#f5f5f5', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Payment Details</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Amount:</span>
              <strong>{amountToSend ? formatBalance(amountToSend, 8, 8) : ''} sats</strong>
            </div>
            {feeSats !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Fee:</span>
                <strong>{feeSats} sats</strong>
              </div>
            )}
          </div>
        )}

        {sendState === 'idle' && (
          <WideButton data-testid="verify-payment-button" onClick={prepareTransaction} style={{ backgroundColor: '#FF9500' }}>
            <ZapIcon />
            <ThemedText>Verify Payment</ThemedText>
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
