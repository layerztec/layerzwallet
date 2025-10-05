import React, { useContext, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ArrowLeftIcon, Copy, ExternalLink } from 'lucide-react';

import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useExchangeRate } from '@shared/hooks/useExchangeRate';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { capitalizeFirstLetter, formatBalance, formatFiatBalance } from '@shared/modules/string-utils';
import { CommonSwap } from '@shared/types/common-swap';
import { NETWORK_ARKADE, NETWORK_ARKADE_MUTINYNET, NETWORK_SPARK } from '@shared/types/networks';

import { Button } from './DesignSystem';
import { SwapXArkadeClaimParams } from './SwapXArkadeClaim';

export interface SwapDetailsParams {
  swap: CommonSwap;
}

const SwapDetails: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { network } = useContext(NetworkContext);
  const { swap } = location.state as SwapDetailsParams;

  const ticker = getTickerByNetwork(network);
  const decimals = getDecimalsByNetwork(network);
  const { exchangeRate } = useExchangeRate(network, 'USD');

  const [formattedDate, formattedDateWithTime] = useMemo(() => {
    if (!swap.timestamp) return ['—', '—'];
    const d = new Date(swap.timestamp);
    const dateStr = d.toLocaleDateString('en-US', {
      month: 'long',
      day: '2-digit',
      year: 'numeric',
    });
    const timeStr = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return [dateStr, `${dateStr} - ${timeStr.toLowerCase()}`];
  }, [swap.timestamp]);

  const amountPrimary = useMemo(() => {
    return formatBalance(Math.abs(swap.amount).toString(), decimals);
  }, [swap.amount, decimals]);

  const amountUsd = useMemo(() => {
    if (!exchangeRate) return '';
    return `${formatFiatBalance(Math.abs(swap.amount).toString(), decimals, exchangeRate)} USD`;
  }, [swap.amount, decimals, exchangeRate]);

  const statusText = useMemo(() => {
    switch (swap.status) {
      case 'pending':
        return 'Pending...';
      case 'confirmed':
        return 'Confirmed';
      case 'failed':
        return 'Failed';
      case 'cancelled':
        return 'Cancelled';
      case 'claimable':
        return 'Claimable';
      default:
        return capitalizeFirstLetter(swap.status);
    }
  }, [swap.status]);

  const directionText = useMemo(() => {
    if (swap.direction === 'send') return 'Swap Out';
    if (swap.direction === 'receive') return 'Swap In';
    return 'Swap';
  }, [swap.direction]);

  const handleCopy = async (text?: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const handleOpenInExplorer = () => {
    if (swap.explorerUrl) {
      window.open(swap.explorerUrl, '_blank');
    }
  };

  const handleClaim = () => {
    if ((swap.network === NETWORK_SPARK || swap.network === NETWORK_ARKADE || swap.network === NETWORK_ARKADE_MUTINYNET) && swap.status === 'claimable') {
      const params: SwapXArkadeClaimParams = { swapJson: JSON.stringify(swap) };
      navigate('/swap-xark-claim', { state: params });
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  const showClaimButton = (swap.network === NETWORK_SPARK || swap.network === NETWORK_ARKADE || swap.network === NETWORK_ARKADE_MUTINYNET) && swap.status === 'claimable';
  const showConfirmations = Boolean(swap.targetConfirmations);

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: '1px solid #eee',
        }}
      >
        <button
          onClick={handleBack}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            marginRight: '12px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ArrowLeftIcon size={20} />
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px' }}>{directionText}</h2>
          <div style={{ fontSize: '14px', color: '#666', marginTop: '2px' }}>{formattedDateWithTime}</div>
        </div>
      </div>

      {/* Amount Display */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: '32px',
          padding: '24px',
          backgroundColor: '#f8f9fa',
          borderRadius: '12px',
        }}
      >
        <div
          style={{
            fontSize: '32px',
            fontWeight: 'bold',
            marginBottom: '8px',
            color: '#333',
          }}
        >
          {amountPrimary} <span style={{ fontSize: '18px', color: '#666' }}>{ticker}</span>
        </div>
        {amountUsd && <div style={{ fontSize: '16px', color: '#666' }}>{amountUsd}</div>}
      </div>

      {/* Status Chip */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '32px',
        }}
      >
        <div
          style={{
            padding: '8px 24px',
            backgroundColor: swap.status === 'confirmed' ? '#e8f5e8' : swap.status === 'failed' ? '#ffeaea' : swap.status === 'claimable' ? '#e3f2fd' : '#f0f0f0',
            color: swap.status === 'confirmed' ? '#2e7d32' : swap.status === 'failed' ? '#d32f2f' : swap.status === 'claimable' ? '#1976d2' : '#666',
            borderRadius: '20px',
            border: '1px solid',
            borderColor: swap.status === 'confirmed' ? '#c8e6c9' : swap.status === 'failed' ? '#ffcdd2' : swap.status === 'claimable' ? '#bbdefb' : '#ddd',
            fontSize: '14px',
            fontWeight: '500',
          }}
        >
          {statusText}
        </div>
      </div>

      {/* Details List */}
      <div
        style={{
          backgroundColor: '#f8f9fa',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
        }}
      >
        <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Swap Details</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Swap ID */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: '8px',
              borderBottom: '1px solid #e0e0e0',
            }}
          >
            <span style={{ color: '#666', fontSize: '14px' }}>Swap ID</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => handleCopy(swap.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px',
                  color: '#666',
                }}
                title="Copy ID"
              >
                <Copy size={14} />
              </button>
              <span
                style={{
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  maxWidth: '200px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {swap.id}
              </span>
            </div>
          </div>

          {/* Date */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingBottom: '8px',
              borderBottom: '1px solid #e0e0e0',
            }}
          >
            <span style={{ color: '#666', fontSize: '14px' }}>Date</span>
            <span style={{ fontSize: '14px' }}>{formattedDate}</span>
          </div>

          {/* Type */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingBottom: '8px',
              borderBottom: '1px solid #e0e0e0',
            }}
          >
            <span style={{ color: '#666', fontSize: '14px' }}>Type</span>
            <span style={{ fontSize: '14px' }}>{directionText}</span>
          </div>

          {/* Network */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingBottom: '8px',
              borderBottom: '1px solid #e0e0e0',
            }}
          >
            <span style={{ color: '#666', fontSize: '14px' }}>Network</span>
            <span style={{ fontSize: '14px' }}>{capitalizeFirstLetter(swap.network)}</span>
          </div>

          {/* Status */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              ...(showConfirmations ? { paddingBottom: '8px', borderBottom: '1px solid #e0e0e0' } : {}),
            }}
          >
            <span style={{ color: '#666', fontSize: '14px' }}>Status</span>
            <span style={{ fontSize: '14px' }}>{capitalizeFirstLetter(swap.status)}</span>
          </div>

          {/* Confirmations */}
          {showConfirmations && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#666', fontSize: '14px' }}>Confirmations</span>
              <span style={{ fontSize: '14px' }}>
                {swap.confirmations} / {swap.targetConfirmations}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Claim button for claimable XArkade swaps */}
        {showClaimButton && (
          <Button
            onClick={handleClaim}
            style={{
              backgroundColor: '#4CAF50',
              color: 'white',
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: '600',
            }}
          >
            Claim Swap
          </Button>
        )}

        {/* Open in explorer */}
        {swap.explorerUrl && (
          <Button
            onClick={handleOpenInExplorer}
            style={{
              backgroundColor: '#f0f0f0',
              color: '#333',
              border: '1px solid #ddd',
              padding: '12px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <ExternalLink size={16} />
            Open in Explorer
          </Button>
        )}
      </div>
    </div>
  );
};

export default SwapDetails;
