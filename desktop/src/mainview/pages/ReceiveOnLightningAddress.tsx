import writeQR from '@paulmillr/qr';
import BigNumber from 'bignumber.js';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useBalance } from '@shared/hooks/useBalance';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { capitalizeFirstLetter, formatBalance } from '@shared/modules/string-utils';
import { formatLayerzLightningAddress, LAYERZ_ME_DOMAIN, lookupLayerzLightningAddress } from '@shared/modules/layerz-lightning-address';
import { NETWORK_LIGHTNING_TESTNET, NETWORK_LIQUID, NETWORK_LIQUID_TESTNET, NETWORK_SPARK } from '@shared/types/networks';
import { StringNumber } from '@shared/types/string-number';

import { ActionPopupAction } from '../components/ActionPopupAction';
import { ActionPopupButton } from '../components/ActionPopupButton';
import { RadialGradientScreen } from '../components/home/RadialGradientScreen';
import { ThemedText } from '../components/ThemedText';
import { BackgroundCaller } from '../modules/background-caller';
import { WideButton } from './DesignSystem';
import './Home.css';
import './ReceiveOnLightningAddress.css';

const qrGifDataUrl = (text: string) => {
  const gifBytes = writeQR(text, 'gif', { scale: text.length > 43 ? 4 : 7 });
  const blob = new Blob([new Uint8Array(gifBytes)], { type: 'image/gif' });
  return URL.createObjectURL(blob);
};

