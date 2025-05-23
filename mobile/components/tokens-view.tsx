import React, { useContext } from 'react';
import { View } from 'react-native';
import { DEFAULT_NETWORK } from '@shared/config';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getTokenList } from '@shared/models/token-list';
import TokenRow from './token-row';

const TokensView: React.FC = () => {
  const { network } = useContext(NetworkContext);

  const tokenList = getTokenList(network ?? DEFAULT_NETWORK);

  return (
    <View>
      {tokenList.map((token) => (
        <TokenRow key={token.address} tokenAddress={token.address} />
      ))}
    </View>
  );
};

export default TokensView;
