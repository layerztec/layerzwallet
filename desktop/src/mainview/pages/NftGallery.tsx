import React, { useContext } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useNftDiscovery } from '@shared/hooks/useNftDiscovery';
import { getTokenIconColor } from '@shared/models/token-list';
import { NftInfo } from '@shared/types/token-info';

import { LayerzStorage } from '../class/layerz-storage';
import { NftImage } from '../components/home/NftImage';
import { RadialGradientScreen } from '../components/home/RadialGradientScreen';
import { WalletToolButton } from '../components/home/WalletToolButton';
import { ThemedText } from '../components/ThemedText';
import { BackgroundCaller } from '../modules/background-caller';

import './Home.css';
import './NftGallery.css';
import '../components/home/HomeSections.css';
import '../components/home/SectionContainer.css';

export default function NftGallery() {
  const navigate = useNavigate();
  const location = useLocation();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { nftList, isLoading, error } = useNftDiscovery(network, accountNumber, BackgroundCaller, LayerzStorage);

  const openNft = (nft: NftInfo) => {
    navigate('/nft', { state: { nft, from: location.pathname } });
  };

  return (
    <RadialGradientScreen network={network} className="home-screen">
      <div className="nft-gallery-screen">
        <div className="nft-gallery-header">
          <ThemedText type="headline" style={{ color: '#fff' }}>
            NFTs
          </ThemedText>
        </div>

        {isLoading && nftList.length === 0 ? (
          <div className="nft-gallery-loading">Loading…</div>
        ) : nftList.length === 0 ? (
          <div className="nft-gallery-empty">No NFTs</div>
        ) : (
          <>
            {error ? <p className="home-section-error">Error: {error.message}</p> : null}
            <div className="nft-gallery-grid">
              {nftList.map((nft) => (
                <button key={`${nft.contractAddress}:${nft.tokenId}`} type="button" className="nft-gallery-tile" aria-label={nft.name ? `NFT ${nft.name}` : 'NFT'} onClick={() => openNft(nft)}>
                  <div className="nft-gallery-tile-inner" style={{ backgroundColor: getTokenIconColor(nft?.name) }}>
                    {nft.image ? <NftImage uri={nft.image} alt="" /> : null}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="wallet-tool-button-group" style={{ marginTop: 24 }}>
          <WalletToolButton block onClick={() => navigate('/home')}>
            Back
          </WalletToolButton>
        </div>
      </div>
    </RadialGradientScreen>
  );
}
