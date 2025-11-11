import React, { useContext } from 'react';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { useBalance } from '@shared/hooks/useBalance';
import { useExchangeRate } from '@shared/hooks/useExchangeRate';
import { useTokenBalance } from '@shared/hooks/useTokenBalance';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { getTokenInfo } from '@shared/models/token-list';
import { TokenInfo } from '@shared/types/token-info';
import { StringNumber } from '@shared/types/string-number';
import { useSendFlow } from '@/app/send/_layout';

export interface SendAssetProps {
  balance: StringNumber | undefined;
  exchangeRate: number | undefined;
  ticker: string;
  token: TokenInfo | undefined;
  decimals: number;
}

// HOC to wrap Component and insert balance and exchange rate for token.
// if no token, use balance and exchange rate for network.
export const withAsset = <P extends object>(Component: React.ComponentType<P & SendAssetProps>) => {
  // we need to create two wrappers to keep react hooks rules happy.
  const WithAssetWrapper = (props: P) => {
    const { network, token } = useSendFlow();
    const { accountNumber } = useContext(AccountNumberContext);
    const { balance: tokenBalance } = useTokenBalance(network, accountNumber, token!, BackgroundExecutor);
    const tokenInfo = getTokenInfo(token!);

    return (
      <Component
        {...props}
        balance={tokenBalance}
        exchangeRate={undefined} // TODO: get exchange rate for token
        ticker={tokenInfo.symbol}
        token={tokenInfo}
        decimals={tokenInfo.decimals}
      />
    );
  };

  const WithoutTokenWrapper = (props: P) => {
    const { network } = useSendFlow();
    const { accountNumber } = useContext(AccountNumberContext);

    const { balance: networkBalance } = useBalance(network, accountNumber, BackgroundExecutor);
    const { exchangeRate: networkExchangeRate } = useExchangeRate(network, 'USD');

    return <Component {...props} balance={networkBalance} exchangeRate={networkExchangeRate} ticker={getTickerByNetwork(network)} token={undefined} decimals={getDecimalsByNetwork(network)} />;
  };

  const WrappedComponent = (props: P) => {
    const { token } = useSendFlow();

    if (token) {
      return <WithAssetWrapper {...props} />;
    } else {
      return <WithoutTokenWrapper {...props} />;
    }
  };

  WrappedComponent.displayName = `withAsset(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
};
