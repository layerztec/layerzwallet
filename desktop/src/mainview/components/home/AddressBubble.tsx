import { ClipboardCopy } from 'lucide-react';
import React, { useState } from 'react';

import { WalletToolButton } from './WalletToolButton';

import './AddressBubble.css';

export const AddressBubble: React.FC<{
  address: string;
  showCopyButton: boolean;
}> = ({ address, showCopyButton }) => {
  const [copied, setCopied] = useState(false);

  const formatAddress = (addr: string) => {
    const firstPart = addr.slice(0, 6);
    const lastPart = addr.slice(-6);
    const middlePart = addr.slice(6, -6);

    const splitIndex = Math.ceil(middlePart.length / 2);
    const middlePart1 = addr.length < 43 ? middlePart.slice(0, splitIndex) : middlePart.slice(0, 16) + '...';
    const middlePart2 = addr.length < 43 ? middlePart.slice(splitIndex) : '...' + middlePart.slice(middlePart.length - 16);

    return (
      <>
        <div className="wallet-address-bubble-line">
          <span className="wallet-address-bubble-strong wallet-address-bubble-strong--start">{firstPart}</span>
          <span>{middlePart1}</span>
        </div>
        <div className="wallet-address-bubble-line">
          <span>{middlePart2}</span>
          <span className="wallet-address-bubble-strong wallet-address-bubble-strong--end">{lastPart}</span>
        </div>
      </>
    );
  };

  const handleCopyToClipboard = () => {
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 4000);
    });
  };

  return (
    <div className="wallet-address-row" style={{ position: 'relative' }}>
      <div className="wallet-address-bubble">{formatAddress(address)}</div>
      {showCopyButton ? (
        <WalletToolButton onClick={handleCopyToClipboard} data-testid="copy-to-clipboard">
          <ClipboardCopy size={16} strokeWidth={2} />
          Copy
        </WalletToolButton>
      ) : null}

      {copied ? <div className="wallet-address-copied-tooltip">Copied!</div> : null}
    </div>
  );
};
