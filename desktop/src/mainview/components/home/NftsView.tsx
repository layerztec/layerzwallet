import React, { forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useState } from 'react';
import { useNavigate } from 'react-router';

import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useNftDiscovery } from '@shared/hooks/useNftDiscovery';
import { getTokenIconColor } from '@shared/models/token-list';
import { NftInfo } from '@shared/types/token-info';

import { LayerzStorage } from '../../class/layerz-storage';
import { BackgroundCaller } from '../../modules/background-caller';

import { NftImage } from './NftImage';
import { SectionContainer } from './SectionContainer';

import './HomeSections.css';
import './SectionContainer.css';

const MAX_PREVIEW_ITEMS = 4;

const NftPreviewItem: React.FC<{
  nft: NftInfo;
  onPress: (nft: NftInfo) => void;
  selected: boolean;
}> = ({ nft, onPress, selected }) => {
  const iconColor = getTokenIconColor(nft?.name);

  return (
    <button
      type="button"
      className={['home-nft-preview-item', selected ? 'home-nft-preview-item--selected' : ''].filter(Boolean).join(' ')}
      onClick={() => onPress(nft)}
      data-testid={`nft-preview-${nft.tokenId}`}
      aria-label={nft?.name ? `NFT ${nft.name}` : 'NFT'}
    >
      <div className="home-nft-preview-image-wrap" style={{ backgroundColor: iconColor }}>
        {nft.image ? <NftImage uri={nft.image} alt="" className="home-nft-preview-image" /> : <span className="home-nft-preview-fallback">{nft?.name?.charAt(0) || '?'}</span>}
      </div>
    </button>
  );
};

type NftsViewProps = {
  selectedNft?: string;
  onViewGalleryPress?: () => void;
};

export const NftsView = forwardRef<{ refresh: () => void }, NftsViewProps>(({ selectedNft, onViewGalleryPress }, ref) => {
  const navigate = useNavigate();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { nftList, error, mutate } = useNftDiscovery(network, accountNumber, BackgroundCaller, LayerzStorage);
  const [show, setShow] = useState(false);

  const handleViewGalleryPress = useCallback(() => {
    if (onViewGalleryPress) {
      onViewGalleryPress();
      return;
    }
    navigate('/nft-gallery');
  }, [navigate, onViewGalleryPress]);

  const handleNftPress = useCallback(
    (nft: NftInfo) => {
      navigate('/nft', { state: { nft } });
    },
    [navigate]
  );

  useEffect(() => {
    if (nftList.length > 0) {
      setShow(true);
    }
  }, [nftList.length]);

  useImperativeHandle(ref, () => ({
    refresh: () => {
      void mutate();
    },
  }));

  if (nftList.length === 0) {
    return null;
  }

  const previewNfts = nftList.slice(0, MAX_PREVIEW_ITEMS);
  const hasMoreThanPreview = nftList.length > MAX_PREVIEW_ITEMS;
  const hide = !show && !error;

  return (
    <div className={hide ? 'home-nfts-hidden' : undefined}>
      <SectionContainer title="NFTs">
        <div className="home-nfts-preview-row">
          {previewNfts.map((nft) => (
            <NftPreviewItem key={nft.tokenId} nft={nft} onPress={handleNftPress} selected={selectedNft === nft.tokenId} />
          ))}
        </div>

        {error ? <p className="home-section-error">Error: {error.message}</p> : null}

        {hasMoreThanPreview ? (
          <button type="button" className="home-nfts-view-gallery" onClick={handleViewGalleryPress} data-testid="view-gallery-button">
            View Gallery
          </button>
        ) : null}
      </SectionContainer>
    </div>
  );
});

NftsView.displayName = 'NftsView';
