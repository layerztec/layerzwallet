import { ArrowDownRightIcon, Info, SendIcon, ShoppingCartIcon, RefreshCwIcon } from 'lucide-react';
import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useBalance } from '@shared/hooks/useBalance';
import { useExchangeRate } from '@shared/hooks/useExchangeRate';
import { fiatOnRamp } from '@shared/models/fiat-on-ramp';
import { getSwapPairs } from '@shared/models/swap-providers-list';
import { getDecimalsByNetwork, getIsTestnet, getKnowMoreUrl, getTickerByNetwork } from '@shared/models/network-getters';
import { capitalizeFirstLetter, formatBalance, formatFiatBalance } from '@shared/modules/string-utils';
import { SwapPair, SwapPlatform } from '@shared/types/swap';

import {
  getAvailableNetworks,
  NETWORK_ARKMUTINYNET,
  NETWORK_BITCOIN,
  NETWORK_LIGHTNING,
  NETWORK_LIGHTNINGTESTNET,
  NETWORK_LIQUID,
  NETWORK_LIQUIDTESTNET,
  NETWORK_SPARK,
  Networks,
} from '@shared/types/networks';
import { BackgroundCaller } from '../../modules/background-caller';
import PartnersView from './components/PartnersView';
import TokensView from './components/TokensView';
import { Button, Switch } from './DesignSystem';
import LiquidTokensView from './components/LiquidTokensView';
import SwapInterfaceView from './components/SwapInterfaceView';

const Home: React.FC = () => {
  const navigate = useNavigate();

  const { network, setNetwork } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { balance } = useBalance(network, accountNumber, BackgroundCaller);
  const [isTestnet, setIsTestnet] = useState<boolean>(false);
  const { exchangeRate } = useExchangeRate(network, 'USD');
  const [swapPairs, setSwapPairs] = useState<SwapPair[]>([]);
  const [showSwapInterface, setShowSwapInterface] = useState<boolean>(false);

  useEffect(() => {
    setIsTestnet(getIsTestnet(network));
    setShowSwapInterface(false);
  }, [network]);

  useEffect(() => {
    setSwapPairs(getSwapPairs(network, SwapPlatform.EXT));
    setShowSwapInterface(false);
  }, [network]);

  const handleReceive = () => {
    switch (network) {
      case NETWORK_LIGHTNING:
      case NETWORK_LIGHTNINGTESTNET:
        navigate('/receive-lightning');
        break;
      default:
        navigate('/receive');
    }
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

  return (
    <div>
      <Switch items={getAvailableNetworks()} activeItem={network} onItemClick={setNetwork} />
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
      <h1>
        <span id="home-balance">{balance ? formatBalance(balance, getDecimalsByNetwork(network), 8) : ''}</span> {getTickerByNetwork(network)}
        {fiatOnRamp?.[network]?.canBuyWithFiat ? (
          <span style={{ paddingLeft: '15px' }}>
            <Button
              onClick={() => {
                BackgroundCaller.getAddress(network, accountNumber).then((addressResponse) => {
                  if (addressResponse) {
                    window.open(`https://layerztec.github.io/website/onramp/?address=${addressResponse}&network=${network}`, '_blank');
                  }
                });
              }}
            >
              <ShoppingCartIcon /> Buy
            </Button>
          </span>
        ) : null}
        <div style={{ width: '100%', marginBottom: '15px' }}>
          <span style={{ fontSize: 14 }}>{balance && +balance > 0 && exchangeRate ? '$' + formatFiatBalance(balance, getDecimalsByNetwork(network), exchangeRate) : ''}</span>
        </div>
      </h1>

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
      <Button onClick={handleSend}>
        <SendIcon />
        Send
      </Button>
      <Button onClick={handleReceive}>
        <ArrowDownRightIcon />
        Receive
      </Button>

      {swapPairs.length > 0 ? (
        <Button
          onClick={() => {
            setShowSwapInterface(true);
          }}
        >
          <RefreshCwIcon /> Swap
        </Button>
      ) : null}
    </div>
  );
};

export default Home;
