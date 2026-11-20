import { describe, expect, it } from 'vitest';

import { isRgbSession, parseWalletConnectUri, sessionOrigin, type WcSessionLike } from '../../features/walletconnect/modules/wc-protocol';

const SYMKEY = 'a'.repeat(64);
const TOPIC = 'b'.repeat(64);
const validUri = (extra = '') => `wc:${TOPIC}@2?relay-protocol=irn&symKey=${SYMKEY}${extra}`;

describe('parseWalletConnectUri', () => {
  it('accepts a valid wc: uri', () => {
    expect(parseWalletConnectUri(validUri())).toBe(validUri());
  });

  it('trims whitespace', () => {
    expect(parseWalletConnectUri(`  ${validUri()}\n`)).toBe(validUri());
  });

  it('unwraps a layerzwallet:// deep link carrying the uri', () => {
    const link = `layerzwallet://WalletConnectSessions?uri=${encodeURIComponent(validUri())}`;
    expect(parseWalletConnectUri(link)).toBe(validUri());
  });

  it('rejects an RGB invoice with a readable message', () => {
    expect(() => parseWalletConnectUri('rgb:~/~/abc/sb:utxob:xyz?expiry=1')).toThrow(/WalletConnect connection URI/);
  });

  it('rejects a lightning invoice', () => {
    expect(() => parseWalletConnectUri('lnbc10n1p...')).toThrow(/WalletConnect connection URI/);
  });

  it('rejects wrong version', () => {
    expect(() => parseWalletConnectUri(`wc:${TOPIC}@1?relay-protocol=irn&symKey=${SYMKEY}`)).toThrow();
  });

  it('rejects duplicate symKey', () => {
    expect(() => parseWalletConnectUri(validUri(`&symKey=${SYMKEY}`))).toThrow(/pairing parameters/);
  });

  it('rejects bad relay protocol', () => {
    expect(() => parseWalletConnectUri(`wc:${TOPIC}@2?relay-protocol=waku&symKey=${SYMKEY}`)).toThrow(/pairing parameters/);
  });

  it('rejects an expired uri', () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    expect(() => parseWalletConnectUri(validUri(`&expiryTimestamp=${past}`))).toThrow(/expired/);
  });

  it('accepts a future expiry', () => {
    const future = Math.floor(Date.now() / 1000) + 300;
    expect(parseWalletConnectUri(validUri(`&expiryTimestamp=${future}`))).toContain('expiryTimestamp');
  });

  it('rejects oversized input', () => {
    expect(() => parseWalletConnectUri(validUri('&x=' + 'y'.repeat(17000)))).toThrow();
  });
});

describe('sessionOrigin', () => {
  it('returns the origin for https', () => {
    expect(sessionOrigin('https://bridge.utexo.com/path?x=1')).toBe('https://bridge.utexo.com');
  });
  it('rejects non-http protocols', () => {
    expect(() => sessionOrigin('javascript:alert(1)')).toThrow();
  });
  it('rejects embedded credentials', () => {
    expect(() => sessionOrigin('https://user:pass@evil.com')).toThrow();
  });
});

describe('isRgbSession', () => {
  const ACCOUNT = 'rgb:utexo:02abcdef';
  const METHODS = ['rgb_enable', 'rgb_getInfo', 'rgb_blindReceive'];
  const base = (over: Partial<WcSessionLike> = {}): WcSessionLike => ({
    topic: 't1',
    expiry: Date.now() / 1000 + 3600,
    sessionProperties: { webrgb: 'webrgb:1' },
    namespaces: { rgb: { accounts: [ACCOUNT], methods: ['rgb_enable', 'rgb_getInfo'] } },
    peer: { metadata: { name: 'dApp', url: 'https://d.app' } },
    ...over,
  });

  it('accepts a matching session', () => {
    expect(isRgbSession(base(), ACCOUNT, METHODS)).toBe(true);
  });
  it('rejects a session without the webrgb profile', () => {
    expect(isRgbSession(base({ sessionProperties: {} }), ACCOUNT, METHODS)).toBe(false);
  });
  it('rejects an expired session', () => {
    expect(isRgbSession(base({ expiry: Date.now() / 1000 - 10 }), ACCOUNT, METHODS)).toBe(false);
  });
  it('rejects a session bound to another account', () => {
    expect(isRgbSession(base(), 'rgb:utexo:03other', METHODS)).toBe(false);
  });
  it('rejects a session whose methods exceed our surface', () => {
    const s = base({ namespaces: { rgb: { accounts: [ACCOUNT], methods: ['rgb_enable', 'rgb_burnAsset'] } } });
    expect(isRgbSession(s, ACCOUNT, METHODS)).toBe(false);
  });
});
