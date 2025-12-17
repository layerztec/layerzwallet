import React, { useCallback, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router';

import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useNftDiscovery } from '@shared/hooks/useNftDiscovery';
import { getTokenIconColor } from '@shared/models/token-list';
import { NftInfo } from '@shared/types/token-info';

import NftImage from '../../components/NftImage';
import { BackgroundCaller } from '../../modules/background-caller';
import { LayerzStorage } from '../../class/layerz-storage';
import { ThemedText } from '../../components/ThemedText';
import { WideButton } from './DesignSystem';

const ITEM_GAP = 14;

function keyForNft(nft: NftInfo) {
  return `${nft.contractAddress}:${nft.tokenId}`;
}

function buildNftParam(nft: NftInfo) {
  return encodeURIComponent(JSON.stringify(nft));
}

const NftTile: React.FC<{ nft: NftInfo; onPress: (nft: NftInfo) => void }> = ({ nft, onPress }) => {
  const iconColor = getTokenIconColor(nft?.name);
  const fallbackText = nft?.name?.charAt(0) || '?';

  return (
    <button
      onClick={() => onPress(nft)}
      style={{
        border: 'none',
        padding: 0,
        background: 'transparent',
        cursor: 'pointer',
        width: '100%',
      }}
      aria-label="Open NFT"
      title="Open NFT"
    >
      <div
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          borderRadius: 18,
          overflow: 'hidden',
          backgroundColor: iconColor,
        }}
      >
        <NftImage src={nft.image} backgroundColor={iconColor} fallbackText={fallbackText} />
      </div>
    </button>
  );
};

const NftGallery: React.FC = () => {
  const navigate = useNavigate();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { nftList, isLoading, error } = useNftDiscovery(network, accountNumber, BackgroundCaller, LayerzStorage);

  const data = useMemo(() => nftList ?? [], [nftList]);

  const handleOpenNft = useCallback(
    (nft: NftInfo) => {
      navigate(`/Nft?nft=${buildNftParam(nft)}`);
    },
    [navigate]
  );

  return (
    <div style={{ position: 'relative' }}>
      <ThemedText type="headline">NFTs</ThemedText>

      {error ? (
        <div style={{ textAlign: 'center', padding: 20, color: 'red' }}>Error: {error.message}</div>
      ) : isLoading && data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 20, color: '#666' }}>Loading…</div>
      ) : data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 20, color: '#666' }}>No NFTs</div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: ITEM_GAP,
            padding: '12px 18px 18px 18px',
          }}
        >
          {data.map((nft) => (
            <NftTile key={keyForNft(nft)} nft={nft} onPress={handleOpenNft} />
          ))}
        </div>
      )}

      <WideButton onClick={() => navigate('/')} style={{ marginTop: 6 }}>
        Back to Wallet
      </WideButton>
    </div>
  );
};

export default NftGallery;
