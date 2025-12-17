import React, { useEffect, useMemo, useState } from 'react';

const DEFAULT_IPFS_PROXY_BASE_URL = 'https://gamma.mypinata.cloud/ipfs/';

function joinUrl(base: string, path: string) {
  const b = base.endsWith('/') ? base : `${base}/`;
  const p = path.startsWith('/') ? path.slice(1) : path;
  return `${b}${p}`;
}

/**
 * Matches `mobile/components/NftImage.tsx` behavior.
 */
function resolveIpfsImageUri(uri: string) {
  const trimmed = uri.trim();
  const lower = trimmed.toLowerCase();

  // ipfs://<cid>/... or ipfs://ipfs/<cid>/...
  if (lower.startsWith('ipfs://')) {
    let rest = trimmed.slice('ipfs://'.length);
    if (rest.toLowerCase().startsWith('ipfs/')) rest = rest.slice('ipfs/'.length);
    return joinUrl(DEFAULT_IPFS_PROXY_BASE_URL, rest);
  }

  // https://<gateway>/ipfs/<cid>/...
  const idx = lower.indexOf('/ipfs/');
  if (idx !== -1) {
    const rest = trimmed.slice(idx + '/ipfs/'.length);
    if (!rest) return trimmed;
    return joinUrl(DEFAULT_IPFS_PROXY_BASE_URL, rest);
  }

  return trimmed;
}

export type NftImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string | null;
  fallbackText?: string;
  backgroundColor?: string;
};

/**
 * Minimal web equivalent of mobile's NftImage.
 * - Renders an <img> with object-fit cover when src is valid
 * - Falls back to a colored block with text on error / missing src
 */
const NftImage: React.FC<NftImageProps> = ({ src, fallbackText = '?', backgroundColor = 'rgba(0,0,0,0.12)', style, ...rest }) => {
  const [failed, setFailed] = useState(false);

  const resolvedSrc = useMemo(() => {
    if (!src) return src;
    return resolveIpfsImageUri(src);
  }, [src]);

  useEffect(() => {
    setFailed(false);
  }, [resolvedSrc]);

  if (!resolvedSrc || failed) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.9)',
          fontWeight: 700,
          userSelect: 'none',
          ...((style as React.CSSProperties) ?? {}),
        }}
        aria-label="NFT image fallback"
      >
        {fallbackText}
      </div>
    );
  }

  return (
    <img
      {...rest}
      src={resolvedSrc}
      onError={(e) => {
        setFailed(true);
        rest.onError?.(e);
      }}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
        ...((style as React.CSSProperties) ?? {}),
      }}
      alt={rest.alt ?? 'NFT image'}
      loading={rest.loading ?? 'lazy'}
      referrerPolicy={rest.referrerPolicy ?? 'no-referrer'}
    />
  );
};

export default NftImage;
