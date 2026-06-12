import React, { useContext, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getTokenIconColor } from '@shared/models/token-list';
import { NftInfo } from '@shared/types/token-info';

import { NftImage } from '../components/home/NftImage';
import { RadialGradientScreen } from '../components/home/RadialGradientScreen';
import { WalletToolButton } from '../components/home/WalletToolButton';
import { ThemedText } from '../components/ThemedText';

import './Home.css';
import './Nft.css';

type NftLocationState = {
  nft?: NftInfo;
};

function truncateMiddle(value: string, head = 7, tail = 5): string {
  if (!value || value.length <= head + tail + 1) {
    return value;
  }
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export default function Nft() {
  const navigate = useNavigate();
  const location = useLocation();
  const { network } = useContext(NetworkContext);
  const nft = (location.state as NftLocationState | null)?.nft;

  const title = useMemo(() => {
    if (!nft) {
      return '';
    }
    if (nft.name) {
      return nft.name;
    }
    const base = nft.collectionName || 'NFT';
    return nft.tokenId ? `${base} #${nft.tokenId}` : base;
  }, [nft]);

  const iconColor = useMemo(() => getTokenIconColor(nft?.name), [nft?.name]);

  if (!nft) {
    return (
      <RadialGradientScreen network={network} className="home-screen">
        <div className="nft-detail-screen">
          <div className="nft-detail-empty">NFT not found</div>
          <div className="wallet-tool-button-group" style={{ marginTop: 24 }}>
            <WalletToolButton block onClick={() => navigate('/home')}>
              Back
            </WalletToolButton>
          </div>
        </div>
      </RadialGradientScreen>
    );
  }

  return (
    <RadialGradientScreen network={network} className="home-screen">
      <div className="nft-detail-screen">
        <ThemedText type="headline" style={{ color: '#fff' }}>
          {title}
        </ThemedText>

        <div className="nft-detail-image-wrap" style={{ backgroundColor: iconColor }}>
          {nft.image ? <NftImage uri={nft.image} alt={title} /> : null}
        </div>

        {nft.description ? <p className="nft-detail-description">{nft.description}</p> : null}

        <div className="nft-detail-meta">
          <div className="nft-detail-row">
            <span className="nft-detail-label">Contract</span>
            <span className="nft-detail-value">{truncateMiddle(nft.contractAddress.split('.')[0] ?? nft.contractAddress)}</span>
          </div>
          <div className="nft-detail-row">
            <span className="nft-detail-label">Token ID</span>
            <span className="nft-detail-value">{truncateMiddle(nft.tokenId)}</span>
          </div>
        </div>

        <div className="wallet-tool-button-group" style={{ marginTop: 24 }}>
          <WalletToolButton block onClick={() => navigate(-1)}>
            Back
          </WalletToolButton>
        </div>
      </div>
    </RadialGradientScreen>
  );
}
