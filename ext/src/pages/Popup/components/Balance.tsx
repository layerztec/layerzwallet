import BN from 'bignumber.js';
import { ShoppingCartIcon } from 'lucide-react';
import React, { useContext, useEffect, useMemo, useState } from 'react';

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
import { Button } from '../DesignSystem';

interface BalanceProps {
  network: Networks;
  accountNumber: number;
  BackgroundCaller: IBackgroundCaller;
}

type TTokenBalances = Record<string, string>;
type TTokenMap = Record<string, CachedTokenInfo>;

// Default balance component for regular networks
const BalanceDefault: React.FC<BalanceProps> = ({ network, accountNumber, BackgroundCaller }) => {
  const { balance } = useBalance(network, accountNumber, BackgroundCaller);
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
        <div style={{ color: 'darkred', width: '100%', marginBottom: '15px' }}>
          <span style={{ fontSize: 14 }}>Testnet. Coins have no value</span>
        </div>
      ) : null}

      <h1>
        <span id="home-balance">{displayBalance}</span> {ticker}
        {canBuyWithFiat ? (
          <span style={{ paddingLeft: '15px' }}>
            <Button onClick={handleBuyClick}>
              <ShoppingCartIcon /> Buy
            </Button>
          </span>
        ) : null}
        <div style={{ width: '100%', marginBottom: '15px' }}>
          <span style={{ fontSize: 14 }}>{displaySubBalance !== '—' ? `$${displaySubBalance}` : ''}</span>
        </div>
      </h1>

      <h3>
        <span id="pocket-balance">Pocket balance: {accountBalance ? formatBalance(accountBalance, getDecimalsByNetwork(NETWORK_BITCOIN), 8) : ''}</span> {getTickerByNetwork(NETWORK_BITCOIN)}
      </h3>
    </>
  );
};

const BalanceLightning: React.FC<BalanceProps> = ({ network, accountNumber, BackgroundCaller }) => {
  const availableNetworks = useAvailableNetworks();
  const { accountBalance } = useAccountBalance(accountNumber, availableNetworks);

  // Lightning network aggregates balances from Spark, Ark, and Liquid networks
  // Each underlying network has its own balance and exchange rate
  // Multiple useBalance hooks are needed since each network manages separate state
  const liquidNetwork = network === NETWORK_LIGHTNING_TESTNET ? NETWORK_LIQUID_TESTNET : NETWORK_LIQUID;
  const { balance: sparkBalance } = useBalance(NETWORK_SPARK, accountNumber, BackgroundCaller);
  const { balance: arkBalance } = useBalance(NETWORK_ARK, accountNumber, BackgroundCaller);
  const { balance: liquidBalance } = useBalance(liquidNetwork, accountNumber, BackgroundCaller);
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
        <tr key={net} style={{ borderBottom: index < networks.length - 1 ? '1px solid #eee' : 'none' }}>
          <td style={{ padding: '8px', fontSize: '14px' }}>{networkName}</td>
          <td style={{ textAlign: 'right', padding: '8px', fontSize: '14px' }}>
            {formattedBalance} {networkTicker}
          </td>
          <td style={{ textAlign: 'right', padding: '8px', fontSize: '14px' }}>{formattedFiatBalance} USD</td>
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
        <div style={{ color: 'darkred', width: '100%', marginBottom: '15px' }}>
          <span style={{ fontSize: 14 }}>Testnet. Coins have no value</span>
        </div>
      ) : null}

      <h1>
        <span id="home-balance">{displayBalance}</span> {ticker}
        <div style={{ width: '100%', marginBottom: '15px' }}>
          <span style={{ fontSize: 14 }}>{displaySubBalance !== '—' ? `$${displaySubBalance}` : ''}</span>
        </div>
      </h1>

      <div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
          <tbody>{rows}</tbody>
        </table>
        {fiatOnRamp?.[network]?.canBuyWithFiat ? (
          <div style={{ marginBottom: '15px' }}>
            <Button onClick={handleBuyClick}>
              <ShoppingCartIcon /> Buy
            </Button>
          </div>
        ) : null}
      </div>

      <h3>
        <span id="pocket-balance">Pocket balance: {accountBalance ? formatBalance(accountBalance, getDecimalsByNetwork(NETWORK_BITCOIN), 8) : ''}</span> {getTickerByNetwork(NETWORK_BITCOIN)}
      </h3>
    </>
  );
};

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
    <tr style={{ borderBottom: '1px solid #eee' }}>
      <td style={{ padding: '8px', fontSize: '14px' }}>{token.name}</td>
      <td style={{ textAlign: 'right', padding: '8px', fontSize: '14px' }}>
        {token.symbol}
        {formattedBalance}
      </td>
    </tr>
  );
};

// Balance component for USDT network (aggregates tokens from Rootstock and Liquid)
const BalanceUsdt: React.FC<BalanceProps> = ({ network, accountNumber, BackgroundCaller }) => {
  const availableNetworks = useAvailableNetworks();
  const { accountBalance } = useAccountBalance(accountNumber, availableNetworks);
  const { tokenList: rsTokenListOrig } = useTokenDiscovery(NETWORK_ROOTSTOCK, accountNumber, BackgroundCaller, LayerzStorage);
  const { tokenList: liquidTokenListOrig } = useTokenDiscovery(NETWORK_LIQUID, accountNumber, BackgroundCaller, LayerzStorage);
  const [tokenBalances, setTokenBalances] = useState<TTokenBalances>({});
  const ticker = getTickerByNetwork(network);

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
    for (const network of [NETWORK_ROOTSTOCK, NETWORK_LIQUID]) {
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
        <div style={{ color: 'darkred', width: '100%', marginBottom: '15px' }}>
          <span style={{ fontSize: 14 }}>Testnet. Coins have no value</span>
        </div>
      ) : null}

      <h1>
        <span id="home-balance">{displayBalance}</span> {ticker}
      </h1>

      <div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
          <tbody>{rows}</tbody>
        </table>
      </div>

      <h3>
        <span id="pocket-balance">Pocket balance: {accountBalance ? formatBalance(accountBalance, getDecimalsByNetwork(NETWORK_BITCOIN), 8) : ''}</span> {getTickerByNetwork(NETWORK_BITCOIN)}
      </h3>
    </>
  );
};

// Main component that routes to the appropriate balance view
const Balance: React.FC<BalanceProps> = ({ network, accountNumber, BackgroundCaller }) => {
  if (network === NETWORK_LIGHTNING || network === NETWORK_LIGHTNING_TESTNET) {
    return <BalanceLightning network={network} accountNumber={accountNumber} BackgroundCaller={BackgroundCaller} />;
  }
  if (network === NETWORK_USDT) {
    return <BalanceUsdt network={network} accountNumber={accountNumber} BackgroundCaller={BackgroundCaller} />;
  }
  return <BalanceDefault network={network} accountNumber={accountNumber} BackgroundCaller={BackgroundCaller} />;
};

export default Balance;
