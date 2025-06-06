import { ArrowDownRightIcon, SendIcon } from 'lucide-react';
import React, { useContext } from 'react';
import { useNavigate } from 'react-router';

import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useTokenBalance } from '@shared/hooks/useTokenBalance';
import { getTokenList } from '@shared/models/token-list';
import { capitalizeFirstLetter, formatBalance } from '@shared/modules/string-utils';
import { BackgroundCaller } from '../../../modules/background-caller';
import { SendTokenEvmProps } from '../SendTokenEvm';

const TokenRow: React.FC<{ tokenAddress: string }> = ({ tokenAddress }) => {
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const navigate = useNavigate();
  const list = getTokenList(network);
  const token = list.find((token) => token.address === tokenAddress);

  const { balance } = useTokenBalance(network, accountNumber, tokenAddress, BackgroundCaller);

  if (!balance) return null;

  const formattedBalance = formatBalance(balance, token?.decimals ?? 1, 2);

  // displaying token only if its balance is above the threshold. Threshold is arbitrary atm, probably
  // should be configurable per token
  if (+formattedBalance === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        border: '1px solid #e0e0e0',
        borderRadius: 8,
        margin: '4px 8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{token?.name}</span>
        <span style={{ marginLeft: 5, color: '#888', fontSize: 14 }}>({capitalizeFirstLetter(network)})</span>
      </div>

      <span style={{ fontSize: 14, marginLeft: 'auto', marginRight: 16 }}>
        <span style={{ fontWeight: 'bold' }}>{token?.symbol}</span> {balance ? formattedBalance : ''}
      </span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => navigate('/send-token-evm', { state: { contractAddress: token?.address } as SendTokenEvmProps })}
          title="Send"
          style={{
            border: 'none',
            background: 'white',
            padding: 6,
            cursor: 'pointer',
            color: '#666',
            display: 'flex',
            alignItems: 'center',
            borderRadius: 4,
          }}
        >
          <SendIcon size={16} />
        </button>
        <button
          onClick={() => navigate('/receive')}
          title="Receive"
          style={{
            border: 'none',
            background: 'white',
            padding: 6,
            cursor: 'pointer',
            color: '#666',
            display: 'flex',
            alignItems: 'center',
            borderRadius: 4,
          }}
        >
          <ArrowDownRightIcon size={16} />
        </button>
      </div>
    </div>
  );
};

const TokensView: React.FC = () => {
  const { network } = useContext(NetworkContext);
  const tokenList = getTokenList(network);

  if (tokenList.length === 0) {
    return null;
  }

  return (
    <div style={{ padding: 10, marginTop: 10 }}>
      <h2 style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }}>Tokens</h2>
      <div>
        {tokenList.map((token) => (
          <TokenRow key={token.address} tokenAddress={token.address} />
        ))}
      </div>
    </div>
  );
};

export default TokensView;
