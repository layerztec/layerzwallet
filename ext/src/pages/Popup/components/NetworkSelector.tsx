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
      }}
    >
      {networks.map((network) => (
        <button
          key={network}
          style={{
            backgroundColor: network === selectedNetwork ? LayerzColors[theme].selectedNetworkBackground : LayerzColors[theme].surfaceBackground,
            color: network === selectedNetwork ? LayerzColors[theme].selectedNetworkText : LayerzColors[theme].networkButtonText,
            padding: '8px 12px',
            borderRadius: '16px',
            margin: '4px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
            outline: 'none',
            transition: 'background-color 0.2s, opacity 0.2s',
          }}
          onClick={() => onNetworkChange(network)}
          data-testid={network === selectedNetwork ? `selectedNetwork-${network}` : `network-${network}`}
          onMouseOver={(e) => {
            if (network !== selectedNetwork) {
              e.currentTarget.style.opacity = '0.8';
            }
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
        >
          {network.toUpperCase()}
        </button>
      ))}
    </div>
  );
};
