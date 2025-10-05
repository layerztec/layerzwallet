import assert from 'assert';
import BigNumber from 'bignumber.js';
import { Loader2 } from 'lucide-react';
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NETWORK_BITCOIN, NETWORK_SPARK } from '@shared/types/networks';
import { SparkWallet, StaticDepositQuoteOutput } from '@shared/class/wallets/spark-wallet';
import { getDecimalsByNetwork } from '@shared/models/network-getters';
import { formatBalance } from '@shared/modules/string-utils';
import { CommonSwap } from '@shared/types/common-swap';
import { ArkadeWallet } from '@shared/class/wallets/arkade-wallet';

import { BackgroundCaller } from '../../modules/background-caller';
import { Button } from './DesignSystem';

export type SwapXArkadeClaimParams = {
  swapJson: string;
};

// for BTC -> Spark swap we can get a quote.
// but for BTC -> Arkade we can not, so we just show the confirmation.

const SwapXArkadeClaim: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const wallet = useRef<SparkWallet | ArkadeWallet>(null);
  const { accountNumber } = useContext(AccountNumberContext);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [quote, setQuote] = useState<StaticDepositQuoteOutput | undefined>(undefined);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [refundSuccess, setRefundSuccess] = useState(false);

  const params = location.state as SwapXArkadeClaimParams;
  const swap = useMemo(() => JSON.parse(params.swapJson) as CommonSwap, [params.swapJson]);
  const decimals = getDecimalsByNetwork(NETWORK_SPARK);
  const disabled = isClaiming || isRefunding;

  useEffect(() => {
    const getQuote = async () => {
      try {
        const w = await BackgroundCaller.lazyInitWallet(swap.network as any, accountNumber);
        assert(w instanceof SparkWallet || w instanceof ArkadeWallet, 'Not a XArkade wallet');
        wallet.current = w;
        if (w instanceof SparkWallet) {
          const quote = await w.getDepositQuote(swap.id);
          setQuote(quote);
        }
        // For Arkade wallets, we don't get quotes, just proceed with the swap data
      } catch (error: any) {
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };
    getQuote();
  }, [swap.id, swap.network, accountNumber]);

  const handleClaim = async () => {
    if (!wallet.current) return;
    setIsClaiming(true);
    try {
      if (wallet.current instanceof SparkWallet) {
        if (!quote) return;
        await wallet.current.claimDepositSpark(quote);
      } else if (wallet.current instanceof ArkadeWallet) {
        await wallet.current.claimDepositArk(swap.id);
      }
      setClaimSuccess(true);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsClaiming(false);
    }
  };

  const handleRefund = async () => {
    if (!wallet.current) return;
    setIsRefunding(true);
    try {
      // For refund, we need to get the destination address from Bitcoin wallet
      const destinationAddress = await BackgroundCaller.getAddress(NETWORK_BITCOIN, accountNumber);
      assert(destinationAddress, 'No destination address for refund');
      if (wallet.current instanceof SparkWallet) {
        await wallet.current.refundDeposit(swap.id, destinationAddress);
      } else if (wallet.current instanceof ArkadeWallet) {
        throw new Error('Refund not supported for Ark');
      }
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
          {quote && wallet.current instanceof SparkWallet && (
            <div>
              <strong>{formatBalance(quote.creditAmountSats.toString(), decimals)} BTC</strong> has been added to your {swap.network === NETWORK_SPARK ? 'Spark' : 'Arkade'} balance
            </div>
          )}
          {wallet.current instanceof ArkadeWallet && (
            <div>
              <strong>{formatBalance(swap.amount.toString(), getDecimalsByNetwork(swap.network))} BTC</strong> has been added to your Arkadeade balance
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
        <h2>{swap.network === NETWORK_SPARK ? 'Spark' : 'Arkade'} Swap Claim</h2>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <Loader2 className="animate-spin" size={24} />
          <span style={{ marginLeft: '10px' }}>Loading swap details...</span>
        </div>
      )}

      {error && <div style={{ color: 'red', padding: '10px', backgroundColor: '#ffe6e6', borderRadius: '4px', marginBottom: '20px' }}>{error}</div>}

      {!isLoading && (
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
                <span style={{ fontSize: '14px', fontWeight: '500' }}>{formatBalance(swap.amount.toString(), getDecimalsByNetwork(swap.network))} BTC</span>
              </div>

              {/* Calculate and show network fee for Spark only */}
              {quote && wallet.current instanceof SparkWallet && (
                <>
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
                        const amountInBN = new BigNumber(swap.amount.toString());
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
                </>
              )}

              {/* For Ark, just show the amount */}
              {wallet.current instanceof ArkadeWallet && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    paddingBottom: '8px',
                    borderBottom: '1px solid #e0e0e0',
                  }}
                >
                  <span style={{ color: '#666', fontSize: '14px' }}>You will receive:</span>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: '#4CAF50' }}>{formatBalance(swap.amount.toString(), getDecimalsByNetwork(swap.network))} BTC</span>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ color: '#666', fontSize: '14px' }}>Destination:</span>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>{swap.network === NETWORK_SPARK ? 'Spark' : 'Arkade'} Balance</span>
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
              You can claim this swap to receive Bitcoin on your {swap.network === NETWORK_SPARK ? 'Spark' : 'Arkade'} balance, or refund it to get your sats back to your Bitcoin wallet.
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Button
              onClick={handleClaim}
              disabled={disabled || (wallet.current instanceof SparkWallet && !quote)}
              style={{
                backgroundColor: disabled || (wallet.current instanceof SparkWallet && !quote) ? '#ccc' : '#4CAF50',
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

export default SwapXArkadeClaim;
