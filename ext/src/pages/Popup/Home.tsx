import { ArrowDownRightIcon, Info, SendIcon, RefreshCwIcon } from 'lucide-react';
import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getSwapPairs } from '@shared/models/swap-providers-list';
import { getKnowMoreUrl } from '@shared/models/network-getters';
import { capitalizeFirstLetter } from '@shared/modules/string-utils';
import { SwapPair, SwapPlatform } from '@shared/types/swap';
import { useAvailableNetworks } from '@shared/hooks/useAvailableNetworks';
import { NETWORK_ARK, NETWORK_ARK_MUTINYNET, NETWORK_BITCOIN, NETWORK_LIGHTNING, NETWORK_LIGHTNING_TESTNET, NETWORK_LIQUID, NETWORK_LIQUID_TESTNET, NETWORK_SPARK } from '@shared/types/networks';

import { BackgroundCaller } from '../../modules/background-caller';
import PartnersView from './components/PartnersView';
import TokensView from './components/TokensView';
import { ActionPopupButton, Button, Switch } from './DesignSystem';
import LiquidTokensView from './components/LiquidTokensView';
import SwapInterfaceView from './components/SwapInterfaceView';
import BalanceView from './components/BalanceView';
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
      case NETWORK_ARK_MUTINYNET:
      case NETWORK_ARK:
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
      alert('Ark lightning has no testnet');
      return;
    }
    const state: ReceiveLightningProps = { network: NETWORK_ARK };
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
      alert('Ark lightning has no testnet');
      return;
    }
    const state: SendLightningProps = { network: NETWORK_ARK };
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

      <BalanceView network={network} accountNumber={accountNumber} BackgroundCaller={BackgroundCaller} />

      {showSwapInterface ? (
        <SwapInterfaceView />
      ) : (
        <div>
          <PartnersView />
          {network === NETWORK_LIQUID || network === NETWORK_LIQUID_TESTNET ? <LiquidTokensView /> : <TokensView />}
        </div>
      )}

      <br />
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
              label: 'Send via Ark',
              onClick: handleSendLightningOnArk,
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
              label: 'Receive on Ark',
              onClick: handleReceiveLightningOnArk,
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
