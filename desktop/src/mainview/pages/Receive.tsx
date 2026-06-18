import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import writeQR from '@paulmillr/qr';
import { AddressBubble } from '../components/home/AddressBubble';
import { WalletToolButton } from '../components/home/WalletToolButton';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { BackgroundCaller } from '../modules/background-caller';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getDecimalsByNetwork, getExplorerUrlByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { useBalance } from '@shared/hooks/useBalance';
import { StringNumber } from '@shared/types/string-number';
import BigNumber from 'bignumber.js';
import { useNavigate, useSearchParams } from 'react-router';
import { formatBalance } from '@shared/modules/string-utils';
import { RadialGradientScreen } from '../components/home/RadialGradientScreen';
import { ThemedText } from '../components/ThemedText';
import './Home.css';
import { NETWORK_SPARK, NETWORK_STACKS, Networks } from '@shared/types/networks';
import { walletCanHaveTokens } from '@shared/class/wallets/interface-can-have-tokens';

export type ReceiveTokenProps = {
  network: Networks;
};

const Receive: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [address, setAddress] = useState<string>('');
  const { network: networkFromContext } = useContext(NetworkContext);
  const networkParam = searchParams.get('network');
  const network = (networkParam ?? networkFromContext) as Networks;
  const { accountNumber } = useContext(AccountNumberContext);
  const [imgSrc, setImgSrc] = useState('');
  const [oldBalance, setOldBalance] = useState<StringNumber>('');
  const { balance } = useBalance(network, accountNumber, BackgroundCaller);
  const tokenInitialRef = useRef<Map<string, string> | null>(null);
  const tokenPollRef = useRef<NodeJS.Timeout | number | null>(null);

  const [stacksTokenReceiveInfo, setStacksTokenReceiveInfo] = useState<{
    symbol: string;
    name: string;
    decimals: number;
    amountDelta: StringNumber;
  } | null>(null);

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
    const blob = new Blob([new Uint8Array(gifBytes)], { type: 'image/gif' });
    return URL.createObjectURL(blob);
  };

  useEffect(() => {
    BackgroundCaller.getAddress(network, accountNumber).then((addressResponse) => {
      setAddress(addressResponse);
      setImgSrc(qrGifDataUrl(addressResponse));
    });
  }, [accountNumber, network]);

  // Account-based token polling: cache initial holdings and detect increases
  useEffect(() => {
    if (network !== NETWORK_STACKS && network !== NETWORK_SPARK) {
      return;
    }

    let cancelled = false;

    const start = async () => {
      const wallet = await BackgroundCaller.lazyInitWallet(network, accountNumber);
      if (cancelled) return;
      if (!walletCanHaveTokens(wallet)) return;

      await wallet.fetchTokenBalances();
      const initialMap = new Map<string, string>();
      for (const token of wallet.getTokenBalances()) {
        initialMap.set(token.id, String(token.balance ?? '0'));
      }
      tokenInitialRef.current = initialMap;

      const poll = async () => {
        const w = await BackgroundCaller.lazyInitWallet(network, accountNumber);
        if (!walletCanHaveTokens(w)) return;
        await w.fetchTokenBalances();
        const currentTokens = w.getTokenBalances();
        for (const token of currentTokens) {
          const key = token.id;
          const current = new BigNumber(String(token.balance ?? '0'));
          const initial = new BigNumber(tokenInitialRef.current?.get(key) ?? '0');
          if (current.gt(initial)) {
            const delta = current.minus(initial).toString(10);
            setStacksTokenReceiveInfo({
              symbol: token.symbol,
              name: token.name,
              decimals: token.decimals,
              amountDelta: delta,
            });
            if (tokenPollRef.current) {
              clearInterval(tokenPollRef.current as number);
            }
            return;
          }
        }
      };

      tokenPollRef.current = setInterval(poll, 2_000);
    };

    start();

    return () => {
      cancelled = true;
      if (tokenPollRef.current) {
        clearInterval(tokenPollRef.current as number);
      }
    };
  }, [accountNumber, network]);

  const wrapPage = (content: React.ReactNode) => (
    <RadialGradientScreen network={network} className="home-screen">
      <div className="home-subpage-shell">{content}</div>
    </RadialGradientScreen>
  );

  // If an account-based token was received, show dedicated success block (separate from native balance success)
  if ((network === NETWORK_STACKS || network === NETWORK_SPARK) && stacksTokenReceiveInfo) {
    return wrapPage(
      <div style={{ position: 'relative' }}>
        <ThemedText type="headline">Receive on {network.charAt(0).toUpperCase() + network.slice(1)}</ThemedText>

        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ color: '#4CAF50', fontSize: '48px', marginBottom: '20px' }}>✓</div>
          <h2 style={{ color: '#4CAF50', marginBottom: '15px' }}>
            <ThemedText type="headline">
              Received: +{formatBalance(String(stacksTokenReceiveInfo.amountDelta), stacksTokenReceiveInfo.decimals, 8)} {stacksTokenReceiveInfo.symbol}
            </ThemedText>
          </h2>
          <div style={{ color: '#666', fontSize: '14px', marginBottom: '4px' }}>{stacksTokenReceiveInfo.name}</div>
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
              <ThemedText>View on Explorer</ThemedText>
            </a>
          ) : null}
          <WalletToolButton block onClick={() => navigate('/home')}>
            Back to Wallet
          </WalletToolButton>
        </div>
      </div>
    );
  }

  if (isNewBalanceGT()) {
    return wrapPage(
      <div style={{ position: 'relative' }}>
        <ThemedText type="headline">Receive on {network.charAt(0).toUpperCase() + network.slice(1)}</ThemedText>

        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ color: '#4CAF50', fontSize: '48px', marginBottom: '20px' }}>✓</div>
          <h2 style={{ color: '#4CAF50', marginBottom: '15px' }}>
            <ThemedText type="headline">
              Received: +{isNewBalanceGT() ? formatBalance(String(isNewBalanceGT()), getDecimalsByNetwork(network), 8) : ''} {getTickerByNetwork(network)}
            </ThemedText>
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
              <ThemedText>View on Explorer</ThemedText>
            </a>
          ) : null}
          <WalletToolButton block onClick={() => navigate('/home')}>
            Back to Wallet
          </WalletToolButton>
        </div>
      </div>
    );
  }

  return wrapPage(
    <div style={{ position: 'relative' }}>
      <ThemedText type="headline">Receive on {network.charAt(0).toUpperCase() + network.slice(1)}</ThemedText>
      <div
        style={{
          color: 'gray',
          textAlign: 'center',
          width: '100%',
          marginBottom: '15px',
        }}
      >
        <ThemedText style={{ fontSize: 18 }}>Scan the QR code or copy the address below</ThemedText>
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
          <ThemedText>View on Explorer</ThemedText>
        </a>
      ) : null}

      <AddressBubble address={address} showCopyButton={true} />

      <WalletToolButton block onClick={() => navigate('/home')} data-testid="receive-back-button">
        Back to Wallet
      </WalletToolButton>
    </div>
  );
};

export default Receive;
