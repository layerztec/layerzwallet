import React, { memo, useMemo } from 'react';
import { Image, type ImageProps, type ImageSourcePropType } from 'react-native';

const DEFAULT_IPFS_PROXY_BASE_URL = 'https://gamma.mypinata.cloud/ipfs/';

function joinUrl(base: string, path: string) {
  const b = base.endsWith('/') ? base : `${base}/`;
  const p = path.startsWith('/') ? path.slice(1) : path;
  return `${b}${p}`;
}

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

export type NftImageProps = ImageProps;

const NftImage = memo(({ source, ...props }: NftImageProps) => {
  const resolvedSource = useMemo<ImageSourcePropType | undefined>(() => {
    if (!source) return source;

    // local require(...)
    if (typeof source === 'number') return source;

    // ImageSourcePropType can be an array (e.g. multiple densities)
    if (Array.isArray(source)) {
      return source.map((s) => {
        if (s && typeof s === 'object' && 'uri' in s && typeof s.uri === 'string') {
          const rewritten = resolveIpfsImageUri(s.uri);
          return rewritten === s.uri ? s : { ...s, uri: rewritten };
        }
        return s;
      });
    }

    if (typeof source === 'object' && 'uri' in source && typeof source.uri === 'string') {
      const rewritten = resolveIpfsImageUri(source.uri);
      return rewritten === source.uri ? source : { ...source, uri: rewritten };
    }

    return source;
  }, [source]);

  return <Image {...props} source={resolvedSource} />;
});

NftImage.displayName = 'NftImage';

export default NftImage;
