const DEFAULT_IPFS_PROXY_BASE_URL = 'https://gamma.mypinata.cloud/ipfs/';

function joinUrl(base: string, path: string) {
  const b = base.endsWith('/') ? base : `${base}/`;
  const p = path.startsWith('/') ? path.slice(1) : path;
  return `${b}${p}`;
}

export function resolveNftImageUri(uri: string): string {
  const trimmed = uri.trim();
  const lower = trimmed.toLowerCase();

  if (lower.startsWith('ipfs://')) {
    let rest = trimmed.slice('ipfs://'.length);
    if (rest.toLowerCase().startsWith('ipfs/')) rest = rest.slice('ipfs/'.length);
    return joinUrl(DEFAULT_IPFS_PROXY_BASE_URL, rest);
  }

  const idx = lower.indexOf('/ipfs/');
  if (idx !== -1) {
    const rest = trimmed.slice(idx + '/ipfs/'.length);
    if (!rest) return trimmed;
    return joinUrl(DEFAULT_IPFS_PROXY_BASE_URL, rest);
  }

  return trimmed;
}