/** Web port of mobile `ReceiveOnLightningAddress`. */
const ReceiveOnLightningAddress: React.FC = () => {
  const navigate = useNavigate();
  const { accountNumber } = useContext(AccountNumberContext);
  const { network: networkFromContext } = useContext(NetworkContext);
  const network = NETWORK_SPARK;
  const [lightningAddress, setLightningAddress] = useState('');
  const [sparkAddress, setSparkAddress] = useState('');
  const [resolvedUsername, setResolvedUsername] = useState('');
  const [lightningAddressParts, setLightningAddressParts] = useState<{
    local: string;
    domain: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imgSrc, setImgSrc] = useState('');
  const [oldBalance, setOldBalance] = useState<StringNumber>('');
  const [isSharing, setIsSharing] = useState(false);
  const { balance } = useBalance(network, accountNumber, BackgroundCaller);

  const isNewBalanceGT = useCallback((): false | StringNumber => {
    if (Boolean(balance && oldBalance && new BigNumber(balance).gt(oldBalance))) {
      return new BigNumber(balance ?? '0').minus(oldBalance).toString(10);
    }
    return false;
  }, [balance, oldBalance]);

  useEffect(() => {
    if (!oldBalance && balance) {
      setOldBalance(balance);
    }
  }, [balance, oldBalance]);

  const fetchAddress = useCallback(async () => {
    setIsLoading(true);
    try {
      const addressResponse = await BackgroundCaller.getAddress(network, accountNumber);
      setSparkAddress(addressResponse);
      setResolvedUsername('');
      const defaultAddr = formatLayerzLightningAddress(addressResponse);
      setLightningAddress(defaultAddr);
      const [local, domain] = defaultAddr.split('@');
      setLightningAddressParts({ local, domain });
      setImgSrc(qrGifDataUrl(defaultAddr));

      const resolved = await lookupLayerzLightningAddress(addressResponse);
      if (resolved.username) {
        setResolvedUsername(resolved.username);
        setLightningAddress(resolved.lightningAddress);
        setImgSrc(qrGifDataUrl(resolved.lightningAddress));
      }
    } catch (error) {
      console.error('Error fetching address:', error);
    } finally {
      setIsLoading(false);
    }
  }, [network, accountNumber]);

  useEffect(() => {
    void fetchAddress();
  }, [fetchAddress]);

  const refreshResolvedUsername = useCallback(async () => {
    if (!sparkAddress || resolvedUsername) return;
    try {
      const resolved = await lookupLayerzLightningAddress(sparkAddress);
      if (resolved.username) {
        setResolvedUsername(resolved.username);
        setLightningAddress(resolved.lightningAddress);
        setImgSrc(qrGifDataUrl(resolved.lightningAddress));
      }
    } catch (error) {
      console.error('Error fetching username for spark address', error);
    }
  }, [sparkAddress, resolvedUsername]);

  useEffect(() => {
    void refreshResolvedUsername();
  }, [refreshResolvedUsername]);

  const handleShare = async () => {
    if (!lightningAddress) return;
    setIsSharing(true);
    try {
      if (navigator.share) {
        await navigator.share({
          text: `My Lightning address: ${lightningAddress}`,
        });
      } else {
        await navigator.clipboard.writeText(lightningAddress);
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleReceiveOnSpark = () => {
    if (networkFromContext === NETWORK_LIGHTNING_TESTNET) {
      window.alert('Spark does not have a testnet');
      return;
    }
    navigate(`/receive?network=${NETWORK_SPARK}`);
  };

  const handleReceiveOnLiquid = () => {
    const n = networkFromContext === NETWORK_LIGHTNING_TESTNET ? NETWORK_LIQUID_TESTNET : NETWORK_LIQUID;
    navigate(`/receive?network=${n}`);
  };

  const lightningReceiveActions = [
    {
      children: <ActionPopupAction testID="ReceiveOnSparkButton" network={NETWORK_SPARK} text="Receive on Spark" />,
      onClick: handleReceiveOnSpark,
    },
    {
      children: <ActionPopupAction network={NETWORK_LIQUID} text="Receive on Liquid" />,
      onClick: handleReceiveOnLiquid,
    },
    { children: <ActionPopupAction text="Cancel" />, onClick: () => {} },
  ];

  const received = isNewBalanceGT();

  return (
    <RadialGradientScreen network={networkFromContext} className="home-screen">
      <div className="home-subpage-shell receive-lightning-shell">
        {received ? (
          <div className="receive-lightning-success">
            <div className="receive-lightning-success-icon" aria-hidden>
              ✓
            </div>
            <ThemedText type="headline" data-testid="NetworkAddressHeader">
              Received: +{formatBalance(String(received), getDecimalsByNetwork(network), getDecimalsByNetwork(network))} {getTickerByNetwork(network)}
            </ThemedText>
            <br />
            <WideButton onClick={() => navigate('/home')}>Back to Wallet</WideButton>
          </div>
        ) : (
          <>
            <ThemedText type="headline" className="receive-lightning-title">
              Receive on {capitalizeFirstLetter(networkFromContext)}
            </ThemedText>

            <div className="receive-lightning-qr-wrap">
              {!isLoading && lightningAddress ? (
                <>
                  <div className="receive-lightning-qr" data-testid="LightningAddressQrContainer">
                    {imgSrc ? <img src={imgSrc} alt="Lightning address QR code" data-testid="LightningAddressQrCode" /> : null}
                  </div>
                  <div className="receive-lightning-address" data-testid="LightningAddressButton">
                    <span>{(resolvedUsername || lightningAddressParts?.local) ?? ''}</span>
                    {(resolvedUsername || lightningAddressParts?.domain) && <span className="receive-lightning-domain">@{resolvedUsername ? LAYERZ_ME_DOMAIN : lightningAddressParts?.domain}</span>}
                  </div>
                </>
              ) : (
                <div className="receive-lightning-qr receive-lightning-qr-placeholder" data-testid="QrContainer">
                  {isLoading ? (
                    <>
                      <span data-testid="LoadingPlaceholder">Loading address...</span>
                    </>
                  ) : (
                    <span>No address available</span>
                  )}
                </div>
              )}
            </div>

            <div className="receive-lightning-actions">
              <button type="button" className="receive-lightning-btn" data-testid="ShareButton" onClick={() => void handleShare()} disabled={!lightningAddress || isSharing}>
                Share...
              </button>
              <ActionPopupButton actions={lightningReceiveActions} title="Layer to receive on">
                <button type="button" className="receive-lightning-btn" data-testid="ReceiveOnLightningAddressWithAmountButton">
                  Receive with amount
                </button>
              </ActionPopupButton>
            </div>
          </>
        )}
      </div>
    </RadialGradientScreen>
  );
};

export default ReceiveOnLightningAddress;
