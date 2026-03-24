import React, { useContext, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ArrowLeftIcon, Copy, ExternalLink } from 'lucide-react';

import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useExchangeRate } from '@shared/hooks/useExchangeRate';
import { useSelectedFiat } from '@shared/hooks/useSelectedFiat';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { formatFiatDisplay } from '@shared/modules/fiat-utils';
import { capitalizeFirstLetter, formatBalance, formatFiatBalance } from '@shared/modules/string-utils';
import { CommonSwap } from '@shared/types/common-swap';
import { NETWORK_ARK, NETWORK_ARK_MUTINYNET, NETWORK_SPARK } from '@shared/types/networks';

import { Button } from './DesignSystem';
import { SwapXArkClaimParams } from './SwapXArkClaim';

export interface SwapDetailsParams {
  swap: CommonSwap;
}

const SwapDetails: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { network } = useContext(NetworkContext);
  const { swap } = location.state as SwapDetailsParams;
  const fiat = useSelectedFiat();

  const ticker = getTickerByNetwork(network);
  const decimals = getDecimalsByNetwork(network);
  const { exchangeRate } = useExchangeRate(network);

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
    return formatFiatDisplay(formatFiatBalance(Math.abs(swap.amount).toString(), decimals, exchangeRate), fiat);
  }, [swap.amount, decimals, exchangeRate, fiat]);

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
    if ((swap.network === NETWORK_SPARK || swap.network === NETWORK_ARK || swap.network === NETWORK_ARK_MUTINYNET) && swap.status === 'claimable') {
      const params: SwapXArkClaimParams = { swapJson: JSON.stringify(swap) };
      navigate('/swap-xark-claim', { state: params });
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  const showClaimButton = (swap.network === NETWORK_SPARK || swap.network === NETWORK_ARK || swap.network === NETWORK_ARK_MUTINYNET) && swap.status === 'claimable';
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
            color: '#fbfff9',
          }}
        >
          <ArrowLeftIcon size={20} />
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px' }}>{directionText}</h2>
          <div style={{ fontSize: '14px', color: '#fbfff9', marginTop: '2px' }}>{formattedDateWithTime}</div>
        </div>
      </div>

      {/* Amount Display */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: '32px',
          padding: '24px',
          backgroundColor: '#0c1f6c',
          borderRadius: '12px',
        }}
      >
        <div
          style={{
            fontSize: '32px',
            fontWeight: 'bold',
            marginBottom: '8px',
            color: '#fbfff9',
          }}
        >
          {amountPrimary} <span style={{ fontSize: '18px', color: '#fbfff9' }}>{ticker}</span>
        </div>
        {amountUsd && <div style={{ fontSize: '16px', color: '#fbfff9' }}>{amountUsd}</div>}
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
          backgroundColor: '#0c1f6c',
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
            <span style={{ color: '#fbfff9', fontSize: '14px' }}>Swap ID</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => handleCopy(swap.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px',
                  color: '#fbfff9',
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
            <span style={{ color: '#fbfff9', fontSize: '14px' }}>Date</span>
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
            <span style={{ color: '#fbfff9', fontSize: '14px' }}>Type</span>
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
            <span style={{ color: '#fbfff9', fontSize: '14px' }}>Network</span>
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
            <span style={{ color: '#fbfff9', fontSize: '14px' }}>Status</span>
            <span style={{ fontSize: '14px' }}>{capitalizeFirstLetter(swap.status)}</span>
          </div>

          {/* Confirmations */}
          {showConfirmations && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#fbfff9', fontSize: '14px' }}>Confirmations</span>
              <span style={{ fontSize: '14px' }}>
                {swap.confirmations} / {swap.targetConfirmations}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Claim button for claimable XArk swaps */}
        {showClaimButton && (
          <Button
            onClick={handleClaim}
            style={{
              backgroundColor: '#0c1f6c',
              color: '#fbfff9',
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
              backgroundColor: '#0c1f6c',
              color: '#fbfff9',
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
