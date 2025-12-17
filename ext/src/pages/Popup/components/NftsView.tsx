import React, { useCallback, useContext, useEffect, useImperativeHandle, useMemo, useState, forwardRef } from 'react';
import { useNavigate } from 'react-router';

import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useNftDiscovery } from '@shared/hooks/useNftDiscovery';
import { getTokenIconColor } from '@shared/models/token-list';
import { NftInfo } from '@shared/types/token-info';

import NftImage from '../../../components/NftImage';
import { BackgroundCaller } from '../../../modules/background-caller';
import { LayerzStorage } from '../../../class/layerz-storage';
import { ThemedText } from '../../../components/ThemedText';

const MAX_PREVIEW_ITEMS = 4;

function buildNftParam(nft: NftInfo) {
  return encodeURIComponent(JSON.stringify(nft));
}

const NftPreviewItem: React.FC<{
  nft: NftInfo;
  onPress: (nft: NftInfo) => void;
  selected: boolean;
  style?: React.CSSProperties;
}> = ({ nft, onPress, selected, style }) => {
  const iconColor = getTokenIconColor(nft?.name);
  const fallbackText = nft?.name?.charAt(0) || '?';

  return (
    <button
      style={{
        border: '1px solid #e0e0e0',
        borderRadius: 8,
        padding: 6,
        background: 'white',
        cursor: 'pointer',
        opacity: selected ? 0.9 : 1,
        ...style,
      }}
      onClick={() => onPress(nft)}
      title={nft?.name ? `NFT ${nft.name}` : 'NFT'}
      aria-label={nft?.name ? `NFT ${nft.name}` : 'NFT'}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 8,
          overflow: 'hidden',
          backgroundColor: iconColor,
        }}
      >
        <NftImage src={nft.image} backgroundColor={iconColor} fallbackText={fallbackText} />
      </div>
    </button>
  );
};

const NftsView = forwardRef<{ refresh: () => void }, { selectedNft?: string; onViewGalleryPress?: () => void }>(({ selectedNft, onViewGalleryPress }, ref) => {
  const navigate = useNavigate();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { nftList, error, mutate } = useNftDiscovery(network, accountNumber, BackgroundCaller, LayerzStorage);
  const [show, setShow] = useState(false);

  const data = useMemo(() => nftList ?? [], [nftList]);

  const handleViewGalleryPress = useCallback(() => {
    if (onViewGalleryPress) return onViewGalleryPress();
    navigate('/NftGallery');
  }, [navigate, onViewGalleryPress]);

  const handleNftPress = useCallback(
    (nft: NftInfo) => {
      navigate(`/Nft?nft=${buildNftParam(nft)}`);
    },
    [navigate]
  );

  useEffect(() => {
    if (data.length > 0) setShow(true);
  }, [data.length]);

  useImperativeHandle(ref, () => ({
    refresh: () => {
      mutate();
    },
  }));

  if (error) {
    return (
      <div style={{ padding: 10, marginTop: 10 }}>
        <h2 style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }}>NFTs</h2>
        <div style={{ textAlign: 'center', padding: 20, color: 'red' }}>Error: {error.message}</div>
      </div>
    );
  }

  if (data.length === 0) {
    return null;
  }

  const previewNfts = data.slice(0, MAX_PREVIEW_ITEMS);
  const hasMoreThanPreview = data.length > MAX_PREVIEW_ITEMS;

  return (
    <div
      style={{
        padding: 10,
        marginTop: 10,
        display: !show ? 'none' : 'block',
      }}
    >
      <h2 style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }}>NFTs</h2>

      <div
        style={{
          padding: 12,
          border: '1px solid #e0e0e0',
          borderRadius: 8,
          margin: '4px 8px',
          background: 'white',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 20,
          flexWrap: 'wrap',
        }}
      >
        {previewNfts.map((nft) => (
          <NftPreviewItem key={`${nft.contractAddress}:${nft.tokenId}`} nft={nft} onPress={handleNftPress} selected={selectedNft === nft.tokenId} />
        ))}
      </div>

      {hasMoreThanPreview ? (
        <button
          style={{
            margin: '4px 8px',
            width: 'calc(100% - 16px)',
            backgroundColor: 'white',
            border: '1px solid #e0e0e0',
            borderRadius: 8,
            padding: 12,
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'center',
          }}
          onClick={handleViewGalleryPress}
        >
          <ThemedText style={{ fontSize: 14, fontWeight: 700, color: '#666' }}>View Gallery</ThemedText>
        </button>
      ) : null}
    </div>
  );
});

NftsView.displayName = 'NftsView';

export default NftsView;
