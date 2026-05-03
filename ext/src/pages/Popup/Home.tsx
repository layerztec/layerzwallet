import { ArrowDownRightIcon, Info, RefreshCwIcon, SendIcon } from 'lucide-react';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useAvailableNetworks } from '@shared/hooks/useAvailableNetworks';
import { getKnowMoreUrl } from '@shared/models/network-getters';
import { getSwapPairs } from '@shared/models/swap-providers-list';
import { USDT_TOKENS } from '@shared/models/token-list';
import { sleep } from '@shared/modules/sleep';
import { capitalizeFirstLetter } from '@shared/modules/string-utils';
import {
  NETWORK_ARK,
  NETWORK_ARK_MUTINYNET,
  NETWORK_BITCOIN,
  NETWORK_LIGHTNING,
  NETWORK_LIGHTNING_TESTNET,
  NETWORK_LIQUID,
  NETWORK_LIQUID_TESTNET,
  NETWORK_RGB,
  NETWORK_RGB_TESTNET,
  NETWORK_ROOTSTOCK,
  NETWORK_SPARK,
  NETWORK_STACKS,
  NETWORK_USDT,
  Networks,
} from '@shared/types/networks';
import { SO_LIQUID_USDT, SO_ROOTSTOCK_USDT, SwapPair, SwapPlatform } from '@shared/types/swap';

import { BackgroundCaller } from '../../modules/background-caller';
import Balance from './components/Balance';
import NftsView from './components/NftsView';
import PartnersView from './components/PartnersView';
import SwapInterfaceView from './components/SwapInterfaceView';
import SwapListView from './components/SwapListView';
import TokensView from './components/TokensView';
import { ActionPopupButton, Button, Switch } from './DesignSystem';
import { ReceiveLightningProps } from './ReceiveLightning';
import { SendLightningProps } from './SendLightning';

const Home: React.FC = () => {
  const navigate = useNavigate();

  const { network, setNetwork } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const [swapPairs, setSwapPairs] = useState<SwapPair[]>([]);
  const [showSwapInterface, setShowSwapInterface] = useState<boolean>(false);
  const [swapFromNetwork, setSwapFromNetwork] = useState<typeof SO_LIQUID_USDT | typeof SO_ROOTSTOCK_USDT | Networks>(network);
  const availableNetworks = useAvailableNetworks();
  const balanceRef = useRef<{ refresh: () => void }>(null);
  const tokensViewRef = useRef<{ refresh: () => void }>(null);
  const nftsViewRef = useRef<{ refresh: () => void }>(null);
  const swapListRef = useRef<{ refresh: () => void }>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setSwapPairs(getSwapPairs(network, SwapPlatform.EXT));
    setShowSwapInterface(false);
    setSwapFromNetwork(network);
  }, [network]);

  const handleReceive = () => {
    if (network === NETWORK_RGB || network === NETWORK_RGB_TESTNET) {
      navigate('/receive-rgb-token');
      return;
    }
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
      case NETWORK_STACKS:
        navigate('/send-account-based');
        break;
      case NETWORK_LIQUID:
      case NETWORK_LIQUID_TESTNET:
        navigate('/send-liquid');
        break;
      case NETWORK_LIGHTNING:
      case NETWORK_LIGHTNING_TESTNET:
        navigate('/send-lightning');
        break;
      case NETWORK_RGB:
      case NETWORK_RGB_TESTNET:
        navigate('/send-rgb');
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
    setSwapFromNetwork(network);
    setShowSwapInterface(true);
  };

  const handleSwapTokenViaLiquid = () => {
    setSwapFromNetwork(SO_LIQUID_USDT);
    setShowSwapInterface(true);
  };

  const handleSwapTokenViaRootstock = () => {
    setSwapFromNetwork(SO_ROOTSTOCK_USDT);
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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      balanceRef.current?.refresh();
      tokensViewRef.current?.refresh();
      nftsViewRef.current?.refresh();
      swapListRef.current?.refresh();
      await sleep(3000); // wait for 3 seconds to simulate a refresh
    } finally {
      setRefreshing(false);
    }
  }, []);

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
      <div style={{ textAlign: 'right', marginTop: '4px', marginBottom: '10px' }}>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            padding: '4px 8px',
            fontSize: '12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            backgroundColor: refreshing ? '#f0f0f0' : 'white',
            cursor: refreshing ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            color: refreshing ? '#999' : '#333',
          }}
          title="Refresh"
        >
          <RefreshCwIcon size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      <Balance ref={balanceRef} network={network} accountNumber={accountNumber} BackgroundCaller={BackgroundCaller} />

      {showSwapInterface ? (
        <SwapInterfaceView fromNetwork={swapFromNetwork} />
      ) : (
        <div>
          <PartnersView />
          <TokensView ref={tokensViewRef} />
          <NftsView ref={nftsViewRef} />
        </div>
      )}

      <br />
      <SwapListView ref={swapListRef} />
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
              label: 'Receive on Ark',
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

      {network === NETWORK_USDT ? (
        // For USDT, check if either liquid or rootstock USDT can be swapped
        getSwapPairs(SO_LIQUID_USDT, SwapPlatform.EXT).length > 0 || getSwapPairs(SO_ROOTSTOCK_USDT, SwapPlatform.EXT).length > 0 ? (
          <ActionPopupButton
            actions={[
              ...(getSwapPairs(SO_LIQUID_USDT, SwapPlatform.EXT).length > 0
                ? [
                    {
                      label: 'Swap USDT on Liquid',
                      onClick: handleSwapTokenViaLiquid,
                    },
                  ]
                : []),
              ...(getSwapPairs(SO_ROOTSTOCK_USDT, SwapPlatform.EXT).length > 0
                ? [
                    {
                      label: 'Swap USDT on Rootstock',
                      onClick: handleSwapTokenViaRootstock,
                    },
                  ]
                : []),
              { label: 'Cancel', onClick: () => {} },
            ]}
          >
            <RefreshCwIcon /> Swap
          </ActionPopupButton>
        ) : null
      ) : swapPairs.length > 0 ? (
        <Button onClick={handleSwapClick}>
          <RefreshCwIcon /> Swap
        </Button>
      ) : null}
    </div>
  );
};

export default Home;
