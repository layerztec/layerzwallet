import BN from 'bignumber.js';
import { ShoppingCartIcon } from 'lucide-react';
import React, { useContext, useEffect, useImperativeHandle, useMemo, useState, forwardRef } from 'react';

import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { useAccountBalance } from '@shared/hooks/useAccountBalance';
import { useAvailableNetworks } from '@shared/hooks/useAvailableNetworks';
import { useBalance } from '@shared/hooks/useBalance';
import { useExchangeRate } from '@shared/hooks/useExchangeRate';
import { useTokenBalance } from '@shared/hooks/useTokenBalance';
import { useTokenDiscovery } from '@shared/hooks/useTokenDiscovery';
import { fiatOnRamp } from '@shared/models/fiat-on-ramp';
import { getDecimalsByNetwork, getIsTestnet, getTickerByNetwork } from '@shared/models/network-getters';
import { USDT_TOKENS } from '@shared/models/token-list';
import { capitalizeFirstLetter, formatBalance, formatFiatBalance } from '@shared/modules/string-utils';
import { IBackgroundCaller } from '@shared/types/IBackgroundCaller';
import {
  NETWORK_ARK,
  NETWORK_BITCOIN,
  NETWORK_LIGHTNING,
  NETWORK_LIGHTNING_TESTNET,
  NETWORK_LIQUID,
  NETWORK_LIQUID_TESTNET,
  NETWORK_ROOTSTOCK,
  NETWORK_SPARK,
  NETWORK_USDT,
  Networks,
} from '@shared/types/networks';
import { CachedTokenInfo } from '@shared/types/token-info';
import { LayerzStorage } from '../../../class/layerz-storage';
import { Button } from '../../../components/ui/button';

interface BalanceProps {
  network: Networks;
  accountNumber: number;
  BackgroundCaller: IBackgroundCaller;
}

type TTokenBalances = Record<string, string>;
type TTokenMap = Record<string, CachedTokenInfo>;

// Default balance component for regular networks
const BalanceDefault = forwardRef<{ refresh: () => void }, BalanceProps>(({ network, accountNumber, BackgroundCaller }, ref) => {
  const { balance, mutate } = useBalance(network, accountNumber, BackgroundCaller);

  useImperativeHandle(ref, () => ({
    refresh: () => {
      mutate();
    },
  }));
  const { exchangeRate } = useExchangeRate(network, 'USD');
  const availableNetworks = useAvailableNetworks();
  const { accountBalance } = useAccountBalance(accountNumber, availableNetworks);
  const ticker = getTickerByNetwork(network);
  const canBuyWithFiat = fiatOnRamp?.[network]?.canBuyWithFiat;

  const [displayBalance, displaySubBalance] = useMemo(() => {
    const decimals = getDecimalsByNetwork(network);
    if (!balance) return [`—`, '—'];
    const formattedBalance = formatBalance(balance, decimals);
    if (!exchangeRate) return [formattedBalance, '—'];
    const usdValue = formatFiatBalance(balance, decimals, exchangeRate);
    return [formattedBalance, usdValue];
  }, [network, balance, exchangeRate]);

  const handleBuyClick = () => {
    BackgroundCaller.getAddress(network, accountNumber).then((addressResponse: string) => {
      if (addressResponse) {
        window.open(`https://layerztec.github.io/website/onramp/?address=${addressResponse}&network=${network}`, '_blank');
      }
    });
  };

  return (
    <>
      {getIsTestnet(network) ? (
        <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
          <span className="text-sm text-destructive">Testnet. Coins have no value</span>
        </div>
      ) : null}

      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">
          <span id="home-balance">{displayBalance}</span> <span className="text-muted-foreground">{ticker}</span>
        </h1>
        {displaySubBalance !== '—' && <p className="text-lg text-muted-foreground">${displaySubBalance} USD</p>}
        {canBuyWithFiat && (
          <div className="pt-2">
            <Button onClick={handleBuyClick} size="sm" variant="outline">
              <ShoppingCartIcon size={16} className="mr-2" />
              Buy
            </Button>
          </div>
        )}
      </div>

      <div id="pocket-balance" className="absolute top-2 left-4 text-xs text-muted-foreground">
        Pocket: {accountBalance ? formatBalance(accountBalance, getDecimalsByNetwork(NETWORK_BITCOIN), 8) : ''} {getTickerByNetwork(NETWORK_BITCOIN)}
      </div>
    </>
  );
});

