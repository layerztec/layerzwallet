import { useContext, useMemo } from 'react';

import { getDecimalsByNetwork, getTickerByNetwork } from '../models/network-getters';
import { getTokenInfo, USDT_TOKENS } from '../models/token-list';
import { IBackgroundCaller } from '../types/IBackgroundCaller';
import { NETWORK_LIQUID, NETWORK_ROOTSTOCK, Networks } from '../types/networks';
import { SO_LIQUID_USDT, SO_ROOTSTOCK_USDT, SwapOptions } from '../types/swap';
import { AccountNumberContext } from './AccountNumberContext';
import { useBalance } from './useBalance';
import { useTokenBalance } from './useTokenBalance';

interface UseSwapBalanceResult {
  balance: string | undefined;
  actualIsLoading: boolean;
  decimals: number;
  ticker: string;
}

export function useSwapBalance(network: Networks, fromNetwork: SwapOptions | undefined, backgroundCaller: IBackgroundCaller): UseSwapBalanceResult {
  const { accountNumber } = useContext(AccountNumberContext);

  // Get regular network balance
  const { balance: networkBalance } = useBalance(network, accountNumber, backgroundCaller);

  // Get USDT token balances for both networks
  const liquidUsdtBalance = useTokenBalance(NETWORK_LIQUID, accountNumber, USDT_TOKENS[NETWORK_LIQUID][0], backgroundCaller);
  const rootstockUsdtBalance = useTokenBalance(NETWORK_ROOTSTOCK, accountNumber, USDT_TOKENS[NETWORK_ROOTSTOCK][0], backgroundCaller);

  // Get the appropriate balance based on fromNetwork
  const balance = useMemo(() => {
    if (fromNetwork === SO_LIQUID_USDT) {
      return liquidUsdtBalance.balance;
    }
    if (fromNetwork === SO_ROOTSTOCK_USDT) {
      return rootstockUsdtBalance.balance;
    }
    return networkBalance;
  }, [fromNetwork, liquidUsdtBalance.balance, rootstockUsdtBalance.balance, networkBalance]);

  const actualIsLoading = useMemo(() => {
    if (fromNetwork === SO_LIQUID_USDT) {
      return liquidUsdtBalance.isLoading;
    }
    if (fromNetwork === SO_ROOTSTOCK_USDT) {
      return rootstockUsdtBalance.isLoading;
    }
    return false;
  }, [fromNetwork, liquidUsdtBalance.isLoading, rootstockUsdtBalance.isLoading]);

  // Get proper decimals and ticker for USDT tokens
  const [decimals, ticker] = useMemo(() => {
    if (fromNetwork === SO_LIQUID_USDT) {
      const tokenAddress = USDT_TOKENS[NETWORK_LIQUID][0];
      const tokenInfo = getTokenInfo(tokenAddress);
      return [tokenInfo.decimals, tokenInfo.symbol];
    }
    if (fromNetwork === SO_ROOTSTOCK_USDT) {
      const tokenAddress = USDT_TOKENS[NETWORK_ROOTSTOCK][0];
      const tokenInfo = getTokenInfo(tokenAddress);
      return [tokenInfo.decimals, tokenInfo.symbol];
    }
    return [getDecimalsByNetwork(network), getTickerByNetwork(network)];
  }, [fromNetwork, network]);

  return {
    balance,
    actualIsLoading,
    decimals,
    ticker,
  };
}
