import { AssetBalance, PrepareSendRequest, PrepareSendResponse } from '@breeztech/breez-sdk-liquid';
import { Scan, SendIcon } from 'lucide-react';
import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { BreezWallet } from '@shared/class/wallets/breez-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { formatBalance } from '@shared/modules/string-utils';
import { NETWORK_BREEZ, NETWORK_BREEZTESTNET } from '@shared/types/networks';
import { useScanQR } from '../../hooks/ScanQrContext';
import { BackgroundCaller } from '../../modules/background-caller';
import { getBreezNetwork } from '../../modules/breeze-adapter';
import { Button, HodlButton, Input, WideButton } from './DesignSystem';

const SendLiquidBreez: React.FC = () => {
  const scanQr = useScanQR();
  const navigate = useNavigate();
  const network = useContext(NetworkContext).network as typeof NETWORK_BREEZ | typeof NETWORK_BREEZTESTNET;
  const { accountNumber } = useContext(AccountNumberContext);

  const [address, setAddress] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [selectedAsset, setSelectedAsset] = useState<AssetBalance | null>(null);
  const [assets, setAssets] = useState<AssetBalance[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [prepareResult, setPrepareResult] = useState<PrepareSendResponse | null>(null);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  const getAssetName = (asset: AssetBalance): string => {
    return asset.ticker || asset.assetId.substring(0, 8) + '...';
  };

  useEffect(() => {
    const loadAssets = async () => {
      try {
        const mnemonic = await BackgroundCaller.getSubMnemonic(accountNumber);
        const wallet = new BreezWallet(mnemonic, getBreezNetwork(network));
        const balances = await wallet.getAssetBalances();
        setAssets(balances);
        if (balances.length > 0) {
          setSelectedAsset(balances[0]);
        }
      } catch (err: any) {
        console.error('Failed to load assets:', err);
        setError('Failed to load assets: ' + err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadAssets();
  }, [accountNumber, network]);

  const handleAmountChange = (text: string) => {
    // Only allow numbers and decimal point
    if (text === '' || /^\d*\.?\d*$/.test(text)) {
      setAmount(text);
      setError('');
    }
  };

  const handleAddressChange = (text: string) => {
    setAddress(text);
    setError('');
  };

  const validateInputs = (): boolean => {
    if (!address || address.trim() === '') {
      setError('Please enter a valid Liquid address');
      return false;
    }

    if (!amount || amount === '') {
      setError('Please enter an amount');
      return false;
    }

    if (!selectedAsset) {
      setError('Please select an asset');
      return false;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      return false;
    }

    const balanceNum = selectedAsset.balanceSat;
    if (amountNum > balanceNum) {
      setError('Insufficient balance');
      return false;
    }

    return true;
  };

  const handleSend = async () => {
    if (!validateInputs() || !selectedAsset) {
      return;
    }

    setIsSending(true);
    setError('');

    try {
      const mnemonic = await BackgroundCaller.getSubMnemonic(accountNumber);
      const wallet = new BreezWallet(mnemonic, getBreezNetwork(network));

      // Prepare the send payment
      const prepareRequest: PrepareSendRequest = {
        destination: address,
        amount: {
          type: 'asset',
          assetId: selectedAsset.assetId,
          receiverAmount: parseFloat(amount),
        },
      };

      const prepareResponse = await wallet.prepareSendPayment(prepareRequest);
      setPrepareResult(prepareResponse);
      setShowConfirm(true);
    } catch (err: any) {
      console.error('Failed to prepare transaction:', err);
      setError('Failed to prepare transaction: ' + err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleConfirmSend = async () => {
    if (!prepareResult || !selectedAsset) {
      return;
    }

    setIsSending(true);
    setError('');

    try {
      const mnemonic = await BackgroundCaller.getSubMnemonic(accountNumber);
      const wallet = new BreezWallet(mnemonic, getBreezNetwork(network));
      await wallet.sendPayment({ prepareResponse: prepareResult });
      setIsSuccess(true);
    } catch (err: any) {
      console.error('Failed to send transaction:', err);
      setError('Failed to send transaction: ' + err.message);
    } finally {
      setIsSending(false);
      setShowConfirm(false);
    }
  };

  const handleScanQR = async () => {
    const scanned = await scanQr();
    if (scanned) {
      setAddress(scanned);
    }
  };

  if (isSuccess) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <div style={{ color: '#4CAF50', fontSize: '48px', marginBottom: '20px' }}>✓</div>
        <h2 style={{ color: '#4CAF50', marginBottom: '15px' }}>Sent!</h2>
        <p style={{ color: '#666', marginBottom: '20px' }}>Your {selectedAsset?.ticker} are on their way</p>
        <WideButton onClick={() => navigate('/')}>Back to Wallet</WideButton>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <div>Loading assets...</div>
      </div>
    );
  }

  if (showConfirm && prepareResult) {
    if (prepareResult.destination.type !== 'liquidAddress') {
      throw new Error('Invalid destination address');
    }

    return (
      <div>
        <h2>Confirm Transaction</h2>
        <div style={{ backgroundColor: '#f5f5f5', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Transaction Details</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span>Amount:</span>
            <strong>
              {formatBalance(prepareResult.destination.addressData.amountSat!.toString(), 8, 8)} {selectedAsset?.ticker}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span>Fee:</span>
            <strong>{formatBalance((prepareResult.feesSat || 0).toString(), 8, 8)} sats</strong>
          </div>
          <div style={{ marginTop: '8px' }}>
            <span>To Address:</span>
            <div style={{ wordBreak: 'break-all', marginTop: '4px' }}>{prepareResult.destination.addressData.address}</div>
          </div>
        </div>

        <HodlButton onHold={handleConfirmSend} style={{ backgroundColor: '#FF9500' }}>
          <SendIcon />
          Hold to send payment
        </HodlButton>

        <button
          onClick={() => setShowConfirm(false)}
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
    );
  }

  return (
    <div>
      <h2>Send Liquid</h2>
      <div style={{ textAlign: 'left' }}>
        <b>Select Asset</b>
        <div style={{ marginBottom: '10px' }}></div>
        <div style={{ display: 'flex', overflowX: 'auto', gap: '10px', paddingBottom: '10px' }}>
          {assets.map((asset) => (
            <div
              key={asset.assetId}
              onClick={() => setSelectedAsset(asset)}
              style={{
                padding: '15px',
                borderRadius: '10px',
                backgroundColor: selectedAsset?.assetId === asset.assetId ? '#3498db' : '#f0f0f0',
                minWidth: '120px',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '5px', color: selectedAsset?.assetId === asset.assetId ? 'white' : 'black' }}>{getAssetName(asset)}</div>
              {asset.name && <div style={{ fontSize: '14px', color: selectedAsset?.assetId === asset.assetId ? '#e0e0e0' : '#888', marginBottom: '5px' }}>({asset.name})</div>}
              <div style={{ fontSize: '14px', color: selectedAsset?.assetId === asset.assetId ? '#e0e0e0' : '#666' }}>
                {formatBalance(asset.balanceSat.toString(), 8, 8)} {asset.ticker}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ textAlign: 'left', marginTop: '20px' }}>
        <b>Recipient Address</b>
        <div style={{ marginBottom: '10px' }}></div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Input type="text" placeholder="Enter Liquid address" value={address} onChange={(event) => handleAddressChange(event.target.value)} style={{ flexGrow: 1, marginRight: '10px' }} />
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
            onClick={handleScanQR}
          >
            <Scan />
          </Button>
        </div>
      </div>

      <div style={{ textAlign: 'left', marginTop: '20px' }}>
        <b>Amount</b>
        <div style={{ marginBottom: '10px' }}></div>
        <Input type="text" placeholder={`Enter amount in ${selectedAsset?.ticker || ''}`} value={amount} onChange={(event) => handleAmountChange(event.target.value)} />
      </div>

      {error && (
        <div style={{ color: 'red', width: '100%', marginTop: '15px', marginBottom: '15px' }}>
          <span style={{ fontSize: 16 }}>{error}</span>
        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        <WideButton onClick={handleSend} disabled={isSending}>
          <SendIcon />
          {isSending ? 'Sending...' : 'Send'}
        </WideButton>
      </div>
    </div>
  );
};

export default SendLiquidBreez;
