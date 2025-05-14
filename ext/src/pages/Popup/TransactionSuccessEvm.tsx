import React, { useEffect, useState } from 'react';
import { WideButton } from './DesignSystem';
import { CheckCircle2, Loader, XCircle } from 'lucide-react';
import { useLocation } from 'react-router';
import { Networks } from '@shared/types/networks';
import { getDecimalsByNetwork, getExplorerUrlByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import BigNumber from 'bignumber.js';
import { useTransactionReceipt } from '@shared/hooks/useTransactionReceipt';
import { ethers } from 'ethers';
import { capitalizeFirstLetter, formatBalance, hexToDec } from '@shared/modules/string-utils';
import { getTokenList } from '@shared/models/token-list';

export interface TransactionSuccessProps {
  amount: string; // in sats
  amountToken?: string; // if we sent token then this field is present
  tokenContractAddress?: string; // if we sent token then this field is present
  recipient: string;
  network: Networks;
  transactionId: string;
  bytes: string; // txhex
}

const TransactionSuccessEvm: React.FC = () => {
  const location = useLocation();
  const { transactionId, amount, recipient, network, bytes, amountToken, tokenContractAddress } = location.state as TransactionSuccessProps;
  const { receipt } = useTransactionReceipt(network, transactionId);

  const list = getTokenList(network);
  const tokenInfo = list.find((token) => token.address === tokenContractAddress);

  const [showTimedOutTxIcon, setShowTimedOutTxIcon] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTimedOutTxIcon(!receipt);
    }, 45_000);

    return () => clearTimeout(timer);
  }, [receipt]);

  function calculateFees() {
    if (!receipt) return 0;

    if (!receipt.gasUsed && !receipt.effectiveGasPrice) return '?';
    if (receipt.gasUsed && !receipt.effectiveGasPrice) {
      // probably tx type 0, where we know the gas used and the gasprice is hardcoded in tx itself
      const p = ethers.Transaction.from(bytes);
      if (p.gasPrice) {
        const i = new BigNumber(p.gasPrice.toString()).multipliedBy(new BigNumber(receipt.gasUsed.toString())).toString();
        // not using ethers bignumber cause its faulty, BigNumber.js is better
        return new BigNumber(i).dividedBy(Math.pow(10, getDecimalsByNetwork(network))).toString() + ' ' + getTickerByNetwork(network);
      }
      return '???';
    }

    const fee = new BigNumber(receipt.gasUsed as unknown as string)
      .multipliedBy(receipt.effectiveGasPrice as unknown as string)
      .dividedBy(Math.pow(10, getDecimalsByNetwork(network)))
      .toString();
    return fee + ' ' + getTickerByNetwork(network);
  }

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      {receipt && hexToDec(receipt.status) === 1 ? (
        <>
          <CheckCircle2 size={48} color="#4CAF50" />
          <h2>Transaction sent successfully!</h2>
        </>
      ) : null}

      {receipt && hexToDec(receipt.status) === 0 ? (
        <>
          <XCircle size={48} color="#FF6347" />
          <h2>Transaction failed</h2>
        </>
      ) : null}

      {!receipt ? (
        <>
          <Loader size={48} color="#FFA500" />
          <h2>Waiting for a transaction...</h2>
        </>
      ) : null}

      {showTimedOutTxIcon && !receipt && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '14px', color: 'red', paddingBottom: '10px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span style={{ paddingLeft: '5px' }}>Transaction can not be found on the blockchain. Insufficient fee?</span>
        </div>
      )}

      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '15px',
          marginBottom: '20px',
          border: '1px solid #e0e0e0',
        }}
      >
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '10px', marginTop: '0px' }}>Summary of your recent transaction</p>

        {+amount ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px' }}>
            <span>Amount</span>
            <strong>
              {formatBalance(amount, getDecimalsByNetwork(network))} {getTickerByNetwork(network)}
            </strong>
          </div>
        ) : null}

        {amountToken && tokenInfo ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px' }}>
            <span>Amount</span>
            <strong>
              {formatBalance(amountToken, tokenInfo.decimals, 2)} {tokenInfo.symbol}
            </strong>
          </div>
        ) : null}

        {receipt ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px' }}>
            <span>Fee paid</span>
            <strong>{calculateFees()}</strong>
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px' }}>
          <span>Recipient</span>
          <strong style={{ wordBreak: 'break-all', textAlign: 'right' }}>{recipient}</strong>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px' }}>
          <span>Network</span>
          <strong>{capitalizeFirstLetter(network)}</strong>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
          <span>Transaction ID</span>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span
              style={{
                maxWidth: '150px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginRight: '5px',
              }}
            >
              {transactionId.replace('0x', '')}
            </span>
            <button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }} onClick={() => navigator.clipboard.writeText(transactionId)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <WideButton onClick={async () => window.open(getExplorerUrlByNetwork(network) + '/tx/' + transactionId, '_blank')}>View in Explorer</WideButton>
    </div>
  );
};

export default TransactionSuccessEvm;
