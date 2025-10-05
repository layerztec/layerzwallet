import { ArrowUpDown } from 'lucide-react';
import React, { useContext } from 'react';
import { useNavigate } from 'react-router';

import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useSwaps } from '@shared/hooks/useSwaps';
import { CommonSwap } from '@shared/types/common-swap';
import { NETWORK_ARKADE, NETWORK_ARKADE_MUTINYNET, NETWORK_SPARK } from '@shared/types/networks';
import { formatBalance } from '@shared/modules/string-utils';
import { getDecimalsByNetwork } from '@shared/models/network-getters';
import { capitalizeFirstLetter } from '@shared/modules/string-utils';

import { BackgroundCaller } from '../../../modules/background-caller';
import { SwapXArkClaimParams } from '../SwapXArkClaim';
import { SwapDetailsParams } from '../SwapDetails';

interface SwapItemProps {
  swap: CommonSwap;
}

const SwapItem: React.FC<SwapItemProps> = ({ swap }) => {
  const navigate = useNavigate();
  const amount = formatBalance(swap.amount.toString(), getDecimalsByNetwork(swap.network));

  const formatSwapDate = () => {
    if (!swap.timestamp) {
      return '';
    }
    const date = new Date(swap.timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  };

  const getSwapIcon = () => {
    return swap.direction === 'send' ? '↗' : '↙';
  };

  const handleClaim = () => {
    if ((swap.network === NETWORK_SPARK || swap.network === NETWORK_ARKADE || swap.network === NETWORK_ARKADE_MUTINYNET) && swap.status === 'claimable') {
      const params: SwapXArkClaimParams = { swapJson: JSON.stringify(swap) };
      navigate('/swap-xark-claim', { state: params });
    }
  };

  const handleSwapPress = () => {
    // Navigate to SwapDetails to show full information
    const params: SwapDetailsParams = { swap };
    navigate('/swap-details', { state: params });
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 0',
        borderBottom: '1px solid #eee',
        cursor: 'pointer',
      }}
      onClick={handleSwapPress}
    >
      <div style={{ width: '24px', textAlign: 'center', fontSize: '16px' }}>{getSwapIcon()}</div>

      <div style={{ flex: 1, marginLeft: '12px' }}>
        <div style={{ fontSize: '14px', fontWeight: '500' }}>{amount}</div>
        <div style={{ fontSize: '12px', color: '#666' }}>{formatSwapDate()}</div>
        {swap.targetConfirmations && (
          <div style={{ fontSize: '12px', color: '#666' }}>
            {swap.confirmations} / {swap.targetConfirmations} confirmations
          </div>
        )}
      </div>

      <div style={{ textAlign: 'right' }}>
        {(swap.network === NETWORK_SPARK || swap.network === NETWORK_ARKADE || swap.network === NETWORK_ARKADE_MUTINYNET) && swap.status === 'claimable' ? (
          <button
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleClaim();
            }}
          >
            Claim
          </button>
        ) : (
          <div style={{ fontSize: '12px', color: '#666' }}>{capitalizeFirstLetter(swap.status)}</div>
        )}
      </div>
    </div>
  );
};

const SwapListView: React.FC = () => {
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { swaps } = useSwaps(network, accountNumber, BackgroundCaller);

  if (!swaps || swaps.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        marginBottom: '20px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        backgroundColor: '#f9f9f9',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid #eee',
          backgroundColor: '#f0f0f0',
          borderRadius: '8px 8px 0 0',
        }}
      >
        <ArrowUpDown size={16} style={{ marginRight: '8px' }} />
        <span style={{ fontSize: '14px', fontWeight: '600' }}>Swaps</span>
      </div>

      <div style={{ padding: '8px 16px' }}>
        {swaps.map((swap) => (
          <SwapItem key={swap.id} swap={swap} />
        ))}
      </div>
    </div>
  );
};

export default SwapListView;
