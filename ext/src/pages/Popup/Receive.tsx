import React, { useCallback, useContext, useEffect, useState } from 'react';
import writeQR from '@paulmillr/qr';
import { AddressBubble, WideButton } from './DesignSystem';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { BackgroundCaller } from '../../modules/background-caller';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getDecimalsByNetwork, getExplorerUrlByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { useBalance } from '@shared/hooks/useBalance';
import { StringNumber } from '@shared/types/string-number';
import BigNumber from 'bignumber.js';
import { useNavigate } from 'react-router';
import { formatBalance } from '@shared/modules/string-utils';

const Receive: React.FC = () => {
  const navigate = useNavigate();
  const [address, setAddress] = useState<string>('');
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const [imgSrc, setImgSrc] = useState('');
  const [oldBalance, setOldBalance] = useState<StringNumber>('');
  const { balance } = useBalance(network, accountNumber, BackgroundCaller);

  /**
   * returns false if new balance is NOT greater than old one, otherwise it returns the precise difference between
   * balances
   */
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

  useEffect(() => {
    BackgroundCaller.getAddress(network, accountNumber).then((addressResponse) => {
      setAddress(addressResponse);
      setImgSrc(qrGifDataUrl(addressResponse));
    });
  }, [accountNumber, network]);

  if (isNewBalanceGT()) {
    return (
      <div style={{ position: 'relative' }}>
        <h2>Receive on {network.charAt(0).toUpperCase() + network.slice(1)}</h2>

        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ color: '#4CAF50', fontSize: '48px', marginBottom: '20px' }}>✓</div>
          <h2 style={{ color: '#4CAF50', marginBottom: '15px' }}>
            Received: +{isNewBalanceGT() ? formatBalance(String(isNewBalanceGT()), getDecimalsByNetwork(network), 8) : ''} {getTickerByNetwork(network)}
          </h2>
          {getExplorerUrlByNetwork(network) ? (
            <a
              href={`${getExplorerUrlByNetwork(network)}/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#808080',
                fontSize: '0.7em',
                textDecoration: 'none',
                display: 'block',
                textAlign: 'center',
                margin: '15px 0',
                padding: '8px',
                borderRadius: '5px',
                transition: 'background-color 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              View on Explorer
            </a>
          ) : null}
          <WideButton onClick={() => navigate('/')}>Back to Wallet</WideButton>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <h2>Receive on {network.charAt(0).toUpperCase() + network.slice(1)}</h2>
      <div
        style={{
          color: 'gray',
          textAlign: 'center',
          width: '100%',
          marginBottom: '15px',
        }}
      >
        <span style={{ fontSize: 18 }}>Scan the QR code or copy the address below</span>
      </div>
      <div
        style={{
          width: '200px',
          height: '200px',
          backgroundColor: '#e0e0e0',
          margin: '0 auto',
          borderRadius: '10px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {imgSrc && <img id="encResultQr" src={imgSrc} alt="encoded qr" />}
      </div>

      {getExplorerUrlByNetwork(network) ? (
        <a
          href={`${getExplorerUrlByNetwork(network)}/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#808080',
            fontSize: '0.7em',
            textDecoration: 'none',
            display: 'block',
            textAlign: 'center',
            margin: '15px 0',
            padding: '8px',
            borderRadius: '5px',
            transition: 'background-color 0.2s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          View on Explorer
        </a>
      ) : null}

      <AddressBubble address={address} showCopyButton={true} />

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

export default Receive;
