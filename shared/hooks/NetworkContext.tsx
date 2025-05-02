import React, { createContext, ReactNode, useEffect, useState } from 'react';
import { DEFAULT_NETWORK } from '../config';
import { getChainIdByNetwork } from '../models/network-getters';
import { IBackgroundCaller } from '../types/IBackgroundCaller';
import { Messenger } from '../modules/messenger';
import { getAvailableNetworks, Networks } from '../types/networks';
import { IStorage } from '../types/IStorage';

interface INetworkContext {
  network: Networks;
  setNetwork: React.Dispatch<React.SetStateAction<Networks>>;
}

export const NetworkContext = createContext<INetworkContext>({
  network: DEFAULT_NETWORK,
  setNetwork: () => {
    throw new Error('This should never happen');
  },
});

export const STORAGE_SELECTED_NETWORK = 'STORAGE_SELECTED_NETWORK';

interface NetworkContextProviderProps {
  children: ReactNode;
  storage: IStorage;
  backgroundCaller?: IBackgroundCaller; // Make backgroundCaller optional
}

export const NetworkContextProvider: React.FC<NetworkContextProviderProps> = (props) => {
  const [network, setNetwork] = useState<Networks>(DEFAULT_NETWORK);

  // initial load:
  useEffect(() => {
    (async () => {
      try {
        // Check if backgroundCaller exists before using it
        if (props.backgroundCaller) {
          await props.backgroundCaller.log('loading selected network...');
        }

        const response = await props.storage.getItem(STORAGE_SELECTED_NETWORK);

        // checking types manually, in runtime:
        if (getAvailableNetworks().includes(response as Networks)) {
          // Check if backgroundCaller exists before using it
          if (props.backgroundCaller) {
            await props.backgroundCaller.log('loaded ' + response);
          }
          setNetwork(response as Networks);
        }
      } catch (error) {
        console.error('Error loading network:', error);
      }
    })();
  }, [props.storage, props.backgroundCaller]);

  const setNetworkOverload = (value: ((prevState: Networks) => Networks) | Networks) => {
    if (value instanceof Function) {
      setNetwork(value(network)); // unsure
    } else {
      // Check if backgroundCaller exists before using it
      if (props.backgroundCaller) {
        props.backgroundCaller.log('changing selected network to: ' + value);
      }

      props.storage.setItem(STORAGE_SELECTED_NETWORK, value);
      setNetwork(value);

      // triggering event for any connected Dapp:
      Messenger.sendEventCallbackFromPopupToContentScript({
        for: 'webpage',
        type: 'eventCallback',
        event: 'chainChanged',
        arg: getChainIdByNetwork(value) as string,
      });
    }
  };

  return <NetworkContext.Provider value={{ network, setNetwork: setNetworkOverload }}>{props.children}</NetworkContext.Provider>;
};
