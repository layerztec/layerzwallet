import React from 'react';
import { Outlet, useLocation } from 'react-router';

import Home from './Home';
import './WalletShell.css';

const MODAL_PATHS = new Set(['/action-popup-modal', '/mcp-permissions-modal', '/mcp-tunnel-url-modal']);

const FULL_SCREEN_PATHS = new Set(['/receive', '/receive-on-lightning-address', '/send', '/send-evm', '/settings', '/nft-gallery', '/nft']);

/** Keeps Home visible under transparent modal routes (mobile `transparentModal` parity). */
export const WalletShell: React.FC = () => {
  const { pathname } = useLocation();
  const isModal = MODAL_PATHS.has(pathname);
  const isFullScreen = FULL_SCREEN_PATHS.has(pathname);
  const showHome = !isFullScreen && (pathname === '/home' || pathname === '/' || isModal);

  return (
    <>
      {showHome ? <Home /> : null}
      {isModal ? (
        <div className="wallet-modal-outlet">
          <Outlet />
        </div>
      ) : isFullScreen ? (
        <Outlet />
      ) : null}
    </>
  );
};
