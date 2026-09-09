import assert from 'assert';
import writeQR from '@paulmillr/qr';
import BigNumber from 'bignumber.js';
import { ArrowDownRightIcon, ClipboardCopy } from 'lucide-react';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { RgbWallet } from '@shared/class/wallets/rgb-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { formatBalance } from '@shared/modules/string-utils';
import { NETWORK_RGB, NETWORK_RGB_TESTNET } from '@shared/types/networks';
import { CachedTokenInfo } from '@shared/types/token-info';

import { BackgroundCaller } from '../../modules/background-caller';
import { ThemedText } from '../../components/ThemedText';
import { Button, Input, Select, WideButton } from './DesignSystem';

type ReceiveResult = {
  invoice: string;
  type: 'blind' | 'witness';
  expirationTimestamp: number | null;
};

const ANY_ASSET = '__any__';

const qrGifDataUrl = (text: string) => {
  const gifBytes = writeQR(text, 'gif', { scale: text.length > 43 ? 4 : 7 });
  const blob = new Blob([new Uint8Array(gifBytes)], { type: 'image/gif' });
  return URL.createObjectURL(blob);
};

const ReceiveRgbToken: React.FC = () => {
  const navigate = useNavigate();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);

  const [knownAssets, setKnownAssets] = useState<CachedTokenInfo[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>(ANY_ASSET);
  const [amountStr, setAmountStr] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReceiveResult | null>(null);
  const [qrSrc, setQrSrc] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const [received, setReceived] = useState<{ symbol: string; name: string; decimals: number; delta: string } | null>(null);
  const initialBalancesRef = useRef<Map<string, string> | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | number | null>(null);

  const isRgb = network === NETWORK_RGB || network === NETWORK_RGB_TESTNET;

  // Load asset list for the dropdown.
  useEffect(() => {
    if (!isRgb) return;
    let cancelled = false;
    (async () => {
      try {
        const wallet = await BackgroundCaller.lazyInitWallet(network, accountNumber);
        if (cancelled) return;
        if (!(wallet instanceof RgbWallet)) return;
        await wallet.fetchTokenBalances();
        if (cancelled) return;
        setKnownAssets(wallet.getTokenBalances());
      } catch (e) {
        console.warn('failed to load asset list:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [network, accountNumber, isRgb]);

  // Poll for incoming asset delta after invoice is generated.
  useEffect(() => {
    if (!result || !isRgb) return;
    let cancelled = false;
    (async () => {
      const wallet = await BackgroundCaller.lazyInitWallet(network, accountNumber);
      if (cancelled || !(wallet instanceof RgbWallet)) return;
      await wallet.fetchTokenBalances();
      if (cancelled) return;
      const initial = new Map<string, string>();
      for (const t of wallet.getTokenBalances()) initial.set(t.id, String(t.balance ?? '0'));
      initialBalancesRef.current = initial;

      const tick = async () => {
        const w = await BackgroundCaller.lazyInitWallet(network, accountNumber);
        if (cancelled || !(w instanceof RgbWallet)) return;
        await w.fetchTokenBalances();
        if (cancelled) return;
        for (const t of w.getTokenBalances()) {
          const cur = new BigNumber(String(t.balance ?? '0'));
          const ini = new BigNumber(initialBalancesRef.current?.get(t.id) ?? '0');
          if (cur.gt(ini)) {
            setReceived({ symbol: t.symbol, name: t.name, decimals: t.decimals, delta: cur.minus(ini).toString(10) });
            if (pollTimerRef.current) clearInterval(pollTimerRef.current as number);
            pollTimerRef.current = null;
            return;
          }
        }
      };
      pollTimerRef.current = setInterval(tick, 4_000);
    })();
    return () => {
      cancelled = true;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current as number);
      pollTimerRef.current = null;
    };
  }, [result, network, accountNumber, isRgb]);

  // Render QR whenever we get a new invoice.
  useEffect(() => {
    if (result?.invoice) {
      setQrSrc(qrGifDataUrl(result.invoice));
    }
  }, [result]);

  if (!isRgb) {
    return (
      <div>
        <ThemedText type="headline">Receive RGB Asset</ThemedText>
        <p style={{ color: '#ff8a8a' }}>Switch to an RGB network to receive assets.</p>
      </div>
    );
  }

  const generate = async () => {
    setError(null);
    setIsGenerating(true);
    try {
      const wallet = await BackgroundCaller.lazyInitWallet(network, accountNumber);
      assert(wallet instanceof RgbWallet, 'Wallet is not an RgbWallet');
      const n = Number(amountStr);
      if (!amountStr.trim() || !Number.isFinite(n) || n <= 0 || !Number.isSafeInteger(n)) {
        setError('Amount is required and must be a positive integer (in base units).');
        setIsGenerating(false);
        return;
      }
      const params: { assetId?: string; amount: number } = { amount: n };
      if (selectedAssetId !== ANY_ASSET) params.assetId = selectedAssetId;
      const r = await wallet.requestReceive(params);
      setResult({ invoice: r.invoice, type: r.type, expirationTimestamp: r.expirationTimestamp });
    } catch (e: any) {
      console.warn('requestReceive failed:', e);
      setError(e?.message ?? 'Failed to generate invoice');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyInvoice = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.invoice);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Success card — incoming token detected.
  if (received) {
    const display = formatBalance(received.delta, received.decimals, 8);
    return (
      <div style={{ position: 'relative' }}>
        <ThemedText type="headline">Asset Received</ThemedText>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ color: '#4CAF50', fontSize: '48px', marginBottom: '20px' }}>✓</div>
          <h2 style={{ color: '#4CAF50', marginBottom: '15px' }}>
            <ThemedText type="headline">
              +{display} {received.symbol}
            </ThemedText>
          </h2>
          <div style={{ color: '#666', fontSize: '14px', marginBottom: '15px' }}>{received.name}</div>
          <WideButton onClick={() => navigate('/')}>Back to Wallet</WideButton>
        </div>
      </div>
    );
  }

  // Generated invoice view.
  if (result) {
    return (
      <div style={{ position: 'relative' }}>
        <ThemedText type="headline">RGB Invoice</ThemedText>
        <div style={{ textAlign: 'center', marginTop: 8, marginBottom: 12 }}>
          <span
            style={{
              display: 'inline-block',
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.18)',
              color: 'white',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {result.type === 'blind' ? 'Private (blind)' : 'Witness invoice'}
          </span>
        </div>

        <div
          style={{
            width: '200px',
            height: '200px',
            backgroundColor: '#e0e0e0',
            margin: '0 auto',
            borderRadius: '10px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {qrSrc && <img src={qrSrc} alt="invoice qr" />}
        </div>

        <div
          style={{
            wordBreak: 'break-all',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 8,
            padding: 10,
            margin: '15px 0',
            fontFamily: 'monospace',
            fontSize: 11,
            color: 'white',
          }}
        >
          {result.invoice}
        </div>

        <Button onClick={copyInvoice} data-testid="ReceiveRgb.Copy" style={{ marginBottom: 10 }}>
          <ClipboardCopy /> {copied ? 'Copied!' : 'Copy invoice'}
        </Button>

        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: '18px' }}>
          {result.type === 'blind'
            ? 'Share this invoice with the sender. Their payment will land on a UTXO known only to you.'
            : 'No free allocation slot was available, so this invoice creates a fresh slot when paid. Slightly less private than a blind invoice.'}
        </p>

        <WideButton onClick={() => navigate('/')}>Done</WideButton>
      </div>
    );
  }

  // Form view.
  return (
    <div>
      <ThemedText type="headline">Receive RGB Asset</ThemedText>
      <div style={{ textAlign: 'left', marginTop: 16 }}>
        <b>Asset</b>
        <div style={{ marginBottom: 10 }}></div>
        <Select value={selectedAssetId} onChange={(e) => setSelectedAssetId(e.target.value)} data-testid="ReceiveRgb.AssetSelect">
          <option value={ANY_ASSET}>Any asset</option>
          {knownAssets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.symbol || a.name}
            </option>
          ))}
        </Select>
      </div>

      <div style={{ textAlign: 'left', marginTop: 16 }}>
        <b>Amount (base units)</b>
        <div style={{ marginBottom: 10 }}></div>
        <Input type="number" inputMode="numeric" placeholder="e.g. 100" value={amountStr} onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9]/g, ''))} data-testid="ReceiveRgb.Amount" />
      </div>

      {error ? (
        <div style={{ color: 'red', width: '100%', marginBottom: 15 }}>
          <span style={{ fontSize: 16 }}>{error}</span>
        </div>
      ) : null}

      <div style={{ marginTop: 24 }}>
        <WideButton onClick={generate} disabled={isGenerating} data-testid="ReceiveRgb.Submit">
          {isGenerating ? 'Generating…' : 'Generate Invoice'}
        </WideButton>
      </div>

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <button
          onClick={() => navigate('/receive')}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.85)',
            textDecoration: 'underline',
            cursor: 'pointer',
            fontSize: 14,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
          data-testid="ReceiveRgb.SatsLink"
        >
          <ArrowDownRightIcon size={16} /> Receive sats instead
        </button>
      </div>
    </div>
  );
};

export default ReceiveRgbToken;
