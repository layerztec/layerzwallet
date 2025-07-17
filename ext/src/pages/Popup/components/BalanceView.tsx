import React from 'react';
import { ShoppingCartIcon } from 'lucide-react';

import { useBalance } from '@shared/hooks/useBalance';
import { useAccountBalance } from '@shared/hooks/useAccountBalance';
import { useExchangeRate } from '@shared/hooks/useExchangeRate';
import { fiatOnRamp } from '@shared/models/fiat-on-ramp';
import { getDecimalsByNetwork, getIsTestnet, getTickerByNetwork } from '@shared/models/network-getters';
import { formatBalance, formatFiatBalance } from '@shared/modules/string-utils';
import { useAvailableNetworks } from '@shared/hooks/useAvailableNetworks';
import { NETWORK_BITCOIN, NETWORK_LIGHTNING, NETWORK_LIGHTNINGTESTNET, NETWORK_LIQUID, NETWORK_LIQUIDTESTNET, NETWORK_SPARK, Networks } from '@shared/types/networks';

import { Button } from '../DesignSystem';
import { IBackgroundCaller } from '@shared/types/IBackgroundCaller';

interface BalanceViewProps {
  network: Networks;
  accountNumber: number;
  BackgroundCaller: IBackgroundCaller;
}

const BalanceView: React.FC<BalanceViewProps> = ({ network, accountNumber, BackgroundCaller }) => {
  const { balance } = useBalance(network, accountNumber, BackgroundCaller);
  const { exchangeRate } = useExchangeRate(network, 'USD');
  const availableNetworks = useAvailableNetworks();
  const { accountBalance } = useAccountBalance(accountNumber, availableNetworks);

  // Always call hooks but use a same network in current network is not NETWORK_LIGHTNING, so the deduplication will work and
  // no extra requests to backend will be made
  const isLightningNetwork = network === NETWORK_LIGHTNING || network === NETWORK_LIGHTNINGTESTNET;
  const sparkNetwork = isLightningNetwork ? NETWORK_SPARK : network;
  const liquidNetwork = isLightningNetwork ? (network === NETWORK_LIGHTNINGTESTNET ? NETWORK_LIQUIDTESTNET : NETWORK_LIQUID) : network;
  const { balance: sparkBalance } = useBalance(sparkNetwork, accountNumber, BackgroundCaller);
  const { balance: liquidBalance } = useBalance(liquidNetwork, accountNumber, BackgroundCaller);
  const { exchangeRate: sparkExchangeRate } = useExchangeRate(sparkNetwork, 'USD');
  const { exchangeRate: liquidExchangeRate } = useExchangeRate(liquidNetwork, 'USD');

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

      {network === NETWORK_LIGHTNING || network === NETWORK_LIGHTNINGTESTNET ? (
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px', fontSize: '14px' }}>Spark</td>
                <td style={{ textAlign: 'right', padding: '8px', fontSize: '14px' }}>
                  {network === NETWORK_LIGHTNINGTESTNET ? '0' : sparkBalance ? formatBalance(sparkBalance, getDecimalsByNetwork(NETWORK_SPARK), 8) : '0'} {getTickerByNetwork(NETWORK_SPARK)}
                </td>
                <td style={{ textAlign: 'right', padding: '8px', fontSize: '14px' }}>
                  {network === NETWORK_LIGHTNINGTESTNET
                    ? '-'
                    : sparkBalance && +sparkBalance > 0 && sparkExchangeRate
                      ? '$' + formatFiatBalance(sparkBalance, getDecimalsByNetwork(NETWORK_SPARK), sparkExchangeRate)
                      : '-'}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '8px', fontSize: '14px' }}>Liquid</td>
                <td style={{ textAlign: 'right', padding: '8px', fontSize: '14px' }}>
                  {liquidBalance ? formatBalance(liquidBalance, getDecimalsByNetwork(NETWORK_LIQUID), 8) : '0'} {getTickerByNetwork(NETWORK_LIQUID)}
                </td>
                <td style={{ textAlign: 'right', padding: '8px', fontSize: '14px' }}>
                  {liquidBalance && +liquidBalance > 0 && liquidExchangeRate ? '$' + formatFiatBalance(liquidBalance, getDecimalsByNetwork(NETWORK_LIQUID), liquidExchangeRate) : '-'}
                </td>
              </tr>
            </tbody>
          </table>
          {fiatOnRamp?.[network]?.canBuyWithFiat ? (
            <div style={{ marginBottom: '15px' }}>
              <Button onClick={handleBuyClick}>
                <ShoppingCartIcon /> Buy
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <h1>
          <span id="home-balance">{balance ? formatBalance(balance, getDecimalsByNetwork(network), 8) : ''}</span> {getTickerByNetwork(network)}
          {fiatOnRamp?.[network]?.canBuyWithFiat ? (
            <span style={{ paddingLeft: '15px' }}>
              <Button onClick={handleBuyClick}>
                <ShoppingCartIcon /> Buy
              </Button>
            </span>
          ) : null}
          <div style={{ width: '100%', marginBottom: '15px' }}>
            <span style={{ fontSize: 14 }}>{balance && +balance > 0 && exchangeRate ? '$' + formatFiatBalance(balance, getDecimalsByNetwork(network), exchangeRate) : ''}</span>
          </div>
        </h1>
      )}

      <h3>
        <span id="pocket-balance">Pocket balance: {accountBalance ? formatBalance(accountBalance, getDecimalsByNetwork(NETWORK_BITCOIN), 8) : ''}</span> {getTickerByNetwork(NETWORK_BITCOIN)}
      </h3>
    </>
  );
};

export default BalanceView;
