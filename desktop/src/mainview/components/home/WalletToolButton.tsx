import React from 'react';

import './WalletToolButton.css';

type WalletToolButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  block?: boolean;
};

/** Same look as MCP dashboard "Add funds" tool button. */
export const WalletToolButton: React.FC<WalletToolButtonProps> = ({ block, className, children, ...props }) => (
  <button type="button" className={['wallet-tool-button', block ? 'wallet-tool-button--block' : '', className].filter(Boolean).join(' ')} {...props}>
    {children}
  </button>
);
