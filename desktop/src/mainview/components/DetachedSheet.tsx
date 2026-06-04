import React, { useEffect, useMemo } from 'react';

import { getNetworkPrimaryColor } from '@shared/constants/Colors';
import { NETWORK_LIGHTNING, NETWORK_LIGHTNING_TESTNET, NETWORK_USDT, Networks } from '@shared/types/networks';

import './DetachedSheet.css';

type DetachedSheetProps = {
  children: React.ReactNode;
  variant: string;
  layerNetwork?: string;
  onClose: () => void;
};

/** Web port of mobile `DetachedSheet` (bottom sheet + network radial gradient). */
export const DetachedSheet: React.FC<DetachedSheetProps> = ({ children, variant, layerNetwork, onClose }) => {
  const effectiveNetwork = useMemo(() => {
    if (layerNetwork === NETWORK_LIGHTNING || layerNetwork === NETWORK_LIGHTNING_TESTNET) {
      return NETWORK_LIGHTNING;
    }
    if (layerNetwork === NETWORK_USDT) {
      return NETWORK_USDT;
    }
    if (variant === NETWORK_LIGHTNING || variant === NETWORK_LIGHTNING_TESTNET) {
      return NETWORK_LIGHTNING;
    }
    if (variant === NETWORK_USDT) {
      return NETWORK_USDT;
    }
    return variant as Networks;
  }, [variant, layerNetwork]);

  const primaryColor = getNetworkPrimaryColor(effectiveNetwork);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="detached-sheet-overlay" role="presentation" onClick={onClose}>
      <div className="detached-sheet-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="detached-sheet-bg" aria-hidden>
          <div
            className="detached-sheet-gradient"
            style={{
              backgroundImage: `radial-gradient(163% 75% at 49% -24%, ${primaryColor} 0%, #000000 70%)`,
            }}
          />
          <div className="detached-sheet-blur" />
        </div>
        <div className="detached-sheet-handle-wrap" aria-hidden>
          <div className="detached-sheet-handle" />
        </div>
        <div className="detached-sheet-content">{children}</div>
      </div>
    </div>
  );
};
