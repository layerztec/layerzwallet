import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_NETWORK } from '@shared/config';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useTokenBalance } from '@shared/hooks/useTokenBalance';
import { getTokenList } from '@shared/models/token-list';
import { capitalizeFirstLetter, formatBalance } from '@shared/modules/string-utils';
import { ArrowDownRightIcon, SendIcon } from 'lucide-react';
import { SendTokenEvmProps } from '../SendTokenEvm';
import { BackgroundCaller } from '../../../modules/background-caller';

const TokenRow: React.FC<{ tokenAddress: string }> = ({ tokenAddress }) => {
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const navigate = useNavigate();
  const list = getTokenList(network);
  const token = list.find((token) => token.address === tokenAddress);

  const { balance } = useTokenBalance(network ?? DEFAULT_NETWORK, accountNumber, tokenAddress, BackgroundCaller);

  if (!balance) return null;

  const formattedBalance = formatBalance(balance, token?.decimals ?? 1, 2);

  // displaying token only if its balance is above the threshold. Threshold is arbitrary atm, probably
  // should be configurable per token
  if (+formattedBalance === 0) return null;

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', border: '1px solid #e0e0e0', borderRadius: '5px', backgroundColor: '#f0f0f0' }}>
      <div>
        <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{token?.name}</span>
        <span style={{ marginLeft: '5px', color: '#888', fontSize: '14px' }}>({capitalizeFirstLetter(network)})</span>
      </div>

      <span style={{ fontSize: '14px', marginLeft: 'auto', marginRight: '16px' }}>
        <span style={{ fontWeight: 'bold' }}>{token?.symbol}</span> {balance ? formattedBalance : ''}
      </span>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={() => navigate('/send-token-evm', { state: { contractAddress: token?.address } as SendTokenEvmProps })}
          style={{
            border: 'none',
            background: 'white',
            padding: '6px',
            cursor: 'pointer',
            color: '#666',
            display: 'flex',
            alignItems: 'center',
            borderRadius: '4px',
          }}
        >
          <SendIcon size={16} />
        </button>
        <button
          onClick={() => navigate('/receive')}
          style={{
            border: 'none',
            background: 'white',
            padding: '6px',
            cursor: 'pointer',
            color: '#666',
            display: 'flex',
            alignItems: 'center',
            borderRadius: '4px',
          }}
        >
          <ArrowDownRightIcon size={16} />
        </button>
      </div>
    </div>
  );
};

export default TokenRow;
