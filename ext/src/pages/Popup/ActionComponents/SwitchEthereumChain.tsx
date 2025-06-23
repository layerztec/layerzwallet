import BigNumber from 'bignumber.js';
import React, { useContext } from 'react';

import { getChainIdByNetwork } from '@shared/models/network-getters';
import { NetworkContext } from '@shared/hooks/NetworkContext';

import { Messenger } from '@shared/modules/messenger';
import { getAvailableNetworks, Networks } from '@shared/types/networks';
import { Button } from '../DesignSystem';
import { capitalizeFirstLetter } from '@shared/modules/string-utils';

interface SwitchEthereumChainArgs {
  params: any[];
  id: string;
  from: string;
}

/**
 * This screen and such are basically single purpose popups that are supposed to get some sort of response from the user
 * and post data back via a message (there's a content script on the other end that will fulfill the promise for a web3 provider)
 */
export function SwitchEthereumChain(args: SwitchEthereumChainArgs) {
  const { setNetwork } = useContext(NetworkContext);

  const onAllowClick = async () => {
    const id = args.id;

    const net = getNetworkFromParams();
    if (net) {
      setNetwork(net);

      await Messenger.sendResponseToActiveTabsFromPopupToContentScript({
        for: 'webpage',
        id: Number(id),
        response: null,
      });

      await new Promise((resolve) => setTimeout(resolve, 100)); // propagate
      window.close();
      return;
    }

    // guard, we are not even supposed to display allow/deny buttons if we cant get network from params

    await Messenger.sendResponseToActiveTabsFromPopupToContentScript({
      for: 'webpage',
      id: Number(id),
      error: {
        code: 4902,
        message: 'Unrecognized chain ID',
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 100)); // propagate
    window.close();
  };

  const onDenyClick = async () => {
    const id = args.id;
    await Messenger.sendResponseToActiveTabsFromPopupToContentScript({ for: 'webpage', id: Number(id), error: { code: 4001, message: 'User rejected the request.' } });

    await new Promise((resolve) => setTimeout(resolve, 100)); // propagate
    window.close();
  };

  const getNetworkFromParams = (): Networks | undefined => {
    const params = args.params;
    console.log('params=', params, params?.[0]?.chainId);
    if (params?.[0]?.chainId) {
      for (const net of getAvailableNetworks()) {
        console.log(new BigNumber(getChainIdByNetwork(net)).toNumber(), '???', new BigNumber(params[0].chainId).toNumber());
        if (new BigNumber(getChainIdByNetwork(net)).toNumber() === new BigNumber(params[0].chainId).toNumber()) {
          return net;
        }
      }
    }
  };

  const renderParams = () => {
    const net = getNetworkFromParams();
    if (net) {
      return <span style={{ fontSize: 14 }}>Switch to {capitalizeFirstLetter(net)} network ?</span>;
    } else {
      return <span style={{ fontSize: 14 }}>Cant find the network to switch to</span>;
    }
  };

  return (
    <>
      <h1>Dapp wants to switch chain</h1>

      <span>{renderParams()}</span>
      <br />
      <br />

      {getNetworkFromParams() ? (
        <div>
          <Button onClick={() => onAllowClick()}>Allow</Button>
          <Button onClick={() => onDenyClick()}>Deny</Button>
        </div>
      ) : null}
    </>
  );
}