BalanceDefault.displayName = 'BalanceDefault';

const BalanceLightning = forwardRef<{ refresh: () => void }, BalanceProps>(({ network, accountNumber, BackgroundCaller }, ref) => {
  const availableNetworks = useAvailableNetworks();
  const { accountBalance } = useAccountBalance(accountNumber, availableNetworks);

  // Lightning network aggregates balances from Spark, Ark, and Liquid networks
  // Each underlying network has its own balance and exchange rate
  // Multiple useBalance hooks are needed since each network manages separate state
  const liquidNetwork = network === NETWORK_LIGHTNING_TESTNET ? NETWORK_LIQUID_TESTNET : NETWORK_LIQUID;
  const { balance: sparkBalance, mutate: mutateSpark } = useBalance(NETWORK_SPARK, accountNumber, BackgroundCaller);
  const { balance: arkBalance, mutate: mutateArk } = useBalance(NETWORK_ARK, accountNumber, BackgroundCaller);
  const { balance: liquidBalance, mutate: mutateLiquid } = useBalance(liquidNetwork, accountNumber, BackgroundCaller);

  useImperativeHandle(ref, () => ({
    refresh: () => {
      mutateSpark();
      mutateArk();
      mutateLiquid();
    },
  }));
  const { exchangeRate: sparkExchangeRate } = useExchangeRate(NETWORK_SPARK, 'USD');
  const { exchangeRate: arkExchangeRate } = useExchangeRate(NETWORK_ARK, 'USD');
  const { exchangeRate: liquidExchangeRate } = useExchangeRate(liquidNetwork, 'USD');

  const ticker = getTickerByNetwork(network);
  const decimals = getDecimalsByNetwork(network);

  const [displayBalance, displaySubBalance] = useMemo<[string, string]>(() => {
    if (network === NETWORK_LIGHTNING) {
      if (sparkBalance === undefined || liquidBalance === undefined || arkBalance === undefined) return ['—', '—'];
      const totalBalance = BN(sparkBalance).plus(liquidBalance).plus(arkBalance).toString();
      const formattedBalance = formatBalance(totalBalance, decimals);
      if (sparkExchangeRate === undefined || liquidExchangeRate === undefined || arkExchangeRate === undefined) return [formattedBalance, '—'];
      const totalUsdValue = BN(sparkBalance)
        .times(sparkExchangeRate)
        .plus(BN(liquidBalance).times(liquidExchangeRate))
        .plus(BN(arkBalance).times(arkExchangeRate))
        .dividedBy(BN(10).pow(decimals))
        .toFixed(2);
      return [formattedBalance, totalUsdValue];
    } else if (network === NETWORK_LIGHTNING_TESTNET) {
      if (liquidBalance === undefined) return ['—', '—'];
      const formattedBalance = formatBalance(liquidBalance, decimals);
      if (liquidExchangeRate === undefined) return [formattedBalance, '—'];
      const totalUsdValue = BN(liquidBalance).times(liquidExchangeRate).dividedBy(BN(10).pow(decimals)).toFixed(2);
      return [formattedBalance, totalUsdValue];
    }

    return ['Error', 'Error'];
  }, [network, sparkBalance, liquidBalance, arkBalance, decimals, sparkExchangeRate, liquidExchangeRate, arkExchangeRate]);

  const rows = useMemo(() => {
    const networks = network === NETWORK_LIGHTNING ? [NETWORK_SPARK, NETWORK_ARK, NETWORK_LIQUID] : [NETWORK_LIQUID_TESTNET];

    return networks.map((net, index) => {
      let balance: string | undefined;
      let exchangeRate: number | undefined;
      if (net === NETWORK_ARK) {
        balance = arkBalance;
        exchangeRate = arkExchangeRate;
      } else if (net === NETWORK_SPARK) {
        balance = sparkBalance;
        exchangeRate = sparkExchangeRate;
      } else if (net === NETWORK_LIQUID || net === NETWORK_LIQUID_TESTNET) {
        balance = liquidBalance;
        exchangeRate = liquidExchangeRate;
      }

      const formattedBalance = balance !== undefined ? formatBalance(balance, Number(getDecimalsByNetwork(net)), 8) : '—';
      const formattedFiatBalance = exchangeRate !== undefined && balance !== undefined ? '$' + formatFiatBalance(balance, Number(getDecimalsByNetwork(net)), Number(exchangeRate)) : '$—';
      const networkTicker = getTickerByNetwork(net);
      const networkName = capitalizeFirstLetter(net);

      return (
        <tr key={net} className="hover:bg-muted/50 transition-colors">
          <td className="px-4 py-3 text-sm">{networkName}</td>
          <td className="px-4 py-3 text-sm text-right font-medium">
            {formattedBalance} {networkTicker}
          </td>
          <td className="px-4 py-3 text-sm text-right text-muted-foreground">{formattedFiatBalance}</td>
        </tr>
      );
    });
  }, [network, sparkBalance, liquidBalance, arkBalance, sparkExchangeRate, liquidExchangeRate, arkExchangeRate]);

  const handleBuyClick = () => {
    BackgroundCaller.getAddress(network, accountNumber).then((addressResponse: string) => {
      if (addressResponse) {
        window.open(`https://layerztec.github.io/website/onramp/?address=${addressResponse}&network=${network}`, '_blank');
      }
    });
  };

  return (
    <>
      {getIsTestnet(network) ? (
        <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
          <span className="text-sm text-destructive">Testnet. Coins have no value</span>
        </div>
      ) : null}

      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">
          <span id="home-balance">{displayBalance}</span> <span className="text-muted-foreground">{ticker}</span>
        </h1>
        {displaySubBalance !== '—' && <p className="text-lg text-muted-foreground">${displaySubBalance} USD</p>}
      </div>

      <div className="mt-4">
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full border-collapse">
            <tbody className="divide-y divide-border">{rows}</tbody>
          </table>
        </div>
        {fiatOnRamp?.[network]?.canBuyWithFiat && (
          <div className="mt-4">
            <Button onClick={handleBuyClick} size="sm" variant="outline" className="w-full">
              <ShoppingCartIcon size={16} className="mr-2" />
              Buy
            </Button>
          </div>
        )}
      </div>

      <div id="pocket-balance" className="absolute top-2 left-4 text-xs text-muted-foreground">
        Pocket: {accountBalance ? formatBalance(accountBalance, getDecimalsByNetwork(NETWORK_BITCOIN), 8) : ''} {getTickerByNetwork(NETWORK_BITCOIN)}
      </div>
    </>
  );
});

