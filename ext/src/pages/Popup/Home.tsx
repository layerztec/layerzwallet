import { ArrowDownRightIcon, Info, SendIcon, ShoppingCartIcon, RefreshCwIcon } from 'lucide-react';
import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useBalance } from '@shared/hooks/useBalance';
import { useAccountBalance } from '@shared/hooks/useAccountBalance';
import { useExchangeRate } from '@shared/hooks/useExchangeRate';
import { fiatOnRamp } from '@shared/models/fiat-on-ramp';
import { getSwapPairs } from '@shared/models/swap-providers-list';
import { getDecimalsByNetwork, getIsTestnet, getKnowMoreUrl, getTickerByNetwork } from '@shared/models/network-getters';
import { capitalizeFirstLetter, formatBalance, formatFiatBalance } from '@shared/modules/string-utils';
import { SwapPair, SwapPlatform } from '@shared/types/swap';
import { useAvailableNetworks } from '@shared/hooks/useAvailableNetworks';
import { NETWORK_ARKMUTINYNET, NETWORK_BITCOIN, NETWORK_LIGHTNING, NETWORK_LIGHTNINGTESTNET, NETWORK_LIQUID, NETWORK_LIQUIDTESTNET, NETWORK_SPARK } from '@shared/types/networks';

import { BackgroundCaller } from '../../modules/background-caller';
import PartnersView from './components/PartnersView';
import TokensView from './components/TokensView';
import { ActionPopupButton, Button, Switch } from './DesignSystem';
import LiquidTokensView from './components/LiquidTokensView';
import SwapInterfaceView from './components/SwapInterfaceView';
import { ReceiveLightningProps } from './ReceiveLightning';
import { SendLightningProps } from './SendLightning';

const Home: React.FC = () => {
  const navigate = useNavigate();

  const { network, setNetwork } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { balance } = useBalance(network, accountNumber, BackgroundCaller);
  const [isTestnet, setIsTestnet] = useState<boolean>(false);
  const { exchangeRate } = useExchangeRate(network, 'USD');
  const [swapPairs, setSwapPairs] = useState<SwapPair[]>([]);
  const [showSwapInterface, setShowSwapInterface] = useState<boolean>(false);
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

  useEffect(() => {
    setIsTestnet(getIsTestnet(network));
    setShowSwapInterface(false);
  }, [network]);

  useEffect(() => {
    setSwapPairs(getSwapPairs(network, SwapPlatform.EXT));
    setShowSwapInterface(false);
  }, [network]);

  const handleReceive = () => {
    navigate('/receive');
  };

  const handleSend = () => {
    switch (network) {
      case NETWORK_BITCOIN:
        navigate('/send-btc');
        break;
      case NETWORK_SPARK:
      case NETWORK_ARKMUTINYNET:
        navigate('/send-ark');
        break;
      case NETWORK_LIQUID:
      case NETWORK_LIQUIDTESTNET:
        navigate('/send-liquid');
        break;
      case NETWORK_LIGHTNING:
      case NETWORK_LIGHTNINGTESTNET:
        navigate('/send-lightning');
        break;
      default:
        navigate('/send-evm');
    }
  };

  const handleReceiveLightningOnSpark = () => {
    if (network === NETWORK_LIGHTNINGTESTNET) {
      alert('Spark has no testnet');
      return;
    }
    const state: ReceiveLightningProps = { network: NETWORK_SPARK };
    navigate('/receive-lightning', { state });
  };

  const handleSendLightningOnSpark = () => {
    if (network === NETWORK_LIGHTNINGTESTNET) {
      alert('Spark has no testnet');
      return;
    }
    const state: SendLightningProps = { network: NETWORK_SPARK };
    navigate('/send-lightning', { state });
  };

  const handleReceiveLightningOnLiquid = () => {
    let chosenNetwork: typeof NETWORK_LIQUIDTESTNET | typeof NETWORK_LIQUID = NETWORK_LIQUID; // default - mainnet

    if (network === NETWORK_LIGHTNINGTESTNET) {
      chosenNetwork = NETWORK_LIQUIDTESTNET;
    }

    const state: ReceiveLightningProps = { network: chosenNetwork };
    navigate('/receive-lightning', { state });
  };

  const handleSendLightningOnLiquid = () => {
    let chosenNetwork: typeof NETWORK_LIQUIDTESTNET | typeof NETWORK_LIQUID = NETWORK_LIQUID; // default - mainnet

    if (network === NETWORK_LIGHTNINGTESTNET) {
      chosenNetwork = NETWORK_LIQUIDTESTNET;
    }

    const state: SendLightningProps = { network: chosenNetwork };
    navigate('/send-lightning', { state });
  };

  const handleBuyClick = () => {
    BackgroundCaller.getAddress(network, accountNumber).then((addressResponse) => {
      if (addressResponse) {
        window.open(`https://layerztec.github.io/website/onramp/?address=${addressResponse}&network=${network}`, '_blank');
      }
    });
  };

  const handleSwapClick = () => {
    setShowSwapInterface(true);
  };

  return (
    <div>
      <Switch items={availableNetworks} activeItem={network} onItemClick={setNetwork} />
      {getKnowMoreUrl(network) ? (
        <div style={{ textAlign: 'right' }}>
          <a
            href={getKnowMoreUrl(network)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#808080',
              fontSize: '0.5em',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <span>Learn about {capitalizeFirstLetter(network)}</span>
            <span style={{ display: 'inline-block', marginLeft: '4px', position: 'relative', top: '2px' }}>
              <Info size={15} />
            </span>
          </a>
        </div>
      ) : null}

      {isTestnet ? (
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

      {showSwapInterface ? (
        <SwapInterfaceView />
      ) : (
        <div>
          <PartnersView />
          {network === NETWORK_LIQUID || network === NETWORK_LIQUIDTESTNET ? <LiquidTokensView /> : <TokensView />}
        </div>
      )}

      <br />
      <br />

      {network === NETWORK_LIGHTNING || network === NETWORK_LIGHTNINGTESTNET ? (
        <ActionPopupButton
          actions={[
            {
              label: 'Send via Spark',
              onClick: handleSendLightningOnSpark,
            },
            {
              label: 'Send via Liquid',
              onClick: handleSendLightningOnLiquid,
            },
            { label: 'Cancel', onClick: () => {} },
          ]}
        >
          <SendIcon />
          Send
        </ActionPopupButton>
      ) : (
        <Button onClick={handleSend}>
          <SendIcon />
          Send
        </Button>
      )}

      {network === NETWORK_LIGHTNING || network === NETWORK_LIGHTNINGTESTNET ? (
        <ActionPopupButton
          actions={[
            {
              label: 'Receive on Spark',
              onClick: handleReceiveLightningOnSpark,
            },
            {
              label: 'Receive on Liquid',
              onClick: handleReceiveLightningOnLiquid,
            },
            { label: 'Cancel', onClick: () => {} },
          ]}
        >
          <ArrowDownRightIcon />
          Receive
        </ActionPopupButton>
      ) : (
        <Button onClick={handleReceive}>
          <ArrowDownRightIcon />
          Receive
        </Button>
      )}

      {swapPairs.length > 0 ? (
        <Button onClick={handleSwapClick}>
          <RefreshCwIcon /> Swap
        </Button>
      ) : null}
    </div>
  );
};

export default Home;
