import assert from 'assert';
import BigNumber from 'bignumber.js';
import { Loader2 } from 'lucide-react';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { NETWORK_BITCOIN, NETWORK_SPARK } from '@shared/types/networks';
import { SparkWallet, StaticDepositQuoteOutput } from '@shared/class/wallets/spark-wallet';
import { getDecimalsByNetwork } from '@shared/models/network-getters';
import { formatBalance } from '@shared/modules/string-utils';

import { BackgroundCaller } from '../../modules/background-caller';
import { Button } from './DesignSystem';

export interface SwapSparkClaimParams {
  swapId: string;
  amountIn: string;
}

const SwapSparkClaim: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const wallet = useRef<SparkWallet | null>(null);
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [quote, setQuote] = useState<StaticDepositQuoteOutput | undefined>(undefined);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [refundSuccess, setRefundSuccess] = useState(false);

  const decimals = getDecimalsByNetwork(network);
  const disabled = isClaiming || isRefunding;
  const params = location.state as SwapSparkClaimParams;

  useEffect(() => {
    const getQuote = async () => {
      try {
        const w = await BackgroundCaller.lazyInitWallet(NETWORK_SPARK, accountNumber);
        assert(w instanceof SparkWallet);
        wallet.current = w;
        const quote = await w.getDepositQuote(params.swapId);
        setQuote(quote);
      } catch (error: any) {
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };
    getQuote();
  }, [params.swapId, accountNumber]);

  const handleClaim = async () => {
    if (!wallet.current || !quote) return;
    setIsClaiming(true);
    try {
      await wallet.current.claimDeposit(quote);
      setClaimSuccess(true);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsClaiming(false);
    }
  };

  const handleRefund = async () => {
    if (!wallet.current || !quote) return;
    setIsRefunding(true);
    try {
      // For refund, we need to get the destination address from Bitcoin wallet
      const destinationAddress = await BackgroundCaller.getAddress(NETWORK_BITCOIN, accountNumber);
      assert(destinationAddress, 'No destination address for refund');
      await wallet.current.refundDeposit(params.swapId, destinationAddress);
      setRefundSuccess(true);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsRefunding(false);
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  if (claimSuccess) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
        <div style={{ marginBottom: '20px' }}>
          <h2>Swap Claimed Successfully!</h2>
        </div>
        <div style={{ padding: '20px', backgroundColor: '#e6f7e6', borderRadius: '8px', marginBottom: '20px' }}>
          {quote && (
            <div>
              <strong>{formatBalance(quote.creditAmountSats.toString(), decimals)} BTC</strong> has been added to your Spark balance
            </div>
          )}
        </div>
        <Button onClick={handleBack}>Back to Wallet</Button>
      </div>
    );
  }

  if (refundSuccess) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
        <div style={{ marginBottom: '20px' }}>
          <h2>Swap Refunded Successfully!</h2>
        </div>
        <div style={{ padding: '20px', backgroundColor: '#e6f7e6', borderRadius: '8px', marginBottom: '20px' }}>Your Bitcoin has been sent back to your wallet</div>
        <Button onClick={handleBack}>Back to Wallet</Button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2>Spark Swap Claim</h2>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <Loader2 className="animate-spin" size={24} />
          <span style={{ marginLeft: '10px' }}>Loading swap details...</span>
        </div>
      )}

      {error && <div style={{ color: 'red', padding: '10px', backgroundColor: '#ffe6e6', borderRadius: '4px', marginBottom: '20px' }}>{error}</div>}

      {quote && !isLoading && (
        <div>
          {/* Swap Details Card */}
          <div
            style={{
              marginBottom: '24px',
              padding: '20px',
              backgroundColor: '#f8f9fa',
              borderRadius: '12px',
              border: '1px solid #e0e0e0',
            }}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>Swap Details</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingBottom: '8px',
                  borderBottom: '1px solid #e0e0e0',
                }}
              >
                <span style={{ color: '#666', fontSize: '14px' }}>Amount In:</span>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>{formatBalance(params.amountIn, decimals)} BTC</span>
              </div>

              {/* Calculate and show network fee */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingBottom: '8px',
                  borderBottom: '1px solid #e0e0e0',
                }}
              >
                <span style={{ color: '#666', fontSize: '14px' }}>Network Fee:</span>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>
                  {(() => {
                    const amountInBN = new BigNumber(params.amountIn);
                    const creditAmountBN = new BigNumber(quote.creditAmountSats.toString());
                    const networkFee = amountInBN.minus(creditAmountBN);
                    return formatBalance(networkFee.toString(), decimals);
                  })()}{' '}
                  BTC
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingBottom: '8px',
                  borderBottom: '1px solid #e0e0e0',
                }}
              >
                <span style={{ color: '#666', fontSize: '14px' }}>You will receive:</span>
                <span style={{ fontSize: '14px', fontWeight: '500', color: '#4CAF50' }}>{formatBalance(quote.creditAmountSats.toString(), decimals)} BTC</span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ color: '#666', fontSize: '14px' }}>Destination:</span>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>Spark Balance</span>
              </div>
            </div>
          </div>

          {/* Info Text */}
          <div
            style={{
              marginBottom: '24px',
              padding: '16px',
              backgroundColor: '#e3f2fd',
              borderRadius: '8px',
              border: '1px solid #bbdefb',
            }}
          >
            <div style={{ fontSize: '14px', color: '#1976d2', lineHeight: '1.4' }}>
              You can claim this swap to receive Bitcoin on your Spark balance, or refund it to get your sats back to your Bitcoin wallet.
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Button
              onClick={handleClaim}
              disabled={disabled}
              style={{
                backgroundColor: disabled ? '#ccc' : '#4CAF50',
                color: 'white',
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {isClaiming && <Loader2 className="animate-spin" size={16} />}
              {isClaiming ? 'Claiming...' : 'Claim Swap'}
            </Button>

            <Button
              onClick={handleRefund}
              disabled={disabled}
              style={{
                backgroundColor: disabled ? '#ccc' : '#f44336',
                color: 'white',
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {isRefunding && <Loader2 className="animate-spin" size={16} />}
              {isRefunding ? 'Refunding...' : 'Refund Swap'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SwapSparkClaim;