BalanceLightning.displayName = 'BalanceLightning';

// Component for individual USDT token balance row
const USDTTokenRow: React.FC<{
  network: Networks;
  token: CachedTokenInfo;
  setTokenBalances: React.Dispatch<React.SetStateAction<TTokenBalances>>;
  BackgroundCaller: IBackgroundCaller;
}> = ({ network, token, setTokenBalances, BackgroundCaller }) => {
  const { accountNumber } = useContext(AccountNumberContext);
  const { balance } = useTokenBalance(network, accountNumber, token.id, BackgroundCaller);

  const formattedBalance = formatBalance(balance ?? token.balance ?? '0', token.decimals);

  useEffect(() => {
    if (balance === undefined) return;
    setTokenBalances((prev) => ({ ...prev, [token.id]: balance }));
  }, [balance, token.id, setTokenBalances]);

  return (
    <tr className="hover:bg-muted/50 transition-colors">
      <td className="px-4 py-3 text-sm">{token.name}</td>
      <td className="px-4 py-3 text-sm text-right font-medium">
        {formattedBalance} {token.symbol}
      </td>
    </tr>
  );
};

// Balance component for USDT network (aggregates tokens from Rootstock and Liquid)
const BalanceUsdt = forwardRef<{ refresh: () => void }, BalanceProps>(({ network, accountNumber, BackgroundCaller }, ref) => {
  const availableNetworks = useAvailableNetworks();
  const { accountBalance } = useAccountBalance(accountNumber, availableNetworks);
  const { tokenList: rsTokenListOrig, mutate: mutateRsTokens } = useTokenDiscovery(NETWORK_ROOTSTOCK, accountNumber, BackgroundCaller, LayerzStorage);
  const { tokenList: liquidTokenListOrig, mutate: mutateLiquidTokens } = useTokenDiscovery(NETWORK_LIQUID, accountNumber, BackgroundCaller, LayerzStorage);
  const [tokenBalances, setTokenBalances] = useState<TTokenBalances>({});
  const ticker = getTickerByNetwork(network);

  useImperativeHandle(ref, () => ({
    refresh: () => {
      mutateRsTokens();
      mutateLiquidTokens();
    },
  }));

  const tokenMap = useMemo<TTokenMap>(() => {
    const map: TTokenMap = {};
    for (const token of rsTokenListOrig) {
      map[token.id] = token;
    }
    for (const token of liquidTokenListOrig) {
      map[token.id] = token;
    }
    return map;
  }, [rsTokenListOrig, liquidTokenListOrig]);

  const displayBalance = useMemo(() => {
    let b = BN(0);
    for (const [id, balance] of Object.entries(tokenBalances)) {
      if (!tokenMap[id]) continue;
      b = b.plus(BN(balance).dividedBy(10 ** tokenMap[id].decimals));
    }
    return b.toFixed(2);
  }, [tokenBalances, tokenMap]);

  const rows = useMemo(() => {
    const result = [];
    for (const network of [NETWORK_LIQUID, NETWORK_ROOTSTOCK]) {
      const tokens = USDT_TOKENS[network];
      for (const token of tokens) {
        if (!tokenMap[token]) continue;
        result.push(<USDTTokenRow key={token} network={network as Networks} token={tokenMap[token]} setTokenBalances={setTokenBalances} BackgroundCaller={BackgroundCaller} />);
      }
    }
    return result;
  }, [tokenMap, BackgroundCaller]);

  return (
    <>
      {getIsTestnet(network) ? (
        <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
          <span className="text-sm text-destructive">Testnet. Coins have no value</span>
        </div>
      ) : null}

      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">
          <span id="home-balance">{displayBalance}</span> <span className="text-muted-foreground">{ticker}</span>
        </h1>
      </div>

      <div className="mt-4">
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full border-collapse">
            <tbody className="divide-y divide-border">{rows}</tbody>
          </table>
        </div>
      </div>

      <div id="pocket-balance" className="absolute top-2 left-4 text-xs text-muted-foreground">
        Pocket: {accountBalance ? formatBalance(accountBalance, getDecimalsByNetwork(NETWORK_BITCOIN), 8) : ''} {getTickerByNetwork(NETWORK_BITCOIN)}
      </div>
    </>
  );
});

BalanceUsdt.displayName = 'BalanceUsdt';

// Main component that routes to the appropriate balance view
const Balance = forwardRef<{ refresh: () => void }, BalanceProps>(({ network, accountNumber, BackgroundCaller }, ref) => {
  if (network === NETWORK_LIGHTNING || network === NETWORK_LIGHTNING_TESTNET) {
    return <BalanceLightning ref={ref} network={network} accountNumber={accountNumber} BackgroundCaller={BackgroundCaller} />;
  }
  if (network === NETWORK_USDT) {
    return <BalanceUsdt ref={ref} network={network} accountNumber={accountNumber} BackgroundCaller={BackgroundCaller} />;
  }
  return <BalanceDefault ref={ref} network={network} accountNumber={accountNumber} BackgroundCaller={BackgroundCaller} />;
});

Balance.displayName = 'Balance';

export default Balance;
