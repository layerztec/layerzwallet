import React from 'react';
import { getAvailableNetworks, Networks } from '@shared/types/networks';
import { getCurrentTheme, LayerzColors } from '../theme';

interface NetworkSelectorProps {
  selectedNetwork: Networks;
  onNetworkChange: (network: Networks) => void;
  filterLiquid?: boolean;
}

export const NetworkSelector: React.FC<NetworkSelectorProps> = ({ selectedNetwork, onNetworkChange, filterLiquid = true }) => {
  const theme = getCurrentTheme();
  const networks = getAvailableNetworks().filter((n) => !filterLiquid || !n.includes('liquid'));

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        padding: '10px',
        gap: '8px',
        borderRadius: '12px',
        marginBottom: '16px',
        background: LayerzColors[theme].surfaceBackground,
      }}
    >
      {networks.map((network) => (
        <button
          key={network}
          style={{
            backgroundColor: network === selectedNetwork ? LayerzColors[theme].selectedNetworkBackground : LayerzColors[theme].surfaceBackground,
            color: network === selectedNetwork ? LayerzColors[theme].selectedNetworkText : LayerzColors[theme].networkButtonText,
            padding: '8px 16px',
            borderRadius: '16px',
            margin: '4px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            outline: 'none',
            boxShadow: network === selectedNetwork ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
            opacity: 1,
            transition: 'background 0.2s, color 0.2s, opacity 0.2s',
            minWidth: 60,
            letterSpacing: 0.5,
          }}
          onClick={() => onNetworkChange(network)}
          data-testid={network === selectedNetwork ? `selectedNetwork-${network}` : `network-${network}`}
          onMouseDown={(e) => (e.currentTarget.style.opacity = '0.7')}
          onMouseUp={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          {network.toUpperCase()}
        </button>
      ))}
    </div>
  );
};
