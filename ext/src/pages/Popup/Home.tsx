import { ArrowDownRightIcon, Info, SendIcon, ShoppingCartIcon } from 'lucide-react';
import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useBalance } from '@shared/hooks/useBalance';
import { useExchangeRate } from '@shared/hooks/useExchangeRate';
import { getDecimalsByNetwork, getIsTestnet, getKnowMoreUrl, getTickerByNetwork } from '@shared/models/network-getters';
import { capitalizeFirstLetter, formatBalance, formatFiatBalance } from '@shared/modules/string-utils';
import { getAvailableNetworks, NETWORK_ARKMUTINYNET, NETWORK_BITCOIN, NETWORK_BREEZ, NETWORK_BREEZTESTNET, NETWORK_LIQUIDTESTNET, Networks } from '@shared/types/networks';
import { BackgroundCaller } from '../../../modules/background-caller';
import { Button, Switch } from '../DesignSystem';
import BreezTokensView from './breez-tokens-view';
import PartnersView from './PartnersView';
import TokensView from './TokensView';
import { ThemedText } from '../../../components/ThemedText';

const Home: React.FC = () => {
  const navigate = useNavigate();

  const { network, setNetwork } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { balance } = useBalance(network, accountNumber, BackgroundCaller);
  const [isTestnet, setIsTestnet] = useState<boolean>(false);
  const { exchangeRate } = useExchangeRate(network, 'USD');

  useEffect(() => {
    setIsTestnet(getIsTestnet(network));
  }, [network]);

  const handleReceive = () => {
    switch (network) {
      case NETWORK_BREEZ:
      case NETWORK_BREEZTESTNET:
        navigate('/receive-breez');
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
      case NETWORK_ARKMUTINYNET:
        navigate('/send-ark');
        break;
      case NETWORK_BREEZ:
      case NETWORK_BREEZTESTNET:
        navigate('/send-breez');
        break;
      default:
        navigate('/send-evm');
    }
  };

  return (
    <div>
      <Switch
        items={getAvailableNetworks()}
        activeItem={network}
        onItemClick={(item) => {
          setNetwork(item as Networks);
        }}
      />
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
            <ThemedText>Learn about {capitalizeFirstLetter(network)}</ThemedText>
            <span style={{ display: 'inline-block', marginLeft: '4px', position: 'relative', top: '2px' }}>
              <Info size={15} />
            </span>
          </a>
        </div>
      ) : null}

      {isTestnet ? (
        <div style={{ color: 'darkred', width: '100%', marginBottom: '15px' }}>
          <ThemedText style={{ fontSize: 14 }}>Testnet. Coins have no value</ThemedText>
        </div>
      ) : null}
      <h1>
        <ThemedText id="home-balance" type="headline">
          {balance ? formatBalance(balance, getDecimalsByNetwork(network), 8) : ''}
        </ThemedText>{' '}
        {getTickerByNetwork(network)}
        {network === NETWORK_BITCOIN ? (
          <span style={{ paddingLeft: '15px' }}>
            <Button
              onClick={() => {
                BackgroundCaller.getAddress(network, accountNumber).then((addressResponse) => {
                  if (addressResponse) {
                    window.open(`https://layerztec.github.io/website/onramp/?address=${addressResponse}`, '_blank');
                  }
                });
              }}
            >
              <ShoppingCartIcon /> <ThemedText>Buy</ThemedText>
            </Button>
          </span>
        ) : null}
        <div style={{ width: '100%', marginBottom: '15px' }}>
          <ThemedText style={{ fontSize: 14 }}>{balance && +balance > 0 && exchangeRate ? '$' + formatFiatBalance(balance, getDecimalsByNetwork(network), exchangeRate) : ''}</ThemedText>
        </div>
      </h1>
      <PartnersView />

      {network === NETWORK_BREEZ || network === NETWORK_BREEZTESTNET ? <BreezTokensView /> : <TokensView />}

      <br />
      <br />
      <Button onClick={handleSend}>
        <SendIcon />
        <ThemedText>Send</ThemedText>
      </Button>
      <Button onClick={handleReceive}>
        <ArrowDownRightIcon />
        <ThemedText>Receive</ThemedText>
      </Button>
    </div>
  );
};

export default Home;
