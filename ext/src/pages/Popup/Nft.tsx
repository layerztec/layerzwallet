import React, { useContext, useMemo, useState } from 'react';
import { ExternalLink, Copy } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';

import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getTokenIconColor } from '@shared/models/token-list';
import { NftInfo } from '@shared/types/token-info';

import NftImage from '../../components/NftImage';
import { ThemedText } from '../../components/ThemedText';
import { WideButton } from './DesignSystem';

function truncateMiddle(value: string, head = 6, tail = 4) {
  if (!value) return value;
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function parseNftParam(nftParam: string | null): NftInfo | null {
  if (!nftParam) return null;
  try {
    return JSON.parse(decodeURIComponent(nftParam)) as NftInfo;
  } catch (_) {
    return null;
  }
}

function buildExplorerUrl(nft: NftInfo): string {
  // Matches mobile behavior for stacks NFTs
  return `https://gamma.io/collections/${nft.contractAddress}/${nft.tokenId}`;
}

const Nft: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { network } = useContext(NetworkContext);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const nft = useMemo(() => parseNftParam(params.get('nft')), [params]);

  const title = useMemo(() => {
    if (!nft) return '';
    if (nft.name) return nft.name;
    const base = nft.collectionName || 'NFT';
    return nft.tokenId ? `${base}-#${nft.tokenId}` : base;
  }, [nft]);

  const description = useMemo(() => (nft as NftInfo | null)?.description ?? '', [nft]);
  const iconColor = useMemo(() => getTokenIconColor(nft?.name), [nft?.name]);

  const handleCopy = async (text?: string, key?: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopiedKey(key ?? text);
    setTimeout(() => setCopiedKey(null), 1200);
  };

  const handleOpenInExplorer = () => {
    if (!nft) return;
    const url = buildExplorerUrl(nft);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (!nft) {
    return (
      <div style={{ position: 'relative' }}>
        <ThemedText type="headline">NFT</ThemedText>
        <div style={{ textAlign: 'center', padding: 20, color: '#666' }}>NFT not found</div>
        <WideButton onClick={() => navigate('/')} style={{ marginTop: 6 }}>
          Back to Wallet
        </WideButton>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <ThemedText type="headline">NFT</ThemedText>

      <div style={{ padding: '12px 18px 0 18px' }}>
        <div
          style={{
            width: 'min(100%, 240px)',
            margin: '0 auto',
            borderRadius: 18,
            overflow: 'hidden',
            backgroundColor: iconColor,
            aspectRatio: '1 / 1',
          }}
        >
          <NftImage src={nft.image} backgroundColor={iconColor} fallbackText={nft?.name?.charAt(0) || '?'} />
        </div>

        <div style={{ marginTop: 12 }}>
          <ThemedText style={{ fontSize: 18, fontWeight: 800, color: '#222' }}>{title}</ThemedText>
        </div>

        {description ? (
          <div style={{ marginTop: 10 }}>
            <ThemedText style={{ fontSize: 13, lineHeight: '18px', color: 'rgba(0,0,0,0.7)' }}>{description}</ThemedText>
          </div>
        ) : null}

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <ThemedText style={{ fontSize: 12, color: 'rgba(0,0,0,0.55)' }}>Contract</ThemedText>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: '70%' }}>
              <button
                onClick={() => handleCopy(nft.contractAddress, 'contract')}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                aria-label="Copy contract address"
                title="Copy contract address"
              >
                <Copy size={16} color={copiedKey === 'contract' ? '#4BB543' : 'rgba(0,0,0,0.65)'} />
              </button>
              <ThemedText style={{ fontSize: 14, fontWeight: 700, color: 'rgba(0,0,0,0.9)' }}>{truncateMiddle(nft.contractAddress.split('.')[0], 5, 4)}</ThemedText>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <ThemedText style={{ fontSize: 12, color: 'rgba(0,0,0,0.55)' }}>Token ID</ThemedText>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: '70%' }}>
              <button
                onClick={() => handleCopy(nft.tokenId, 'tokenId')}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                aria-label="Copy token id"
                title="Copy token id"
              >
                <Copy size={16} color={copiedKey === 'tokenId' ? '#4BB543' : 'rgba(0,0,0,0.65)'} />
              </button>
              <ThemedText style={{ fontSize: 14, fontWeight: 700, color: 'rgba(0,0,0,0.9)' }}>{nft.tokenId}</ThemedText>
            </div>
          </div>
        </div>

        <div style={{ height: 14 }} />
      </div>

      <WideButton
        onClick={handleOpenInExplorer}
        style={{
          marginTop: 12,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderColor: 'rgba(0,0,0,0.8)',
          display: 'flex',
          gap: 8,
          justifyContent: 'center',
        }}
      >
        <ExternalLink size={18} />
        View on explorer
      </WideButton>

      <div style={{ height: 10 }} />
      <WideButton onClick={() => navigate('/')} style={{ backgroundColor: 'white', color: '#222', borderColor: '#ddd' }}>
        Back to Wallet
      </WideButton>

      {/* keeps parity with mobile even if unused in web for now */}
      <div style={{ display: 'none' }}>{network}</div>
    </div>
  );
};

export default Nft;
