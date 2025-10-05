import { ArrowDownRightIcon, Info, SendIcon, RefreshCwIcon } from 'lucide-react';
import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getSwapPairs } from '@shared/models/swap-providers-list';
import { getKnowMoreUrl } from '@shared/models/network-getters';
import { capitalizeFirstLetter } from '@shared/modules/string-utils';
import { USDT_TOKENS } from '@shared/models/token-list';
import { SwapPair, SwapPlatform } from '@shared/types/swap';
import { useAvailableNetworks } from '@shared/hooks/useAvailableNetworks';
import {
  NETWORK_ARKADE,
  NETWORK_ARKADE_MUTINYNET,
  NETWORK_BITCOIN,
  NETWORK_LIGHTNING,
  NETWORK_LIGHTNING_TESTNET,
  NETWORK_LIQUID,
  NETWORK_LIQUID_TESTNET,
  NETWORK_ROOTSTOCK,
  NETWORK_SPARK,
  NETWORK_USDT,
} from '@shared/types/networks';

import { BackgroundCaller } from '../../modules/background-caller';
import PartnersView from './components/PartnersView';
import TokensView from './components/TokensView';
import { ActionPopupButton, Button, Switch } from './DesignSystem';
import SwapInterfaceView from './components/SwapInterfaceView';
import Balance from './components/Balance';
import SwapListView from './components/SwapListView';
import { ReceiveLightningProps } from './ReceiveLightning';
import { SendLightningProps } from './SendLightning';

const Home: React.FC = () => {
  const navigate = useNavigate();

  const { network, setNetwork } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const [swapPairs, setSwapPairs] = useState<SwapPair[]>([]);
  const [showSwapInterface, setShowSwapInterface] = useState<boolean>(false);
  const availableNetworks = useAvailableNetworks();

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
      case NETWORK_ARKADE_MUTINYNET:
      case NETWORK_ARKADE:
        navigate('/send-ark');
        break;
      case NETWORK_LIQUID:
      case NETWORK_LIQUID_TESTNET:
        navigate('/send-liquid');
        break;
      case NETWORK_LIGHTNING:
      case NETWORK_LIGHTNING_TESTNET:
        navigate('/send-lightning');
        break;
      default:
        navigate('/send-evm');
    }
  };

  const handleReceiveLightningOnSpark = () => {
    if (network === NETWORK_LIGHTNING_TESTNET) {
      alert('Spark has no testnet');
      return;
    }
    const state: ReceiveLightningProps = { network: NETWORK_SPARK };
    navigate('/receive-lightning', { state });
  };

  const handleReceiveLightningOnArk = () => {
    if (network === NETWORK_LIGHTNING_TESTNET) {
      alert('Arkade lightning has no testnet');
      return;
    }
    const state: ReceiveLightningProps = { network: NETWORK_ARKADE };
    navigate('/receive-lightning', { state });
  };

  const handleSendLightningOnSpark = () => {
    if (network === NETWORK_LIGHTNING_TESTNET) {
      alert('Spark has no testnet');
      return;
    }
    const state: SendLightningProps = { network: NETWORK_SPARK };
    navigate('/send-lightning', { state });
  };

  const handleSendLightningOnArk = () => {
    if (network === NETWORK_LIGHTNING_TESTNET) {
      alert('Arkade lightning has no testnet');
      return;
    }
    const state: SendLightningProps = { network: NETWORK_ARKADE };
    navigate('/send-lightning', { state });
  };

  const handleReceiveLightningOnLiquid = () => {
    let chosenNetwork: typeof NETWORK_LIQUID_TESTNET | typeof NETWORK_LIQUID = NETWORK_LIQUID; // default - mainnet

    if (network === NETWORK_LIGHTNING_TESTNET) {
      chosenNetwork = NETWORK_LIQUID_TESTNET;
    }

    const state: ReceiveLightningProps = { network: chosenNetwork };
    navigate('/receive-lightning', { state });
  };

  const handleSendLightningOnLiquid = () => {
    let chosenNetwork: typeof NETWORK_LIQUID_TESTNET | typeof NETWORK_LIQUID = NETWORK_LIQUID; // default - mainnet

    if (network === NETWORK_LIGHTNING_TESTNET) {
      chosenNetwork = NETWORK_LIQUID_TESTNET;
    }

    const state: SendLightningProps = { network: chosenNetwork };
    navigate('/send-lightning', { state });
  };

  const handleSwapClick = () => {
    setShowSwapInterface(true);
  };

  const handleSendUSDTViaRootstock = (contractAddress: string) => () => {
    setNetwork(NETWORK_ROOTSTOCK);
    const state = { contractAddress };
    navigate('/send-token-evm', { state });
  };

  const handleSendUSDTViaLiquid = () => {
    setNetwork(NETWORK_LIQUID);
    navigate(`/send-liquid?assetId=${USDT_TOKENS[NETWORK_LIQUID][0]}`);
  };

  const handleReceiveUSDTViaRootstock = () => {
    setNetwork(NETWORK_ROOTSTOCK);
    navigate('/receive');
  };

  const handleReceiveUSDTViaLiquid = () => {
    setNetwork(NETWORK_LIQUID);
    navigate('/receive');
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

      <Balance network={network} accountNumber={accountNumber} BackgroundCaller={BackgroundCaller} />

      {showSwapInterface ? (
        <SwapInterfaceView />
      ) : (
        <div>
          <PartnersView />
          <TokensView />
        </div>
      )}

      <br />
      <SwapListView />
      <br />

      {network === NETWORK_LIGHTNING || network === NETWORK_LIGHTNING_TESTNET ? (
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
            {
              label: 'Send via Arkade',
              onClick: handleSendLightningOnArk,
            },
            { label: 'Cancel', onClick: () => {} },
          ]}
        >
          <SendIcon />
          Send
        </ActionPopupButton>
      ) : network === NETWORK_USDT ? (
        <ActionPopupButton
          actions={[
            {
              label: 'Send USDT via Rootstock',
              onClick: handleSendUSDTViaRootstock(USDT_TOKENS[NETWORK_ROOTSTOCK][0]),
            },
            {
              label: 'Send USDT0 via Rootstock',
              onClick: handleSendUSDTViaRootstock(USDT_TOKENS[NETWORK_ROOTSTOCK][1]),
            },
            {
              label: 'Send rUSDT via Rootstock',
              onClick: handleSendUSDTViaRootstock(USDT_TOKENS[NETWORK_ROOTSTOCK][2]),
            },
            {
              label: 'Send USDT via Liquid',
              onClick: handleSendUSDTViaLiquid,
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

      {network === NETWORK_LIGHTNING || network === NETWORK_LIGHTNING_TESTNET ? (
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
            {
              label: 'Receive on Arkade',
              onClick: handleReceiveLightningOnArk,
            },
            { label: 'Cancel', onClick: () => {} },
          ]}
        >
          <ArrowDownRightIcon />
          Receive
        </ActionPopupButton>
      ) : network === NETWORK_USDT ? (
        <ActionPopupButton
          actions={[
            {
              label: 'Receive via Rootstock',
              onClick: handleReceiveUSDTViaRootstock,
            },
            {
              label: 'Receive via Liquid',
              onClick: handleReceiveUSDTViaLiquid,
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
