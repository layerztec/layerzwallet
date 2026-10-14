/**
 * Pure WalletConnect/WebRGB protocol helpers — no React, no native imports,
 * unit-testable in Node. Ported from UTEXO's reference wallet
 * (rgb-sdk-rn-sandbox utils/wallet/connection-protocol.ts) with our deep-link
 * scheme instead of the demo's.
 */

/**
 * Normalize user input (QR scan, paste, deep link) into a validated `wc:`
 * pairing URI. Throws a user-facing message on anything else — an RGB or
 * Lightning invoice pasted here must produce a clear error, not a relay
 * round-trip.
 */
export function parseWalletConnectUri(input: string): string {
  let uri = input.trim();
  if (!uri.startsWith('wc:')) {
    try {
      const link = new URL(uri);
      if (link.protocol !== 'layerzwallet:') throw new Error('Invalid wallet link');
      uri = link.searchParams.get('uri') ?? '';
    } catch {
      uri = '';
    }
  }
  if (uri.length > 16_384 || !/^wc:[a-fA-F0-9]{64}@2\?/.test(uri)) {
    throw new Error('Paste a WalletConnect connection URI (wc:…), not an RGB or Lightning invoice.');
  }
  const params = new URLSearchParams(uri.slice(uri.indexOf('?') + 1));
  if (
    params.getAll('symKey').length !== 1 ||
    params.getAll('relay-protocol').length !== 1 ||
    params.getAll('expiryTimestamp').length > 1 ||
    !/^[a-fA-F0-9]{64}$/.test(params.get('symKey') ?? '') ||
    params.get('relay-protocol') !== 'irn'
  ) {
    throw new Error('Invalid WalletConnect pairing parameters.');
  }
  const expiry = params.get('expiryTimestamp');
  if (expiry && (!/^\d+$/.test(expiry) || !Number.isSafeInteger(Number(expiry)) || Number(expiry) <= Date.now() / 1000)) {
    throw new Error('This connection QR has expired. Create a new one in the dApp.');
  }
  return uri;
}

/** Origin of a dApp URL; refuses non-http(s) and embedded credentials. */
export function sessionOrigin(url: string): string {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Invalid website URL');
  return parsed.origin;
}

export type WcSessionLike = {
  topic: string;
  expiry: number;
  sessionProperties?: Record<string, string>;
  namespaces: Record<string, { accounts: string[]; methods: string[] }>;
  peer: { metadata: { name: string; url: string; icons?: string[] } };
};

/**
 * A persisted WalletConnect session is "ours" only if it carries the WebRGB
 * profile, hasn't expired, binds OUR account and stays within the method set
 * we advertise — anything else is stale (network switched, older app
 * version with a wider surface) and must not be surfaced as active.
 */
export function isRgbSession(session: WcSessionLike, account: string, rpcMethods: readonly string[]): boolean {
  const chain = account.split(':').slice(0, 2).join(':');
  const namespace = session.namespaces.rgb ?? session.namespaces[chain];
  return (
    !!account &&
    session.sessionProperties?.webrgb === 'webrgb:1' &&
    session.expiry > Date.now() / 1000 &&
    !!namespace?.accounts.includes(account) &&
    namespace.methods.every((method) => rpcMethods.includes(method))
  );
}
