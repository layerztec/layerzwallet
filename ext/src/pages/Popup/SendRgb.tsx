import assert from 'assert';
import BigNumber from 'bignumber.js';
import { Scan, SendIcon } from 'lucide-react';
import React, { useContext, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { RgbWallet } from '@shared/class/wallets/rgb-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { formatBalance } from '@shared/modules/string-utils';
import { NETWORK_RGB, NETWORK_RGB_TESTNET } from '@shared/types/networks';
import { CachedTokenInfo } from '@shared/types/token-info';

import { AskMnemonicContext } from '../../hooks/AskMnemonicContext';
import { useScanQR } from '../../hooks/ScanQrContext';
import { BackgroundCaller } from '../../modules/background-caller';
import { Button, HodlButton, Input, WideButton } from './DesignSystem';

enum Step {
  Init,
  Loading,
  Prepared,
  Sending,
  Sent,
}

type DecodedInvoiceState = {
  isInvoice: true;
  token: CachedTokenInfo;
  amountBase: bigint; // amount in base units; carried by the invoice
};

type DecodedTaprootState = {
  isInvoice: false;
  amountSats: number;
};

const SendRgb: React.FC = () => {
  const scanQr = useScanQR();
  const navigate = useNavigate();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { askMnemonic } = useContext(AskMnemonicContext);

  const [recipient, setRecipient] = useState<string>('');
  const [amountStr, setAmountStr] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [step, setStep] = useState<Step>(Step.Init);
  const [txid, setTxid] = useState<string>('');
  const [vanillaSatBalance, setVanillaSatBalance] = useState<number | null>(null);
  const decoded = useRef<DecodedInvoiceState | DecodedTaprootState | null>(null);
  const walletRef = useRef<RgbWallet | null>(null);

  const isRgb = network === NETWORK_RGB || network === NETWORK_RGB_TESTNET;

  if (!isRgb) {
    return (
      <div>
        <h2>Send</h2>
        <p style={{ color: '#ff8a8a' }}>Switch to an RGB network to send RGB assets or tBTC.</p>
      </div>
    );
  }

  const looksLikeInvoice = (s: string) => s.startsWith('rgb:') || s.startsWith('utxob:');

  const prepare = async () => {
    setError('');
    setStep(Step.Loading);
    try {
      const trimmed = recipient.trim();
      assert(trimmed, 'Recipient is required');
      assert(RgbWallet.isAddressValid(trimmed), 'Invalid address or invoice');

      const wallet = await BackgroundCaller.lazyInitWallet(network, accountNumber);
      assert(wallet instanceof RgbWallet, 'Wallet is not an RgbWallet');
      walletRef.current = wallet;

      if (looksLikeInvoice(trimmed)) {
        const d = await wallet.decodeInvoice(trimmed);
        assert(d, 'Could not decode invoice');
        await wallet.fetchTokenBalances();
        const tokens = wallet.getTokenBalances();
        const matched = d.assetId ? tokens.find((t) => t.id === d.assetId) : undefined;
        assert(matched, d.assetId ? `Asset ${d.assetId} not in your wallet` : 'Invoice has no asset id');

        // The invoice must carry an amount; otherwise we can't send a token
        // without prompting the user for one. Mobile takes the same shortcut.
        assert(typeof d.amount === 'number' && d.amount > 0, 'Invoice has no amount; cannot send.');

        decoded.current = {
          isInvoice: true,
          token: matched,
          amountBase: BigInt(d.amount),
        };
      } else {
        // Taproot tBTC send — require an amount field from the user.
        const n = Number(amountStr);
        assert(!isNaN(n) && n > 0, 'Amount must be a positive number');
        const sats = new BigNumber(amountStr).multipliedBy(new BigNumber(10).pow(8)).toNumber();
        assert(Number.isInteger(sats) && sats > 0, 'Amount must be a positive integer in sats');

        const balance = await wallet.getOffchainBalance();
        setVanillaSatBalance(balance);
        assert(sats <= balance, `Not enough vanilla sats (have ${balance})`);

        decoded.current = { isInvoice: false, amountSats: sats };
      }

      await askMnemonic();
      setStep(Step.Prepared);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to prepare transaction');
      setStep(Step.Init);
    }
  };

  const broadcast = async () => {
    setStep(Step.Sending);
    setError('');
    try {
      const wallet = walletRef.current;
      const d = decoded.current;
      assert(wallet, 'Internal error: wallet missing');
      assert(d, 'Internal error: nothing prepared');

      let id: string;
      if (d.isInvoice) {
        id = await wallet.transferToken(d.token.id, d.amountBase, recipient.trim());
      } else {
        id = await wallet.pay(recipient.trim(), d.amountSats);
      }
      assert(id, 'Transaction failed');
      setTxid(id);
      setStep(Step.Sent);
    } catch (e: any) {
      setError(e?.message ?? 'Send failed');
      setStep(Step.Prepared);
    }
  };

  if (step === Step.Sent) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <div style={{ color: '#4CAF50', fontSize: 48, marginBottom: 20 }}>✓</div>
        <h2 style={{ color: '#4CAF50', marginBottom: 15 }}>Sent!</h2>
        <p style={{ color: '#ccc', marginBottom: 6 }}>Your transaction is on its way.</p>
        {txid ? <p style={{ color: '#888', fontSize: 12, wordBreak: 'break-all', marginBottom: 18 }}>txid: {txid}</p> : null}
        <WideButton onClick={() => navigate('/')}>Back to Wallet</WideButton>
      </div>
    );
  }

  const isInvoiceMode = looksLikeInvoice(recipient.trim());

  return (
    <div>
      <h2>Send {isInvoiceMode ? 'RGB asset' : 'tBTC'}</h2>

      {step !== Step.Prepared ? (
        <>
          <div style={{ textAlign: 'left' }}>
            <b>Recipient address or invoice</b>
            <div style={{ marginBottom: 10 }}></div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Input data-testid="SendRgb.Recipient" type="text" placeholder="rgb:… or tb1p…" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
              <Button
                style={{
                  marginBottom: '10px',
                  marginLeft: '5px',
                  border: '1px solid #282c34',
                  borderRadius: '5px',
                  width: '50px',
                  height: '40px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'white',
                  color: 'black',
                  cursor: 'pointer',
                  paddingLeft: '25px',
                }}
                onClick={async () => {
                  const scanned = await scanQr();
                  if (scanned) setRecipient(scanned);
                }}
              >
                <Scan />
              </Button>
            </div>
          </div>

          {!isInvoiceMode && recipient.trim().length > 0 ? (
            <div style={{ textAlign: 'left' }}>
              <b>Amount (tBTC)</b>
              <div style={{ marginBottom: 10 }}></div>
              <Input type="text" inputMode="decimal" placeholder="0.0001" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} data-testid="SendRgb.Amount" />
              {vanillaSatBalance !== null ? <div style={{ color: 'gray', marginBottom: 15 }}>Available: {formatBalance(String(vanillaSatBalance), 8, 8)} tBTC</div> : null}
            </div>
          ) : null}
        </>
      ) : null}

      {error ? (
        <div style={{ color: 'red', width: '100%', marginBottom: 15 }}>
          <span style={{ fontSize: 16 }}>{error}</span>
        </div>
      ) : null}

      {step === Step.Loading ? <span>Preparing…</span> : null}
      {step === Step.Sending ? <span>Sending…</span> : null}

      {step === Step.Init ? (
        <WideButton onClick={prepare} data-testid="SendRgb.Continue" disabled={!recipient.trim()}>
          <SendIcon /> Continue
        </WideButton>
      ) : null}

      {step === Step.Prepared && decoded.current ? (
        <div>
          <div
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 8,
              padding: 12,
              margin: '10px 0',
              color: 'white',
              fontSize: 14,
            }}
          >
            {decoded.current.isInvoice ? (
              <div>
                <div style={{ marginBottom: 4 }}>
                  <b>Asset:</b> {decoded.current.token.symbol || decoded.current.token.name}
                </div>
                <div style={{ marginBottom: 4 }}>
                  <b>Amount:</b> {formatBalance(decoded.current.amountBase.toString(), decoded.current.token.decimals, 8)} {decoded.current.token.symbol}
                </div>
                <div style={{ wordBreak: 'break-all', fontSize: 11, color: '#ccc' }}>
                  <b>To:</b> {recipient.trim()}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: 4 }}>
                  <b>Amount:</b> {amountStr} tBTC ({decoded.current.amountSats} sats)
                </div>
                <div style={{ wordBreak: 'break-all', fontSize: 11, color: '#ccc' }}>
                  <b>To:</b> {recipient.trim()}
                </div>
              </div>
            )}
          </div>

          <HodlButton onHold={broadcast} data-testid="SendRgb.Confirm">
            <SendIcon /> Hold to confirm send
          </HodlButton>

          <button
            onClick={() => {
              setStep(Step.Init);
              setError('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'gray',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: 16,
              marginTop: 10,
            }}
          >
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default SendRgb;
