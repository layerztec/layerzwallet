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
  NETWORK_ROOTSTOCK,
  NETWORK_SPARK,
  NETWORK_STACKS,
  NETWORK_USDT,
  Networks,
} from '@shared/types/networks';
import { SO_LIQUID_USDT, SO_ROOTSTOCK_USDT, SwapPair, SwapPlatform } from '@shared/types/swap';

import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { BackgroundCaller } from '../../modules/background-caller';
import Balance from './components/Balance';
import NftsView from './components/NftsView';
import PartnersView from './components/PartnersView';
import SwapInterfaceView from './components/SwapInterfaceView';
import SwapListView from './components/SwapListView';
import TokensView from './components/TokensView';
import { ActionPopupButton } from './DesignSystem';
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
    <div className="w-full space-y-4 p-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Tabs value={network} onValueChange={(value) => setNetwork(value as Networks)} className="w-full">
              <TabsList className="flex w-full flex-wrap gap-1">
                {availableNetworks.map((net) => (
                  <TabsTrigger key={net} value={net} className="text-xs flex-1 min-w-[80px]">
                    {capitalizeFirstLetter(net)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={refreshing} className="h-8 w-8" title="Refresh">
              <RefreshCwIcon size={16} className={refreshing ? 'animate-spin' : ''} />
            </Button>
          </div>
          {getKnowMoreUrl(network) ? (
            <div className="mt-2 flex justify-end">
              <a
                href={getKnowMoreUrl(network)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
              >
                <span>Learn about {capitalizeFirstLetter(network)}</span>
                <Info size={12} />
              </a>
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          <Balance ref={balanceRef} network={network} accountNumber={accountNumber} BackgroundCaller={BackgroundCaller} />
        </CardContent>
      </Card>

      {showSwapInterface ? (
        <Card>
          <CardContent className="pt-6">
            <SwapInterfaceView fromNetwork={swapFromNetwork} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <PartnersView />
          <TokensView ref={tokensViewRef} />
          <NftsView ref={nftsViewRef} />
        </div>
      )}

      <SwapListView ref={swapListRef} />

      <div className="flex flex-col gap-2">
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
            <SendIcon size={18} className="mr-2" />
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
            <SendIcon size={18} className="mr-2" />
            Send
          </ActionPopupButton>
        ) : (
          <Button onClick={handleSend} className="w-full">
            <SendIcon size={18} className="mr-2" />
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
            <ArrowDownRightIcon size={18} className="mr-2" />
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
            <ArrowDownRightIcon size={18} className="mr-2" />
            Receive
          </ActionPopupButton>
        ) : (
          <Button onClick={handleReceive} variant="outline" className="w-full">
            <ArrowDownRightIcon size={18} className="mr-2" />
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
              <RefreshCwIcon size={18} className="mr-2" />
              Swap
            </ActionPopupButton>
          ) : null
        ) : swapPairs.length > 0 ? (
          <Button onClick={handleSwapClick} variant="secondary" className="w-full">
            <RefreshCwIcon size={18} className="mr-2" />
            Swap
          </Button>
        ) : null}
      </div>
    </div>
  );
};

export default Home;
