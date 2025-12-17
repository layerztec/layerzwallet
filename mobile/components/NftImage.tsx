import React, { memo, useMemo } from 'react';
import { Image, type ImageProps } from 'expo-image';

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

type ResizeMode = 'cover' | 'contain' | 'stretch' | 'center' | 'repeat';

function mapResizeModeToContentFit(resizeMode?: ResizeMode): ImageProps['contentFit'] | undefined {
  switch (resizeMode) {
    case 'contain':
      return 'contain';
    case 'stretch':
      return 'fill';
    case 'center':
    case 'repeat':
      return 'none';
    case 'cover':
    default:
      return resizeMode ? 'cover' : undefined;
  }
}

export type NftImageProps = Omit<ImageProps, 'source' | 'contentFit'> & {
  source?: ImageProps['source'];
  contentFit?: ImageProps['contentFit'];
  /**
   * Back-compat with React Native's Image `resizeMode`.
   * Prefer using `contentFit` directly.
   */
  resizeMode?: ResizeMode;
};

const NftImage = memo(({ source, resizeMode, contentFit, ...props }: NftImageProps) => {
  const resolvedSource = useMemo<ImageProps['source']>(() => {
    if (!source) return source;

    // local require(...)
    if (typeof source === 'number') return source;

    // string uri
    if (typeof source === 'string') return resolveIpfsImageUri(source);

    // ImageSourcePropType can be an array (e.g. multiple densities)
    if (Array.isArray(source)) {
      return source.map((s) => {
        if (typeof s === 'string') return resolveIpfsImageUri(s);
        if (typeof s === 'number') return s;
        if (s && typeof s === 'object' && 'uri' in s && typeof (s as { uri?: unknown }).uri === 'string') {
          const uri = (s as { uri: string }).uri;
          const rewritten = resolveIpfsImageUri(uri);
          return rewritten === uri ? s : { ...(s as Record<string, unknown>), uri: rewritten };
        }
        return s as any;
      }) as any;
    }

    if (typeof source === 'object' && 'uri' in source && typeof (source as { uri?: unknown }).uri === 'string') {
      const uri = (source as { uri: string }).uri;
      const rewritten = resolveIpfsImageUri(uri);
      return rewritten === uri ? source : { ...(source as Record<string, unknown>), uri: rewritten };
    }

    return source;
  }, [source]);

  const resolvedContentFit = contentFit ?? mapResizeModeToContentFit(resizeMode);

  return <Image {...props} source={resolvedSource} contentFit={resolvedContentFit} cachePolicy="memory-disk" />;
});

NftImage.displayName = 'NftImage';

export default NftImage;
